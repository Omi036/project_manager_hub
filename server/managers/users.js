class User {
    constructor(usersManager, {
        username, nick, role, discord_id, avatar_url, created_at,
    }) {
        this.usersManager = usersManager;
        this.username = username;
        this.nick = nick;
        this.role = role;
        this.discord_id = discord_id;
        this.avatar_url = avatar_url;
        this.created_at = created_at;
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
        const [rows] = await this.db.query(`
            SELECT username, nick, role, discord_id, avatar_url, created_at
            FROM users
            ORDER BY nick
        `);
        return rows.map((row) => new User(this, row));
    }

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

    async findUserByUsername(username) {
        const [rows] = await this.db.query(`
            SELECT username, nick, role, discord_id, avatar_url, created_at
            FROM users
            WHERE username = ?
        `, [username]);
        return rows.length ? new User(this, rows[0]) : null;
    }

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

    async deleteUser(username) {
        const [result] = await this.db.query("DELETE FROM users WHERE username = ?", [username]);
        return result.affectedRows > 0;
    }
}

module.exports = { User, UsersManager };
