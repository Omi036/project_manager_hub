const { randomUUID } = require("node:crypto");
const express = require("express");
const { validateJsonBody, validateRequest } = require("../validation");

class DiscussionMessage {
    /**
     * Creates a discussion message model backed by a discussions manager.
     * @param {DiscussionsManager} discussionsManager Manager used for message operations.
     * @param {Object} data Message data returned by the database.
     */
    constructor(discussionsManager, {id, discussion_id, author, text, created_at}) {
        this.discussionsManager = discussionsManager;
        this.id = id;
        this.discussion_id = discussion_id;
        this.author = author;
        this.text = text;
        this.created_at = created_at;
    }

    /**
     * Deletes this message.
     * @returns {Promise<boolean>} Whether the message was deleted.
     */
    delete() { return this.discussionsManager.deleteMessage(this.id) }
}

class Discussion {
    /**
     * Creates a discussion model backed by a discussions manager.
     * @param {DiscussionsManager} discussionsManager Manager used for discussion operations.
     * @param {Object} data Discussion data returned by the database.
     */
    constructor(discussionsManager, { id, title, owner, created_at}) {
        this.discussionsManager = discussionsManager;
        this.id = id;
        this.title = title;
        this.owner = owner;
        this.created_at = created_at;
    }

    /** @returns {Promise<DiscussionMessage[]>} Messages in this discussion. */
    getMessages() { return this.discussionsManager.getMessages(this.id) }

    /**
     * Updates this discussion.
     * @param {Object} updatedData Fields to update.
     * @returns {Promise<Discussion|null>} The updated discussion, or null if it does not exist.
     */
    update(updatedData) { return this.discussionsManager.updateDiscussion(this.id, updatedData)}
    /** @returns {Promise<boolean>} Whether the discussion was deleted. */
    delete() { return this.discussionsManager.deleteDiscussion(this.id) }
}

class DiscussionsManager {
    /**
     * Creates a discussions manager.
     * @param {Object} db Database pool or connection.
     */
    constructor(db) {
        this.db = db;
    }

    /** @returns {Promise<Discussion[]>} All discussions ordered by creation date. */
    async getDiscussions() {
        const [rows] = await this.db.query(`
            SELECT id, title, owner, created_at
            FROM discussions
            ORDER BY created_at DESC
        `);
        return rows.map((row) => new Discussion(this, row));
    }

    /**
     * Creates a discussion.
     * @param {Object} discussionData Discussion data to insert.
     * @returns {Promise<Discussion>} The created discussion.
     */
    async createDiscussion(discussionData) {
        const id = discussionData.id || randomUUID();
        await this.db.query(`
            INSERT INTO discussions (id, title, owner)
            VALUES (?, ?, ?)
        `, [id, discussionData.title, discussionData.owner ?? discussionData.owner_username]);
        return this.findDiscussionById(id);
    }

    /**
     * Finds a discussion by ID.
     * @param {string} discussionId Discussion ID to find.
     * @returns {Promise<Discussion|null>} The matching discussion, or null.
     */
    async findDiscussionById(discussionId) {
        const [rows] = await this.db.query(`
            SELECT id, title, owner, created_at
            FROM discussions
            WHERE id = ?
        `, [discussionId]);
        return rows.length ? new Discussion(this, rows[0]) : null;
    }

    /**
     * Updates a discussion.
     * @param {string} discussionId Discussion ID to update.
     * @param {Object} updatedData Fields to update.
     * @returns {Promise<Discussion|null>} The updated discussion, or null if it does not exist.
     */
    async updateDiscussion(discussionId, updatedData) {
        const fields = Object.entries({
            title: updatedData.title,
            owner: updatedData.owner ?? updatedData.owner_username,
        }).filter(([, value]) => value !== undefined);

        if (!fields.length) return this.findDiscussionById(discussionId);

        const assignments = fields.map(([field]) => `${field} = ?`);
        const [result] = await this.db.query(`
            UPDATE discussions
            SET ${assignments.join(", ")}
            WHERE id = ?
        `, [...fields.map(([, value]) => value), discussionId]);
        return result.affectedRows ? this.findDiscussionById(discussionId) : null;
    }

    /**
     * Deletes a discussion.
     * @param {string} discussionId Discussion ID to delete.
     * @returns {Promise<boolean>} Whether the discussion was deleted.
     */
    async deleteDiscussion(discussionId) {
        const [result] = await this.db.query("DELETE FROM discussions WHERE id = ?", [discussionId]);
        return result.affectedRows > 0;
    }

    /**
     * Gets all messages in a discussion.
     * @param {string} discussionId Discussion ID whose messages should be returned.
     * @returns {Promise<DiscussionMessage[]>} Discussion messages ordered by creation date.
     */
    async getMessages(discussionId) {
        const [rows] = await this.db.query(`
            SELECT id, discussion_id, author, text, created_at
            FROM discussion_messages
            WHERE discussion_id = ?
            ORDER BY created_at ASC
        `, [discussionId]);
        return rows.map((row) => new DiscussionMessage(this, row));
    }

    /**
     * Creates a discussion message.
     * @param {Object} messageData Message data to insert.
     * @returns {Promise<DiscussionMessage>} The created message.
     */
    async createMessage(messageData) {
        const id = messageData.id || randomUUID();
        await this.db.query(`
            INSERT INTO discussion_messages (id, discussion_id, author, text)
            VALUES (?, ?, ?, ?)
        `, [
            id,
            messageData.discussion_id ?? messageData.discussionId,
            messageData.author,
            messageData.text,
        ]);
        const [rows] = await this.db.query(
            `SELECT id, discussion_id, author, text, created_at
             FROM discussion_messages
             WHERE id = ?`,
            [id],
        );
        return new DiscussionMessage(this, rows[0]);
    }


    async getMessageById(messageId) {
        const [rows] = await this.db.query(`
            SELECT id, discussion_id, author, text, created_at
            FROM discussion_messages
            WHERE id = ?
        `, [messageId]);
        return rows.length ? new DiscussionMessage(this, rows[0]) : null;
    }

    /**
     * Deletes a discussion message.
     * @param {string} messageId Message ID to delete.
     * @returns {Promise<boolean>} Whether the message was deleted.
     */
    async deleteMessage(messageId) {
        const [result] = await this.db.query(
            "DELETE FROM discussion_messages WHERE id = ?",
            [messageId],
        );
        return result.affectedRows > 0;
    }

    /**
     * Creates a router for discussion-related endpoints.
     * @returns {express.Router} Router for discussion-related endpoints.
     */
    createRouter() {
        return DiscussionsRouter.createRouter(this);
    }
}

class DiscussionsRouter {
    static createRouter(discussionsManager) {
        const router = express.Router();

        /**
         * GET /all
         * Retrieves all discussions.
         */
        router.get("/all", async (req, res) => {
            try {
                res.json(await discussionsManager.getDiscussions());

            } catch (error) {
                console.error("Error fetching discussions:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * GET /:id
         * @param {string} id - The ID of the discussion to retrieve.
         * Retrieves a discussion by its ID.
         */
        router.get("/:id", async (req, res) => {
            try {
                const discussion = await discussionsManager.findDiscussionById(req.params.id);
                if (!discussion) return res.status(404).json({ error: "Discussion not found" });
                res.json(discussion);

            } catch (error) {
                console.error(`Error fetching discussion ${req.params.id}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * POST /create
         * @body {Object} discussionData - The data for the new discussion.
         * Creates a discussion owned by the authenticated user.
         */
        router.post("/create", validateJsonBody({
            title: { type: "string", required: true, maxLength: 200 },
        }), async (req, res) => {
            try {
                res.status(201).json(await discussionsManager.createDiscussion({
                    ...req.body,
                    owner: req.user.username,
                }));

            } catch (error) {
                console.error("Error creating discussion:", error);
                res.status(400).json({ error: "Error creating discussion" });
            }
        });

        /**
         * PUT /:id/update
         * @param {string} id - The ID of the discussion to update.
         * @body {Object} updatedData - The fields to update.
         * Updates a discussion. Only its owner or an admin can perform this action.
         */
        router.put("/:id/update", validateRequest({
            params: { id: { type: "identifier" } },
            body: {
                required: true,
                nonEmpty: true,
                fields: {
                    title: { type: "string", maxLength: 200 },
                    owner: { type: "string", maxLength: 50 },
                    owner_username: { type: "string", maxLength: 50 },
                },
            },
        }), async (req, res) => {
            try {
                const discussion = await discussionsManager.findDiscussionById(req.params.id);
                if(req.user.username !== discussion?.owner && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }

                const updatedDiscussion = await discussionsManager.updateDiscussion(req.params.id, req.body);
                if (!updatedDiscussion) return res.status(404).json({ error: "Discussion not found" });
                res.json(updatedDiscussion);

            } catch (error) {
                console.error(`Error updating discussion ${req.params.id}:`, error);
                res.status(400).json({ error: "Error updating discussion" });
            }
        });

        /**
         * DELETE /:id/delete
         * @param {string} id - The ID of the discussion to delete.
         * Deletes a discussion. Only its owner or an admin can perform this action.
         */
        router.delete("/:id/delete", validateRequest({
            params: { id: { type: "identifier" } },
        }), async (req, res) => {
            try {
                const discussion = await discussionsManager.findDiscussionById(req.params.id);
                if(req.user.username !== discussion?.owner && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }

                if (!await discussionsManager.deleteDiscussion(req.params.id)) {
                    return res.status(404).json({ error: "Discussion not found" });
                }
                res.json({ message: "Discussion deleted successfully" });

            } catch (error) {
                console.error(`Error deleting discussion ${req.params.id}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * GET /:id/messages
         * @param {string} id - The ID of the discussion.
         * Retrieves all messages in a discussion.
         */
        router.get("/:id/messages", async (req, res) => {
            try {
                if (!await discussionsManager.findDiscussionById(req.params.id)) {
                    return res.status(404).json({ error: "Discussion not found" });
                }
                res.json(await discussionsManager.getMessages(req.params.id));

            } catch (error) {
                console.error(`Error fetching messages for discussion ${req.params.id}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * POST /:id/messages
         * @param {string} id - The ID of the discussion.
         * @body {Object} messageData - The data for the new message.
         * Creates a message in a discussion.
         */
        router.post("/:id/messages", validateRequest({
            params: { id: { type: "identifier" } },
            body: {
                required: true,
                fields: { text: { type: "string", required: true } },
            },
        }), async (req, res) => {
            try {
                if (!await discussionsManager.findDiscussionById(req.params.id)) {
                    return res.status(404).json({ error: "Discussion not found" });
                }
                res.status(201).json(await discussionsManager.createMessage({
                    ...req.body,
                    discussion_id: req.params.id,
                    author: req.user.username,
                }));

            } catch (error) {
                console.error(`Error creating message for discussion ${req.params.id}:`, error);
                res.status(400).json({ error: "Error creating message" });
            }
        });

        /**
         * DELETE /:id/messages/:messageId
         * @param {string} id - The ID of the discussion.
         * @param {string} messageId - The ID of the message to delete.
         * Deletes a message. Only its author or an admin can perform this action.
         */
        router.delete("/:id/messages/:messageId", validateRequest({
            params: {
                id: { type: "identifier" },
                messageId: { type: "identifier" },
            },
        }), async (req, res) => {
            try {
                const message = await discussionsManager.getMessageById(req.params.messageId);
                if (!message) {
                    return res.status(404).json({ error: "Message not found" });
                }

                if(message.discussion_id !== req.params.id) {
                    return res.status(400).json({ error: "Message does not belong to the specified discussion" });
                }

                if(req.user.username !== message.author && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }

                if (!await discussionsManager.findDiscussionById(req.params.id)) {
                    return res.status(404).json({ error: "Discussion not found" });
                }
                if (!await discussionsManager.deleteMessage(req.params.messageId)) {
                    return res.status(404).json({ error: "Message not found" });
                }
                res.json({ message: "Message deleted successfully" });
                
            } catch (error) {
                console.error(`Error deleting message ${req.params.messageId}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        return router;
    }
}

module.exports = { Discussion, DiscussionMessage, DiscussionsManager };
