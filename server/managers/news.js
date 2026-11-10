const { randomUUID } = require("node:crypto");

class News {
    constructor(newsManager, {
        id, title, description, banner, created_by, created_at,
    }) {
        this.newsManager = newsManager;
        this.id = id;
        this.title = title;
        this.description = description;
        this.banner = banner;
        this.created_by = created_by;
        this.created_at = created_at;
    }

    update(updatedData) {
        return this.newsManager.updateNews(this.id, updatedData);
    }

    delete() {
        return this.newsManager.deleteNews(this.id);
    }
}

class NewsManager {
    constructor(db) {
        this.db = db;
    }

    async getNews() {
        const [rows] = await this.db.query(`
            SELECT id, title, description, banner, created_by, created_at
            FROM news
            ORDER BY created_at DESC
        `);
        return rows.map((row) => new News(this, row));
    }

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

    async findNewsById(newsId) {
        const [rows] = await this.db.query(`
            SELECT id, title, description, banner, created_by, created_at
            FROM news
            WHERE id = ?
        `, [newsId]);
        return rows.length ? new News(this, rows[0]) : null;
    }

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

    async deleteNews(newsId) {
        const [result] = await this.db.query("DELETE FROM news WHERE id = ?", [newsId]);
        return result.affectedRows > 0;
    }
}

module.exports = { News, NewsManager };
