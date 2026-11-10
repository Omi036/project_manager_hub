class User {
    constructor(usersManager, {
        username, nick, role, discord_id, created_at,
    }) {
        this.usersManager = usersManager;
        this.username = username;
        this.nick = nick;
        this.role = role;
        this.discord_id = discord_id;
        this.created_at = created_at;
    }

    getSettings() {
        return this.usersManager.getUserSettings(this.username);
    }

    update(updatedData) {
        return this.usersManager.updateUser(this.username, updatedData);
    }

    delete() {
        return this.usersManager.deleteUser(this.username);
    }
}

class UsersManager {
    constructor(db) {
        this.db = db;
    }

    async getUsers() {
        const result = await this.db.query(`
            SELECT username, nick, role, discord_id, created_at
            FROM users
            ORDER BY nick
        `);
        return result.rows.map((row) => new User(this, row));
    }

    async createUser(userData) {
        const result = await this.db.query(`
            INSERT INTO users (username, nick, role, discord_id)
            VALUES ($1, $2, COALESCE($3, 'member'), $4)
            RETURNING username, nick, role, discord_id, created_at
        `, [
            userData.username,
            userData.nick,
            userData.role,
            userData.discord_id ?? userData.discordId ?? null,
        ]);
        return new User(this, result.rows[0]);
    }

    async findUserByUsername(username) {
        const result = await this.db.query(`
            SELECT username, nick, role, discord_id, created_at
            FROM users
            WHERE username = $1
        `, [username]);
        return result.rows.length ? new User(this, result.rows[0]) : null;
    }

    async updateUser(username, updatedData) {
        const fields = Object.entries({
            nick: updatedData.nick,
            role: updatedData.role,
            discord_id: updatedData.discord_id ?? updatedData.discordId,
        }).filter(([, value]) => value !== undefined);

        if (!fields.length) return this.findUserByUsername(username);

        const assignments = fields.map(([field], index) => `${field} = $${index + 2}`);
        const result = await this.db.query(`
            UPDATE users
            SET ${assignments.join(", ")}
            WHERE username = $1
            RETURNING username, nick, role, discord_id, created_at
        `, [username, ...fields.map(([, value]) => value)]);
        return result.rows.length ? new User(this, result.rows[0]) : null;
    }

    async deleteUser(username) {
        const result = await this.db.query("DELETE FROM users WHERE username = $1", [username]);
        return result.rowCount > 0;
    }

    async getUserSettings(username) {
        const result = await this.db.query(`
            SELECT username, theme, accent, show_stats, show_news
            FROM user_settings
            WHERE username = $1
        `, [username]);
        return result.rows[0] || null;
    }

    async updateUserSettings(username, settings) {
        const result = await this.db.query(`
            INSERT INTO user_settings (username, theme, accent, show_stats, show_news)
            VALUES ($1, COALESCE($2, 'light'), COALESCE($3, 'blue'),
                    COALESCE($4, TRUE), COALESCE($5, TRUE))
            ON CONFLICT (username) DO UPDATE SET
                theme = COALESCE($2, user_settings.theme),
                accent = COALESCE($3, user_settings.accent),
                show_stats = COALESCE($4, user_settings.show_stats),
                show_news = COALESCE($5, user_settings.show_news)
            RETURNING username, theme, accent, show_stats, show_news
        `, [
            username,
            settings.theme,
            settings.accent,
            settings.show_stats,
            settings.show_news,
        ]);
        return result.rows[0];
    }
}

module.exports = { User, UsersManager };
