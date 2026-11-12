const express = require("express");
const { validateJsonBody, validateRequest } = require("../validation");

class User {
    /**
     * Creates a user model backed by a users manager.
     * @param {UsersManager} usersManager Manager used for user operations.
     * @param {Object} data User data returned by the database.
     */
    constructor(usersManager, {username, nick, role, discord_id, avatar_url, created_at}) {
        this.usersManager = usersManager;
        this.username = username;
        this.nick = nick;
        this.role = role;
        this.discord_id = discord_id;
        this.avatar_url = avatar_url;
        this.created_at = created_at;
    }

    /**
     * Updates this user.
     * @param {Object} updatedData Fields to update.
     * @returns {Promise<User|null>} The updated user, or null if it does not exist.
     */
    update(updatedData) { return this.usersManager.updateUser(this.username, updatedData) }
    /** @returns {Promise<boolean>} Whether the user was deleted. */
    delete() { return this.usersManager.deleteUser(this.username) }
}


class UsersManager {
    /**
     * Creates a users manager.
     * @param {Object} db Database pool or connection.
     */
    constructor(db) {
        this.db = db;
    }

    /** @returns {Promise<User[]>} All users ordered by nickname. */
    async getUsers() {
        const [rows] = await this.db.query(`
            SELECT username, nick, role, discord_id, avatar_url, created_at
            FROM users
            ORDER BY nick
        `);
        return rows.map((row) => new User(this, row));
    }

    /**
     * Creates a user.
     * @param {Object} userData User data to insert.
     * @returns {Promise<User>} The created user.
     */
    async createUser(userData) {
        await this.db.query(`
            INSERT INTO users (username, nick, role, discord_id, avatar_url)
            VALUES (?, ?, COALESCE(?, 'member'), ?, ?)
        `, [
            userData.username,
            userData.nick,
            userData.role,
            userData.discord_id ?? null,
            userData.avatar_url ?? null,
        ]);
        return this.findUserByUsername(userData.username);
    }

    /**
     * Finds a user by username.
     * @param {string} username Username to find.
     * @returns {Promise<User|null>} The matching user, or null.
     */
    async findUserByUsername(username) {
        const [rows] = await this.db.query(`
            SELECT username, nick, role, discord_id, avatar_url, created_at
            FROM users
            WHERE username = ?
        `, [username]);
        return rows.length ? new User(this, rows[0]) : null;
    }

    /**
     * Updates a user.
     * @param {string} username Username of the user to update.
     * @param {Object} updatedData Fields to update.
     * @returns {Promise<User|null>} The updated user, or null if it does not exist.
     */
    async updateUser(username, updatedData) {
        const fields = Object.entries({
            nick: updatedData.nick,
            role: updatedData.role,  
            discord_id: updatedData.discord_id,
            avatar_url: updatedData.avatar_url,
        }).filter(([, value]) => value !== undefined);

        if (!fields.length) return this.findUserByUsername(username);

        const assignments = fields.map(([field]) => `${field} = ?`);
        const [result] = await this.db.query(`
            UPDATE users
            SET ${assignments.join(", ")}
            WHERE username = ?
        `, [...fields.map(([, value]) => value), username]);
        return result.affectedRows ? this.findUserByUsername(username) : null;
    }

    /**
     * Deletes a user.
     * @param {string} username Username of the user to delete.
     * @returns {Promise<boolean>} Whether the user was deleted.
     */
    async deleteUser(username) {
        const [result] = await this.db.query("DELETE FROM users WHERE username = ?", [username]);
        return result.affectedRows > 0;
    }

    /**
     * Creates a router for user-related endpoints.
     * @returns {express.Router} Router for user-related endpoints.
     */
    createRouter() {
        return UsersRouter.createRouter(this);
    }
}

class UsersRouter {
    static createRouter(usersManager) {
        const router = express.Router();

        /**
         * GET /all
         * Retrieves all users, returning only public fields (username, nick, role, avatar_url, created_at).
         */
        router.get("/all", async (req, res) => {
            try {
                const users = (await usersManager.getUsers())
                    .map(user => ({
                        username: user.username,
                        nick: user.nick,
                        role: user.role,
                        avatar_url: user.avatar_url,
                        created_at: user.created_at,
                    }));

                res.json(users);

            } catch (error) {
                console.error("Error fetching users:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * GET /:username
         * @param {string} username - The username of the user to retrieve.
         * Retrieves a user by their username. If the user is not found, returns a 404 error.
         */
        router.get("/:username", validateRequest({
            params: { username: { type: "string", required: true, maxLength: 50 } },
        }), async (req, res) => {
            try {
                const user = await usersManager.findUserByUsername(req.params.username);
                if (!user) return res.status(404).json({ error: "User not found" });

                // Only allow admins to change user discord id
                if(req.user.role !== "admin"){
                    delete user.discord_id
                }

                res.json(user);

            } catch (error) {
                console.error(`Error fetching user ${req.params.username}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * POST /create
         * @body {Object} userData - The data for the new user (username, nick, role, discord_id, avatar_url).
         * Creates a new user. Only admins can perform this action.
         */
        router.post("/create", validateJsonBody({
            username: { type: "string", required: true, maxLength: 50 },
            nick: { type: "string", required: true, maxLength: 100 },
            role: { type: "string", enum: ["member", "admin"] },
            discord_id: { type: "string", nullable: true, maxLength: 100 },
            avatar_url: { type: "string", nullable: true, maxLength: 255 },
        }), async (req, res) => {
            try {
                // Only allow admins to create users
                // (Note that account creation via Discord is handled by the Auth Router)
                if(req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden: Only admins can create users." });
                }

                res.status(201).json(await usersManager.createUser(req.body));

            } catch (error) {
                console.error("Error creating user:", error);
                res.status(400).json({ error: "Error creating user" });
            }
        });


        /**
         * PUT /:username/update
         * @param {string} username - The username of the user to update.
         * @body {Object} updatedData - The fields to update (nick, role, discord_id, avatar_url).
         * Updates a user's information. Only the user themselves or an admin can perform this action.
         */
        router.put("/:username/update", validateRequest({
            params: { username: { type: "string", required: true, maxLength: 50 } },
            body: {
                required: true,
                nonEmpty: true,
                fields: {
                    nick: { type: "string", maxLength: 100 },
                    role: { type: "string", enum: ["member", "admin"] },
                    discord_id: { type: "string", nullable: true, maxLength: 100 },
                    avatar_url: { type: "string", nullable: true, maxLength: 255 },
                },
            },
        }), async (req, res) => {
            try {
                // Only allow the user themselves or an admin to update the user
                if(req.user.username !== req.params.username && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }

                // Only allow admins to change user roles
                const hasRoleField = req.body !== null
                    && typeof req.body === "object"
                    && Object.prototype.hasOwnProperty.call(req.body, "role");

                if (hasRoleField && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden: Only admins can change roles." });
                }

                // Only allow admins to change user Discord IDs
                const hasDiscordIdField = req.body !== null
                    && typeof req.body === "object"
                    && Object.prototype.hasOwnProperty.call(req.body, "discord_id")

                if (hasDiscordIdField && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden: Only admins can change Discord IDs." });   
                }

                const user = await usersManager.updateUser(req.params.username, req.body);
                if (!user) return res.status(404).json({ error: "User not found" });
                res.json(user);
                
            } catch (error) {
                console.error(`Error updating user ${req.params.username}:`, error);
                res.status(400).json({ error: "Error updating user" });
            }
        });

        /**
         * DELETE /:username/delete
         * @param {string} username - The username of the user to delete.
         * Deletes a user. Only admins can perform this action. Disabled by default for safety.
         */ 
        /*
        router.delete("/:username/delete", async (req, res) => {
            try {
                if (!await usersManager.deleteUser(req.params.username)) {
                    return res.status(404).json({ error: "User not found" });
                }
                res.json({ message: "User deleted successfully" });
            } catch (error) {
                console.error(`Error deleting user ${req.params.username}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
        */

        return router;
    }
}

module.exports = { User, UsersManager };
