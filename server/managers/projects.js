const { randomUUID } = require("node:crypto");

class Project {
    constructor(projectsManager, { id, title, icon, icon_color, status, description, tags, owner_name, owner_username, created_at, created_by }) {
        this.projectsManager = projectsManager;

        this.id = id;
        this.title = title;
        this.icon = icon;
        this.icon_color = icon_color;
        this.status = status;
        this.description = description;
        this.tags = tags ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
        this.owner_name = owner_name;
        this.owner_username = owner_username;
        this.created_at = created_at;
        this.created_by = created_by;
    }

    getTags() { return this.tags }
    getCollaborators() { return this.projectsManager.getProjectCollaborators(this.id) }
    getFunding() { return this.projectsManager.getProjectFunding(this.id) }
    getOwnerUser() { return this.projectsManager.getProjectOwner(this.owner_username)}

    userIsOwner(username) { return this.owner_username === username }

    update(updatedData) { return this.projectsManager.updateProject(this.id, updatedData) }
    delete() { return this.projectsManager.deleteProject(this.id)}
}


class ProjectsManager {
    constructor(db) {
        this.db = db;
    }

    async getProjects() {
        const [rows] = await this.db.query(`
            SELECT id, title, icon, icon_color, status, description,
                   tags, owner_name, owner_username, created_at, created_by
            FROM projects
            ORDER BY created_at DESC
        `);

        return rows.map((row) => new Project(this, row));
    }

    async createProject(projectData) {
        const id = projectData.id || randomUUID();
        const title = this._requiredField(projectData.title, "title");
        const description = this._requiredField(projectData.description ?? projectData.desc, "description");
        const ownerName = this._requiredField(projectData.owner_name ?? projectData.owner, "owner_name");
        const connection = await this.db.getConnection();

        try {
            await connection.beginTransaction();
            await connection.query(`
                INSERT INTO projects (
                    id, title, icon, icon_color, status, description,
                    tags, owner_name, owner_username, created_by
                )
                VALUES (?, ?, COALESCE(?, 'tabler:rocket'),
                        COALESCE(?, '#2d4ca3'), COALESCE(?, 'Ideado'),
                        COALESCE(?, ''), ?, ?, ?, ?)
            `, [
                id,
                title,
                projectData.icon ?? null,
                projectData.icon_color ?? projectData.iconColor ?? null,
                projectData.status ?? null,
                description,
                this._serializeTags(projectData.tags),
                ownerName,
                projectData.owner_username ?? null,
                projectData.created_by ?? projectData.createdBy ?? null,
            ]);

            await this._replaceProjectRelations(id, projectData, connection);
            await connection.commit();
            return this.findProjectById(id, connection);

        } catch (error) {
            await connection.rollback();
            throw error;

        } finally {
            connection.release();
        }
    }

    async findProjectById(projectId, db = this.db) {
        const [rows] = await db.query(`
            SELECT id, title, icon, icon_color, status, description,
                   tags, owner_name, owner_username, created_at, created_by
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
            tags: updatedData.tags === undefined ? undefined : this._serializeTags(updatedData.tags),
            owner_name: updatedData.owner_name ?? updatedData.owner,
            owner_username: updatedData.owner_username ?? updatedData.ownerUsername,
            created_by: updatedData.created_by ?? updatedData.createdBy,
        };

        const columnNames = {
            title: "title",
            icon: "icon",
            icon_color: "icon_color",
            status: "status",
            description: "description",
            tags: "tags",
            owner_name: "owner_name",
            owner_username: "owner_username",
            created_by: "created_by",
        };
        const updates = Object.entries(fields).filter(([, value]) => value !== undefined);

        const project = await this.findProjectById(projectId);
        if (!project) return null;

        const connection = await this.db.getConnection();

        try {
            await connection.beginTransaction();
            if (updates.length) {
                const values = updates.map(([, value]) => value);
                const assignments = updates.map(([field]) => `${columnNames[field]} = ?`);
                await connection.query(`
                    UPDATE projects
                    SET ${assignments.join(", ")}
                    WHERE id = ?
                `, [...values, projectId]);
            }

            await this._replaceProjectRelations(projectId, updatedData, connection);
            await connection.commit();
            return this.findProjectById(projectId, connection);

        } catch (error) {
            await connection.rollback();
            throw error;

        } finally {
            connection.release();
        }
    }

    async deleteProject(projectId) {
        const connection = await this.db.getConnection();

        try {
            await connection.beginTransaction();
            await connection.query("DELETE FROM project_collaborators WHERE project_id = ?", [projectId]);
            await connection.query("DELETE FROM project_funding WHERE project_id = ?", [projectId]);
            const [result] = await connection.query("DELETE FROM projects WHERE id = ?", [projectId]);
            await connection.commit();
            return result.affectedRows > 0;

        } catch (error) {
            await connection.rollback();
            throw error;

        } finally {
            connection.release();
        }
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


    // Updates the collaborators and funding relations for a project
    async _replaceProjectRelations(projectId, projectData, db = this.db) {
        // Handle collaborators
        if (projectData.collabs !== undefined || projectData.collaborators !== undefined) {
            const collaborators = projectData.collabs ?? projectData.collaborators ?? [];
            if (!Array.isArray(collaborators)) {
                throw new TypeError("Project collaborators must be an array");
            }
            

            await db.query("DELETE FROM project_collaborators WHERE project_id = ?", [projectId]);
            for (const collaborator of collaborators) {
                if (!collaborator || (typeof collaborator !== "string" && typeof collaborator.name !== "string")) {
                    throw new TypeError("Each project collaborator must have a name");
                }
                const name = typeof collaborator === "string" ? collaborator : collaborator.name;
                const username = typeof collaborator === "string" ? null : collaborator.username ?? null;
                await db.query(
                    `INSERT INTO project_collaborators
                        (project_id, collaborator_name, collaborator_username)
                     VALUES (?, ?, ?)`,
                    [projectId, name, username],
                );
            }
        }

        // Handle funding
        if (projectData.funding !== undefined) {
            if (!Array.isArray(projectData.funding)) {
                throw new TypeError("Project funding must be an array");
            }


            await db.query("DELETE FROM project_funding WHERE project_id = ?", [projectId]);
            for (const funding of projectData.funding) {
                if (!funding || typeof funding !== "object") {
                    throw new TypeError("Each project funding entry must be an object");
                }

                await db.query(
                    `INSERT INTO project_funding
                        (project_id, contributor, contribution)
                     VALUES (?, ?, ?)`,
                    [projectId, funding.who ?? funding.contributor ?? "", funding.what ?? funding.contribution ?? ""],
                );
            }
        }
    }


    // Joins an array of tags into a comma-separated string
    _serializeTags(tags) {
        const values = Array.isArray(tags) ? tags : String(tags || "").split(",");
        return values.map((tag) => String(tag).trim()).filter(Boolean).join(", ");
    }

    // Validates that a required field is present and not null or undefined
    _requiredField(value, fieldName) {
        if (value === undefined || value === null) {
            throw new TypeError(`Project ${fieldName} is required`);
        }
        return value;
    }
}

module.exports = { Project, ProjectsManager };