const { randomUUID } = require("node:crypto");

class Project {
    /**
     * Creates a project model backed by a projects manager.
     * @param {ProjectsManager} projectsManager Manager used for project operations.
     * @param {Object} data Project data returned by the database.
     */
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

    /** @returns {string[]} The project's tags. */
    getTags() { return this.tags }
    /** @returns {Promise<Object[]>} The project's collaborators. */
    getCollaborators() { return this.projectsManager.getProjectCollaborators(this.id) }
    /** @returns {Promise<Object[]>} The project's funding entries. */
    getFunding() { return this.projectsManager.getProjectFunding(this.id) }
    /** @returns {Promise<Object|null>} The project's owner, if found. */
    getOwnerUser() { return this.projectsManager.getProjectOwner(this.owner_username)}

    /**
     * Checks whether a username belongs to the project owner.
     * @param {string} username Username to compare.
     * @returns {boolean} Whether the username is the owner.
     */
    userIsOwner(username) { return this.owner_username === username }

    /**
     * Updates this project.
     * @param {Object} updatedData Fields to update.
     * @returns {Promise<Project|null>} The updated project, or null if it does not exist.
     */
    update(updatedData) { return this.projectsManager.updateProject(this.id, updatedData) }
    /** @returns {Promise<boolean>} Whether the project was deleted. */
    delete() { return this.projectsManager.deleteProject(this.id)}
}


class ProjectsManager {
    /**
     * Creates a projects manager.
     * @param {Object} db Database pool or connection.
     */
    constructor(db) {
        this.db = db;
    }

    /** @returns {Promise<Project[]>} All projects ordered by creation date. */
    async getProjects() {
        const [rows] = await this.db.query(`
            SELECT id, title, icon, icon_color, status, description,
                   tags, owner_name, owner_username, created_at, created_by
            FROM projects
            ORDER BY created_at DESC
        `);

        return rows.map((row) => new Project(this, row));
    }

    /**
     * Creates a project and its related collaborators and funding entries.
     * @param {Object} projectData Project data to insert.
     * @returns {Promise<Project>} The created project.
     */
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

    /**
     * Finds a project by ID.
     * @param {string} projectId Project ID to find.
     * @param {Object} [db=this.db] Database pool or connection to query.
     * @returns {Promise<Project|null>} The matching project, or null.
     */
    async findProjectById(projectId, db = this.db) {
        const [rows] = await db.query(`
            SELECT id, title, icon, icon_color, status, description,
                   tags, owner_name, owner_username, created_at, created_by
            FROM projects
            WHERE id = ?
        `, [projectId]);

        return rows.length ? new Project(this, rows[0]) : null;
    }

    /**
     * Updates a project and any supplied related data.
     * @param {string} projectId Project ID to update.
     * @param {Object} updatedData Fields and relations to update.
     * @returns {Promise<Project|null>} The updated project, or null if it does not exist.
     */
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

    /**
     * Deletes a project and its related collaborators and funding entries.
     * @param {string} projectId Project ID to delete.
     * @returns {Promise<boolean>} Whether the project was deleted.
     */
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

    /**
     * Gets the collaborators for a project.
     * @param {string} projectId Project ID whose collaborators should be returned.
     * @returns {Promise<Object[]>} Project collaborators.
     */
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

    /**
     * Gets the funding entries for a project.
     * @param {string} projectId Project ID whose funding should be returned.
     * @returns {Promise<Object[]>} Project funding entries.
     */
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

    /**
     * Finds a user by username to use as the project owner.
     * @param {string} username Owner username.
     * @returns {Promise<Object|null>} The owner user, or null when no username or user exists.
     */
    async getProjectOwner(username) {
        if (!username) return null;

        const [rows] = await this.db.query(
            "SELECT username, nick, role, discord_id, avatar_url, created_at FROM users WHERE username = ?",
            [username],
        );
        return rows[0] || null;
    }


    /**
     * Replaces supplied collaborator and funding relations for a project.
     * @param {string} projectId Project ID whose relations should be replaced.
     * @param {Object} projectData Data containing optional collaborator and funding arrays.
     * @param {Object} [db=this.db] Database pool or connection to query.
     * @returns {Promise<void>}
     */
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


    /**
     * Serializes tags into the database representation.
     * @param {string|string[]} tags Tags to serialize.
     * @returns {string} Comma-separated tags.
     */
    _serializeTags(tags) {
        const values = Array.isArray(tags) ? tags : String(tags || "").split(",");
        return values.map((tag) => String(tag).trim()).filter(Boolean).join(", ");
    }

    /**
     * Validates that a required project field is present.
     * @param {*} value Field value to validate.
     * @param {string} fieldName Field name used in the error message.
     * @returns {*} The validated value.
     * @throws {TypeError} If the value is null or undefined.
     */
    _requiredField(value, fieldName) {
        if (value === undefined || value === null) {
            throw new TypeError(`Project ${fieldName} is required`);
        }
        return value;
    }
}

module.exports = { Project, ProjectsManager };