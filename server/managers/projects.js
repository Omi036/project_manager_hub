const { randomUUID } = require("node:crypto");

class Project {
    constructor(projectsManager, { id, title, icon, icon_color, status, description, owner_name, owner_username, created_at, created_by }) {
        this.projectsManager = projectsManager;

        this.id = id;
        this.title = title;
        this.icon = icon;
        this.icon_color = icon_color;
        this.status = status;
        this.description = description;
        this.owner_name = owner_name;
        this.owner_username = owner_username;
        this.created_at = created_at;
        this.created_by = created_by;
    }

    getTags() {
        return this.projectsManager.getProjectTags(this.id);
    }

    getCollaborators() {
        return this.projectsManager.getProjectCollaborators(this.id);
    }

    getFunding() {
        return this.projectsManager.getProjectFunding(this.id);
    }

    getOwnerUser() {
        return this.projectsManager.getProjectOwner(this.owner_username);
    }

    userIsOwner(username) {
        return this.owner_username === username;
    }

    update(updatedData) {
        return this.projectsManager.updateProject(this.id, updatedData);
    }

    delete() {
        return this.projectsManager.deleteProject(this.id);
    }
}


class ProjectsManager {
    constructor(db) {
        this.db = db;
    }

    async getProjects() {
        const [rows] = await this.db.query(`
            SELECT id, title, icon, icon_color, status, description,
                   owner_name, owner_username, created_at, created_by
            FROM projects
            ORDER BY created_at DESC
        `);

        return rows.map((row) => new Project(this, row));
    }

    async createProject(projectData) {
        const id = projectData.id || randomUUID();
        await this.db.query(`
            INSERT INTO projects (
                id, title, icon, icon_color, status, description,
                owner_name, owner_username, created_by
            )
            VALUES (?, ?, COALESCE(?, 'tabler:rocket'),
                    COALESCE(?, '#2d4ca3'), COALESCE(?, 'Ideado'),
                    COALESCE(?, ''), ?, ?, ?)
        `, [
            id,
            projectData.title,
            projectData.icon,
            projectData.icon_color ?? projectData.iconColor,
            projectData.status,
            projectData.description ?? projectData.desc,
            projectData.owner_name ?? projectData.owner,
            projectData.owner_username ?? null,
            projectData.created_by ?? projectData.createdBy ?? null,
        ]);

        await this._replaceProjectRelations(id, projectData);
        return this.findProjectById(id);
    }

    async findProjectById(projectId) {
        const [rows] = await this.db.query(`
            SELECT id, title, icon, icon_color, status, description,
                   owner_name, owner_username, created_at, created_by
            FROM projects
            WHERE id = ?
        `, [projectId]);

        return rows.length ? new Project(this, rows[0]) : null;
    }

    async updateProject(projectId, updatedData) {
        const fields = {
            title: updatedData.title,
            icon: updatedData.icon,
            icon_color: updatedData.icon_color ?? updatedData.iconColor,
            status: updatedData.status,
            description: updatedData.description ?? updatedData.desc,
            owner_name: updatedData.owner_name ?? updatedData.owner,
            owner_username: updatedData.owner_username,
            created_by: updatedData.created_by ?? updatedData.createdBy,
        };
        const columnNames = {
            title: "title",
            icon: "icon",
            icon_color: "icon_color",
            status: "status",
            description: "description",
            owner_name: "owner_name",
            owner_username: "owner_username",
            created_by: "created_by",
        };
        const updates = Object.entries(fields).filter(([, value]) => value !== undefined);
        let project;

        if (updates.length) {
            const values = updates.map(([, value]) => value);
            const assignments = updates.map(([field]) => `${columnNames[field]} = ?`);
            const [result] = await this.db.query(`
                UPDATE projects
                SET ${assignments.join(", ")}
                WHERE id = ?
            `, [...values, projectId]);
            project = result.affectedRows ? await this.findProjectById(projectId) : null;
        } else {
            project = await this.findProjectById(projectId);
        }

        if (!project) return null;
        await this._replaceProjectRelations(projectId, updatedData);
        return project;
    }

    async deleteProject(projectId) {
        const [result] = await this.db.query("DELETE FROM projects WHERE id = ?", [projectId]);
        return result.affectedRows > 0;
    }

    async getProjectTags(projectId) {
        const [rows] = await this.db.query(`
            SELECT tag
            FROM project_tags
            WHERE project_id = ?
            ORDER BY tag
        `, [projectId]);
        return rows.map(({ tag }) => tag);
    }

    async getProjectCollaborators(projectId) {
        const [rows] = await this.db.query(`
            SELECT collaborator_name, collaborator_username
            FROM project_collaborators
            WHERE project_id = ?
            ORDER BY collaborator_name
        `, [projectId]);
        return rows.map(({ collaborator_name, collaborator_username }) => ({
            name: collaborator_name,
            username: collaborator_username,
        }));
    }

    async getProjectFunding(projectId) {
        const [rows] = await this.db.query(`
            SELECT id, contributor, contribution
            FROM project_funding
            WHERE project_id = ?
            ORDER BY id
        `, [projectId]);
        return rows.map(({ id, contributor, contribution }) => ({
            id,
            who: contributor,
            what: contribution,
        }));
    }

    async getProjectOwner(username) {
        if (!username) return null;
        const [rows] = await this.db.query(
            "SELECT username, nick, role, discord_id, avatar_url, created_at FROM users WHERE username = ?",
            [username],
        );
        return rows[0] || null;
    }

    async _replaceProjectRelations(projectId, projectData) {
        if (projectData.tags !== undefined) {
            await this.db.query("DELETE FROM project_tags WHERE project_id = ?", [projectId]);
            for (const tag of projectData.tags || []) {
                await this.db.query(
                    "INSERT INTO project_tags (project_id, tag) VALUES (?, ?)",
                    [projectId, tag],
                );
            }
        }

        if (projectData.collabs !== undefined || projectData.collaborators !== undefined) {
            const collaborators = projectData.collabs ?? projectData.collaborators ?? [];
            await this.db.query("DELETE FROM project_collaborators WHERE project_id = ?", [projectId]);
            for (const collaborator of collaborators) {
                const name = typeof collaborator === "string" ? collaborator : collaborator.name;
                const username = typeof collaborator === "string" ? null : collaborator.username ?? null;
                await this.db.query(
                    `INSERT INTO project_collaborators
                        (project_id, collaborator_name, collaborator_username)
                     VALUES (?, ?, ?)`,
                    [projectId, name, username],
                );
            }
        }

        if (projectData.funding !== undefined) {
            await this.db.query("DELETE FROM project_funding WHERE project_id = ?", [projectId]);
            for (const funding of projectData.funding || []) {
                await this.db.query(
                    `INSERT INTO project_funding
                        (project_id, contributor, contribution)
                     VALUES (?, ?, ?)`,
                    [projectId, funding.who ?? funding.contributor ?? "", funding.what ?? funding.contribution ?? ""],
                );
            }
        }
    }
}

module.exports = { Project, ProjectsManager };