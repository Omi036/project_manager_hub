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
            userData.discord_id ?? userData.discordId ?? null,
            userData.avatar_url ?? userData.avatarUrl ?? null,
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
            discord_id: updatedData.discord_id ?? updatedData.discordId,
            avatar_url: updatedData.avatar_url ?? updatedData.avatarUrl,
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
}

module.exports = { User, UsersManager };
