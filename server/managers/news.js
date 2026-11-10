const { randomUUID } = require("node:crypto");

class News {
    /**
     * Creates a news model backed by a news manager.
     * @param {NewsManager} newsManager Manager used for news operations.
     * @param {Object} data News data returned by the database.
     */
    constructor(newsManager, {id, title, description, banner, created_by, created_at}) {
        this.newsManager = newsManager;
        this.id = id;
        this.title = title;
        this.description = description;
        this.banner = banner;
        this.created_by = created_by;
        this.created_at = created_at;
    }

    /**
     * Updates this news item.
     * @param {Object} updatedData Fields to update.
     * @returns {Promise<News|null>} The updated item, or null if it does not exist.
     */
    update(updatedData) { return this.newsManager.updateNews(this.id, updatedData) }
    /** @returns {Promise<boolean>} Whether the news item was deleted. */
    delete() { return this.newsManager.deleteNews(this.id) }
}

class NewsManager {
    /**
     * Creates a news manager.
     * @param {Object} db Database pool or connection.
     */
    constructor(db) {
        this.db = db;
    }

    /** @returns {Promise<News[]>} All news items ordered by creation date. */
    async getNews() {
        const [rows] = await this.db.query(`
            SELECT id, title, description, banner, created_by, created_at
            FROM news
            ORDER BY created_at DESC
        `);
        return rows.map((row) => new News(this, row));
    }

    /**
     * Creates a news item.
     * @param {Object} newsData News data to insert.
     * @returns {Promise<News>} The created news item.
     */
    async createNews(newsData) {
        const id = newsData.id || randomUUID();
        await this.db.query(`
            INSERT INTO news (id, title, description, banner, created_by)
            VALUES (?, ?, COALESCE(?, ''), COALESCE(?, ''), ?)
        `, [
            id,
            newsData.title,
            newsData.description ?? newsData.desc,
            newsData.banner,
            newsData.created_by ?? newsData.createdBy,
        ]);
        return this.findNewsById(id);
    }

    /**
     * Finds a news item by ID.
     * @param {string} newsId News item ID to find.
     * @returns {Promise<News|null>} The matching item, or null.
     */
    async findNewsById(newsId) {
        const [rows] = await this.db.query(`
            SELECT id, title, description, banner, created_by, created_at
            FROM news
            WHERE id = ?
        `, [newsId]);
        return rows.length ? new News(this, rows[0]) : null;
    }

    /**
     * Updates a news item.
     * @param {string} newsId News item ID to update.
     * @param {Object} updatedData Fields to update.
     * @returns {Promise<News|null>} The updated item, or null if it does not exist.
     */
    async updateNews(newsId, updatedData) {
        const fields = Object.entries({
            title: updatedData.title,
            description: updatedData.description ?? updatedData.desc,
            banner: updatedData.banner,
            created_by: updatedData.created_by ?? updatedData.createdBy,
        }).filter(([, value]) => value !== undefined);

        if (!fields.length) return this.findNewsById(newsId);

        const assignments = fields.map(([field]) => `${field} = ?`);
        const [result] = await this.db.query(`
            UPDATE news
            SET ${assignments.join(", ")}
            WHERE id = ?
        `, [...fields.map(([, value]) => value), newsId]);
        return result.affectedRows ? this.findNewsById(newsId) : null;
    }

    /**
     * Deletes a news item.
     * @param {string} newsId News item ID to delete.
     * @returns {Promise<boolean>} Whether the item was deleted.
     */
    async deleteNews(newsId) {
        const [result] = await this.db.query("DELETE FROM news WHERE id = ?", [newsId]);
        return result.affectedRows > 0;
    }
}

module.exports = { News, NewsManager };
