const { randomUUID } = require("node:crypto");

class DiscussionMessage {
    constructor(discussionsManager, {
        id, discussion_id, author, text, created_at,
    }) {
        this.discussionsManager = discussionsManager;
        this.id = id;
        this.discussion_id = discussion_id;
        this.author = author;
        this.text = text;
        this.created_at = created_at;
    }

    delete() {
        return this.discussionsManager.deleteMessage(this.id);
    }
}

class Discussion {
    constructor(discussionsManager, {
        id, title, owner, created_at,
    }) {
        this.discussionsManager = discussionsManager;
        this.id = id;
        this.title = title;
        this.owner = owner;
        this.created_at = created_at;
    }

    getMessages() {
        return this.discussionsManager.getMessages(this.id);
    }

    update(updatedData) {
        return this.discussionsManager.updateDiscussion(this.id, updatedData);
    }

    delete() {
        return this.discussionsManager.deleteDiscussion(this.id);
    }
}

class DiscussionsManager {
    constructor(db) {
        this.db = db;
    }

    async getDiscussions() {
        const result = await this.db.query(`
            SELECT id, title, owner, created_at
            FROM discussions
            ORDER BY created_at DESC
        `);
        return result.rows.map((row) => new Discussion(this, row));
    }

    async createDiscussion(discussionData) {
        const id = discussionData.id || randomUUID();
        const result = await this.db.query(`
            INSERT INTO discussions (id, title, owner)
            VALUES ($1, $2, $3)
            RETURNING id, title, owner, created_at
        `, [id, discussionData.title, discussionData.owner ?? discussionData.owner_username]);
        return new Discussion(this, result.rows[0]);
    }

    async findDiscussionById(discussionId) {
        const result = await this.db.query(`
            SELECT id, title, owner, created_at
            FROM discussions
            WHERE id = $1
        `, [discussionId]);
        return result.rows.length ? new Discussion(this, result.rows[0]) : null;
    }

    async updateDiscussion(discussionId, updatedData) {
        const fields = Object.entries({
            title: updatedData.title,
            owner: updatedData.owner ?? updatedData.owner_username,
        }).filter(([, value]) => value !== undefined);

        if (!fields.length) return this.findDiscussionById(discussionId);

        const assignments = fields.map(([field], index) => `${field} = $${index + 2}`);
        const result = await this.db.query(`
            UPDATE discussions
            SET ${assignments.join(", ")}
            WHERE id = $1
            RETURNING id, title, owner, created_at
        `, [discussionId, ...fields.map(([, value]) => value)]);
        return result.rows.length ? new Discussion(this, result.rows[0]) : null;
    }

    async deleteDiscussion(discussionId) {
        const result = await this.db.query("DELETE FROM discussions WHERE id = $1", [discussionId]);
        return result.rowCount > 0;
    }

    async getMessages(discussionId) {
        const result = await this.db.query(`
            SELECT id, discussion_id, author, text, created_at
            FROM discussion_messages
            WHERE discussion_id = $1
            ORDER BY created_at ASC
        `, [discussionId]);
        return result.rows.map((row) => new DiscussionMessage(this, row));
    }

    async createMessage(messageData) {
        const id = messageData.id || randomUUID();
        const result = await this.db.query(`
            INSERT INTO discussion_messages (id, discussion_id, author, text)
            VALUES ($1, $2, $3, $4)
            RETURNING id, discussion_id, author, text, created_at
        `, [
            id,
            messageData.discussion_id ?? messageData.discussionId,
            messageData.author,
            messageData.text,
        ]);
        return new DiscussionMessage(this, result.rows[0]);
    }

    async deleteMessage(messageId) {
        const result = await this.db.query(
            "DELETE FROM discussion_messages WHERE id = $1",
            [messageId],
        );
        return result.rowCount > 0;
    }
}

module.exports = { Discussion, DiscussionMessage, DiscussionsManager };
