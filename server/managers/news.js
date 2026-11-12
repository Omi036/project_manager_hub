const { randomUUID } = require("node:crypto");
const express = require("express");
const { validateJsonBody, validateRequest } = require("../validation");

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

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            banner: this.banner,
            created_by: this.created_by,
            created_at: this.created_at,
        };
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

    /**
     * Creates a router for news-related endpoints.
     * @returns {express.Router} Router for news-related endpoints.
     */
    createRouter() {
        return NewsRouter.createRouter(this);
    }
}

class NewsRouter {
    static createRouter(newsManager) {
        const router = express.Router();

        /**
         * GET /all
         * Retrieves all news items.
         */
        router.get("/all", async (req, res) => {
            try {
                res.json(await newsManager.getNews());

            } catch (error) {
                console.error("Error fetching news:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * GET /:id
         * @param {string} id - The ID of the news item to retrieve.
         * Retrieves a news item by its ID.
         */
        router.get("/:id", validateRequest({
            params: { id: { type: "identifier" } },
        }), async (req, res) => {
            try {
                const news = await newsManager.findNewsById(req.params.id);
                if (!news) return res.status(404).json({ error: "News item not found" });
                res.json(news);

            } catch (error) {
                console.error(`Error fetching news item ${req.params.id}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * POST /create
         * @body {Object} newsData - The data for the new news item.
         * Creates a news item. Only admins can perform this action.
         */
        router.post("/create", validateJsonBody({
            title: { type: "string", required: true, maxLength: 200 },
            description: { type: "string", maxLength: 65535 },
            desc: { type: "string", maxLength: 65535 },
            banner: { type: "string", maxLength: 65535 },
        }), async (req, res) => {
            try {
                if(req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden: Only admins can create news items." });
                }

                res.status(201).json(await newsManager.createNews({
                    ...req.body,
                    created_by: req.user.username,
                }));

            } catch (error) {
                console.error("Error creating news:", error);
                res.status(400).json({ error: "Error creating news item" });
            }
        });

        /**
         * PUT /:id/update
         * @param {string} id - The ID of the news item to update.
         * @body {Object} updatedData - The fields to update.
         * Updates a news item. Only admins can perform this action.
         */
        router.put("/:id/update", validateRequest({
            params: { id: { type: "identifier" } },
            body: {
                required: true,
                nonEmpty: true,
                fields: {
                    title: { type: "string", maxLength: 200 },
                    description: { type: "string", maxLength: 65535 },
                    desc: { type: "string", maxLength: 65535 },
                    banner: { type: "string", maxLength: 65535 },
                    created_by: { type: "string", maxLength: 50 },
                    createdBy: { type: "string", maxLength: 50 },
                },
            },
        }), async (req, res) => {
            try {
                if(req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden: Only admins can update news items." });
                }

                const news = await newsManager.updateNews(req.params.id, req.body);
                if (!news) return res.status(404).json({ error: "News item not found" });
                res.json(news);

            } catch (error) {
                console.error(`Error updating news item ${req.params.id}:`, error);
                res.status(400).json({ error: "Error updating news item" });
            }
        });

        /**
         * DELETE /:id/delete
         * @param {string} id - The ID of the news item to delete.
         * Deletes a news item. Only admins can perform this action.
         */
        router.delete("/:id/delete", validateRequest({
            params: { id: { type: "identifier" } },
        }), async (req, res) => {
            try {
                if(req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden: Only admins can delete news items." });
                }

                if (!await newsManager.deleteNews(req.params.id)) {
                    return res.status(404).json({ error: "News item not found" });
                }
                res.json({ message: "News item deleted successfully" });
                
            } catch (error) {
                console.error(`Error deleting news item ${req.params.id}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        return router;
    }
}

module.exports = { News, NewsManager };
