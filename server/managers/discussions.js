const { randomUUID } = require("node:crypto");

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
}

module.exports = { Discussion, DiscussionMessage, DiscussionsManager };
