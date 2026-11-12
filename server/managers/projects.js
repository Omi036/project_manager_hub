const { randomUUID } = require("node:crypto");
const express = require("express");

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
    /** @returns {Promise<ProjectUpdate[]>} The project's updates. */
    getUpdates() { return this.projectsManager.getProjectUpdates(this.id) }
    /** @param {Object|string} collaborator Collaborator to add. */
    addCollaborator(collaborator) { return this.projectsManager.addProjectCollaborator(this.id, collaborator) }
    /** @param {string} collaboratorName Collaborator name to remove. */
    removeCollaborator(collaboratorName) { return this.projectsManager.removeProjectCollaborator(this.id, collaboratorName) }
    /** @param {Object} funding Funding entry to add. */
    addFunding(funding) { return this.projectsManager.addProjectFunding(this.id, funding) }
    /** @param {number|string} fundingId Funding entry ID to remove. */
    removeFunding(fundingId) { return this.projectsManager.removeProjectFunding(this.id, fundingId) }
    /** @returns {Promise<Object|null>} The project's owner, if found. */
    getOwnerUser() { return this.projectsManager.getProjectOwner(this.owner_username)}

    /**
     * Checks whether a username belongs to the project owner.
     * @param {string} username Username to compare.
     * @returns {boolean} Whether the username is the owner.
     */
    userIsOwner(username) { return this.owner_username === username }


    /**
     * Checks whether a username belongs to one of the project collaborators.
     * @param {string} username Username to check.
     * @returns {Promise<boolean>} Whether the username is a collaborator.
     */
    async userIsCollab(username) {
        const collaborators = await this.getCollaborators();
        return collaborators.some((collab) => collab.username === username);
    }


    /**
     * Checks whether a username belongs to the project owner or one of the collaborators.
     * @param {string} username Username to check.
     * @returns {Promise<boolean>} Whether the username is a member of the project.
     */
    async userIsMember(username) {
        if (this.userIsOwner(username)) return true;
        return this.userIsCollab(username);
    }

    /**
     * Updates this project.
     * @param {Object} updatedData Fields to update.
     * @returns {Promise<Project|null>} The updated project, or null if it does not exist.
     */
    update(updatedData) { return this.projectsManager.updateProject(this.id, updatedData) }
    /** @returns {Promise<boolean>} Whether the project was deleted. */
    delete() { return this.projectsManager.deleteProject(this.id)}
}

class ProjectUpdate {
    /**
     * Creates a project update model backed by a projects manager.
     * @param {ProjectsManager} projectsManager Manager used for update operations.
     * @param {Object} data Update data returned by the database.
     */
    constructor(projectsManager, { id, project_id, title, description, created_at }) {
        this.projectsManager = projectsManager;
        this.id = id;
        this.project_id = project_id;
        this.title = title;
        this.description = description;
        this.created_at = created_at;
    }

    /**
     * Updates this project update.
     * @param {Object} updatedData Fields to update.
     * @returns {Promise<ProjectUpdate|null>} The updated project update, or null if it does not exist.
     */
    update(updatedData) {
        return this.projectsManager.updateProjectUpdate(this.id, updatedData);
    }

    /**
     * Deletes this project update.
     * @returns {Promise<boolean>} Whether the project update was deleted.
     */
    delete() {
        return this.projectsManager.deleteProjectUpdate(this.id);
    }
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
     * Adds one collaborator to a project.
     * @param {string} projectId Project ID.
     * @param {Object|string} collaborator Collaborator name or data.
     * @returns {Promise<Object>} The added collaborator.
     */
    async addProjectCollaborator(projectId, collaborator) {
        const { name, username } = this._normalizeCollaborator(collaborator);
        const [result] = await this.db.query(
            `INSERT INTO project_collaborators
                (project_id, collaborator_name, collaborator_username)
             VALUES (?, ?, ?)`,
            [projectId, name, username],
        );
        return { name, username, projectId, added: result.affectedRows > 0 };
    }

    /**
     * Removes one collaborator from a project.
     * @param {string} projectId Project ID.
     * @param {string} collaboratorName Collaborator name.
     * @returns {Promise<boolean>} Whether a collaborator was removed.
     */
    async removeProjectCollaborator(projectId, collaboratorName) {
        const name = this._requiredField(collaboratorName, "collaborator name");
        const [result] = await this.db.query(
            "DELETE FROM project_collaborators WHERE project_id = ? AND collaborator_name = ?",
            [projectId, name],
        );
        return result.affectedRows > 0;
    }

    /**
     * Adds one funding entry to a project.
     * @param {string} projectId Project ID.
     * @param {Object} funding Funding data.
     * @returns {Promise<Object>} The added funding entry.
     */
    async addProjectFunding(projectId, funding) {
        const { contributor, contribution } = this._normalizeFunding(funding);
        const [result] = await this.db.query(
            `INSERT INTO project_funding
                (project_id, contributor, contribution)
             VALUES (?, ?, ?)`,
            [projectId, contributor, contribution],
        );
        return { id: result.insertId, who: contributor, what: contribution };
    }

    /**
     * Removes one funding entry from a project.
     * @param {string} projectId Project ID.
     * @param {number|string} fundingId Funding entry ID.
     * @returns {Promise<boolean>} Whether a funding entry was removed.
     */
    async removeProjectFunding(projectId, fundingId) {
        const id = this._requiredField(fundingId, "funding id");
        const [result] = await this.db.query(
            "DELETE FROM project_funding WHERE project_id = ? AND id = ?",
            [projectId, id],
        );
        return result.affectedRows > 0;
    }

    /**
     * Gets all updates for a project, ordered from newest to oldest.
     * @param {string} projectId Project ID whose updates should be returned.
     * @returns {Promise<ProjectUpdate[]>} Project updates.
     */
    async getProjectUpdates(projectId) {
        const [rows] = await this.db.query(`
            SELECT id, project_id, title, description, created_at
            FROM project_updates
            WHERE project_id = ?
            ORDER BY created_at DESC
        `, [projectId]);
        return rows.map((row) => new ProjectUpdate(this, row));
    }

    /**
     * Finds a project update by ID.
     * @param {string} updateId Project update ID to find.
     * @param {string} [projectId] Optional project ID used to scope the lookup.
     * @returns {Promise<ProjectUpdate|null>} The matching project update, or null.
     */
    async findProjectUpdateById(updateId, projectId) {
        const conditions = ["id = ?"];
        const values = [updateId];
        if (projectId !== undefined) {
            conditions.push("project_id = ?");
            values.push(projectId);
        }

        const [rows] = await this.db.query(`
            SELECT id, project_id, title, description, created_at
            FROM project_updates
            WHERE ${conditions.join(" AND ")}
        `, values);
        return rows.length ? new ProjectUpdate(this, rows[0]) : null;
    }

    /**
     * Creates a project update.
     * @param {string} projectId Project ID to update.
     * @param {Object} updateData Project update data to insert.
     * @returns {Promise<ProjectUpdate>} The created project update.
     */
    async createProjectUpdate(projectId, updateData) {
        const id = updateData.id || randomUUID();
        const title = this._requiredField(updateData.title, "title");
        const description = this._requiredField(
            updateData.description ?? updateData.desc,
            "description",
        );

        await this.db.query(`
            INSERT INTO project_updates (id, project_id, title, description)
            VALUES (?, ?, ?, ?)
        `, [id, projectId, title, description]);
        return this.findProjectUpdateById(id, projectId);
    }

    /**
     * Updates a project update.
     * @param {string} updateId Project update ID to update.
     * @param {Object} updatedData Fields to update.
     * @returns {Promise<ProjectUpdate|null>} The updated project update, or null if it does not exist.
     */
    async updateProjectUpdate(updateId, updatedData) {
        const fields = Object.entries({
            title: updatedData.title,
            description: updatedData.description ?? updatedData.desc,
        }).filter(([, value]) => value !== undefined);

        if (!fields.length) return this.findProjectUpdateById(updateId);

        const assignments = fields.map(([field]) => `${field} = ?`);
        const [result] = await this.db.query(`
            UPDATE project_updates
            SET ${assignments.join(", ")}
            WHERE id = ?
        `, [...fields.map(([, value]) => value), updateId]);
        return result.affectedRows ? this.findProjectUpdateById(updateId) : null;
    }

    /**
     * Deletes a project update.
     * @param {string} updateId Project update ID to delete.
     * @returns {Promise<boolean>} Whether the project update was deleted.
     */
    async deleteProjectUpdate(updateId) {
        const [result] = await this.db.query(
            "DELETE FROM project_updates WHERE id = ?",
            [updateId],
        );
        return result.affectedRows > 0;
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
                const { name, username } = this._normalizeCollaborator(collaborator);
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
                const { contributor, contribution } = this._normalizeFunding(funding);

                await db.query(
                    `INSERT INTO project_funding
                        (project_id, contributor, contribution)
                     VALUES (?, ?, ?)`,
                    [projectId, contributor, contribution],
                );
            }
        }
    }

    _normalizeCollaborator(collaborator) {
        if (!collaborator || (typeof collaborator !== "string" && typeof collaborator.name !== "string")) {
            throw new TypeError("Each project collaborator must have a name");
        }

        const name = typeof collaborator === "string" ? collaborator.trim() : collaborator.name.trim();
        if (!name) throw new TypeError("Project collaborator name is required");

        return {
            name,
            username: typeof collaborator === "string" ? null : collaborator.username ?? null,
        };
    }

    _normalizeFunding(funding) {
        if (!funding || typeof funding !== "object") {
            throw new TypeError("Each project funding entry must be an object");
        }

        return {
            contributor: String(funding.who ?? funding.contributor ?? "").trim(),
            contribution: String(funding.what ?? funding.contribution ?? "").trim(),
        };
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

    /**
     * Creates a router for project-related endpoints.
     * @returns {express.Router} Router for project-related endpoints.
     */
    createRouter() {
        return ProjectsRouter.createRouter(this);
    }
}

class ProjectsRouter {
    static createRouter(projectsManager) {
        const router = express.Router();

        /**
         * GET /all
         * Retrieves all projects.
         */
        router.get("/all", async (req, res) => {
            try {
                const projects = await projectsManager.getProjects();
                res.json(projects);

            } catch (error) {
                console.error("Error fetching projects:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * GET /:id
         * @param {string} id - The ID of the project to retrieve.
         * Retrieves a project by its ID.
         */
        router.get("/:id", async (req, res) => {
            const projectId = req.params.id;
            try {
                const project = await projectsManager.findProjectById(projectId);
                if (project) {
                    res.json(project);
                } else {
                    res.status(404).json({ error: "Project not found" });
                }
            } catch (error) {
                console.error(`Error fetching project with ID ${projectId}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * POST /create
         * @body {Object} projectData - The data for the new project.
         * Creates a project owned by the authenticated user.
         */
        router.post("/create", async (req, res) => {
            try {
                const newProject = await projectsManager.createProject({
                    ...req.body,
                    owner_username: req.user.username,
                    owner_name: req.user.nick || req.user.username,
                    created_by: req.user.username,
                });
                res.status(201).json(newProject);
                
            } catch (error) {
                console.error("Error creating project:", error);
                res.status(400).json({ error: "Error creating project" });
            }
        });

        /**
         * GET /:id/collaborators
         * @param {string} id - The ID of the project.
         * Retrieves the project's collaborators.
         */
        router.get("/:id/collaborators", async (req, res) => {
            const projectId = req.params.id;
            try {
                const collaborators = await projectsManager.getProjectCollaborators(projectId);
                res.json(collaborators);
            } catch (error) {
                console.error(`Error fetching collaborators for project ID ${projectId}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * POST /:id/collaborators
         * @param {string} id - The ID of the project.
         * @body {Object} collaborator - The collaborator to add.
         * Adds a collaborator. Only the project owner or an admin can perform this action.
         */
        router.post("/:id/collaborators", async (req, res) => {
            const projectId = req.params.id;
            const reqUsername = req.user.username
            
            try {
                const project = await projectsManager.findProjectById(projectId);
                if(!project) {
                    return res.status(404).json({ error: "Project not found" });
                }

                // Permitir solo a los admins o a los owners del proyecto
                if(!project.userIsOwner(reqUsername) && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }

                const collaborator = await projectsManager.addProjectCollaborator(projectId, req.body);
                res.status(201).json(collaborator);
            } catch (error) {
                console.error(`Error adding collaborator to project ID ${projectId}:`, error);
                res.status(400).json({ error: "Error adding collaborator" });
            }
        });

        /**
         * DELETE /:id/collaborators
         * @param {string} id - The ID of the project.
         * @body {Object} collaborator - The collaborator to remove.
         * Removes a collaborator. Only the project owner or an admin can perform this action.
         */
        router.delete("/:id/collaborators", async (req, res) => {
            const projectId = req.params.id;
            const reqUsername = req.user.username

            try {
                const project = await projectsManager.findProjectById(projectId);
                if(!project) {
                    return res.status(404).json({ error: "Project not found" });
                }

                // Permitir solo a los admins o a los owners del proyecto
                if(!project.userIsOwner(reqUsername) && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }


                const removed = await projectsManager.removeProjectCollaborator(
                    projectId,
                    req.body?.name ?? req.body?.collaborator_name ?? req.query.name,
                );
                if (!removed) return res.status(404).json({ error: "Collaborator not found" });
                res.status(204).send();
            } catch (error) {
                console.error(`Error removing collaborator from project ID ${projectId}:`, error);
                res.status(400).json({ error: "Error removing collaborator" });
            }
        });

        /**
         * GET /:id/funding
         * @param {string} id - The ID of the project.
         * Retrieves the project's funding entries.
         */
        router.get("/:id/funding", async (req, res) => {
            const projectId = req.params.id;
            try {
                const funding = await projectsManager.getProjectFunding(projectId);
                res.json(funding);

            } catch (error) {
                console.error(`Error fetching funding for project ID ${projectId}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * POST /:id/funding
         * @param {string} id - The ID of the project.
         * @body {Object} funding - The funding entry to add.
         * Adds a funding entry. Only project members or an admin can perform this action.
         */
        router.post("/:id/funding", async (req, res) => {
            const projectId = req.params.id;
            const reqUsername = req.user.username;

            try {
                const project = await projectsManager.findProjectById(projectId);
                if(!project) {
                    return res.status(404).json({ error: "Project not found" });
                }

                // Permitir solo a los admins o a los miembros del proyecto
                if(!await project.userIsMember(reqUsername) && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }
                
                const funding = await projectsManager.addProjectFunding(projectId, req.body);
                res.status(201).json(funding);

            } catch (error) {
                console.error(`Error adding funding to project ID ${projectId}:`, error);
                res.status(400).json({ error: "Error adding funding" });
            }
        });

        /**
         * DELETE /:id/funding/:fundingId
         * @param {string} id - The ID of the project.
         * @param {number|string} fundingId - The ID of the funding entry to remove.
         * Removes a funding entry. Only project members or an admin can perform this action.
         */
        router.delete("/:id/funding/:fundingId", async (req, res) => {
            const { id: projectId, fundingId } = req.params;
            const reqUsername = req.user.username;

            try {
                const project = await projectsManager.findProjectById(projectId);
                if (!project) {
                    return res.status(404).json({ error: "Project not found" });
                }
                
                // Permitir solo a los admins o a los miembros del proyecto
                if(!await project.userIsMember(reqUsername) && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }


                const removed = await projectsManager.removeProjectFunding(projectId, fundingId);
                if (!removed) return res.status(404).json({ error: "Funding entry not found" });
                res.status(204).send();

            } catch (error) {
                console.error(`Error removing funding from project ID ${projectId}:`, error);
                res.status(400).json({ error: "Error removing funding" });
            }
        });

        /**
         * GET /:id/updates
         * @param {string} id - The ID of the project.
         * Retrieves the project's updates.
         */
        router.get("/:id/updates", async (req, res) => {
            const projectId = req.params.id;
            try {
                if (!await projectsManager.findProjectById(projectId)) {
                    return res.status(404).json({ error: "Project not found" });
                }

                res.json(await projectsManager.getProjectUpdates(projectId));
            } catch (error) {

                console.error(`Error fetching updates for project ID ${projectId}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * GET /:id/updates/:updateId
         * @param {string} id - The ID of the project.
         * @param {string} updateId - The ID of the project update to retrieve.
         * Retrieves a project update.
         */
        router.get("/:id/updates/:updateId", async (req, res) => {
            const { id: projectId, updateId } = req.params;
            try {
                if (!await projectsManager.findProjectById(projectId)) {
                    return res.status(404).json({ error: "Project not found" });
                }
                const update = await projectsManager.findProjectUpdateById(updateId, projectId);
                if (!update) return res.status(404).json({ error: "Project update not found" });
                res.json(update);

            } catch (error) {
                console.error(`Error fetching project update ${updateId}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * POST /:id/updates
         * @param {string} id - The ID of the project.
         * @body {Object} updateData - The data for the new project update.
         * Creates a project update. Only project members or an admin can perform this action.
         */
        router.post("/:id/updates", async (req, res) => {
            const projectId = req.params.id;
            const reqUsername = req.user.username;

            try {
                const project = await projectsManager.findProjectById(projectId);
                if (!project) {
                    return res.status(404).json({ error: "Project not found" });
                }

                // Permitir solo a los admins o miembros del proyecto
                if(!await project.userIsMember(reqUsername) && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }
                
                res.status(201).json(await projectsManager.createProjectUpdate(projectId, req.body));

            } catch (error) {
                console.error(`Error creating update for project ID ${projectId}:`, error);
                res.status(400).json({ error: "Error creating project update" });
            }
        });

        /**
         * PUT /:id/updates/:updateId
         * @param {string} id - The ID of the project.
         * @param {string} updateId - The ID of the project update to update.
         * @body {Object} updatedData - The fields to update.
         * Updates a project update. Only project members or an admin can perform this action.
         */
        router.put("/:id/updates/:updateId", async (req, res) => {
            const { id: projectId, updateId } = req.params;
            const reqUsername = req.user.username;

            try {
                const project = await projectsManager.findProjectById(projectId);
                if (!project) {
                    return res.status(404).json({ error: "Project not found" });
                }

                // Permitir solo a los admins o miembros del proyecto
                if(!await project.userIsMember(reqUsername) && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }

                const existingUpdate = await projectsManager.findProjectUpdateById(updateId, projectId);
                if (!existingUpdate) {
                    return res.status(404).json({ error: "Project update not found" });
                }
                res.json(await projectsManager.updateProjectUpdate(updateId, req.body));

            } catch (error) {
                console.error(`Error updating project update ${updateId}:`, error);
                res.status(400).json({ error: "Error updating project update" });
            }
        });

        /**
         * DELETE /:id/updates/:updateId
         * @param {string} id - The ID of the project.
         * @param {string} updateId - The ID of the project update to delete.
         * Deletes a project update. Only project members or an admin can perform this action.
         */
        router.delete("/:id/updates/:updateId", async (req, res) => {
            const { id: projectId, updateId } = req.params;
            const reqUsername = req.user.username

            try {
                const project = await projectsManager.findProjectById(projectId)
                if (!project) {
                    return res.status(404).json({ error: "Project not found" });
                }

                // Permitir solo a los admins o miembros del proyecto
                if(!await project.userIsMember(reqUsername) && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }

                const existingUpdate = await projectsManager.findProjectUpdateById(updateId, projectId);
                if (!existingUpdate) {
                    return res.status(404).json({ error: "Project update not found" });
                }
                await projectsManager.deleteProjectUpdate(updateId);
                res.json({ message: "Project update deleted successfully" });

            } catch (error) {
                console.error(`Error deleting project update ${updateId}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        /**
         * PUT /:id/update
         * @param {string} id - The ID of the project to update.
         * @body {Object} updatedData - The fields and relations to update.
         * Updates a project. Only the project owner or an admin can perform this action.
         */
        router.put("/:id/update", async (req, res) => {
            const projectId = req.params.id;
            const reqUsername = req.user.username;
            
            try {
                const project = await projectsManager.findProjectById(projectId);
                if (!project) {
                    return res.status(404).json({ error: "Project not found" });
                }
    
                // Permitir solo a los admins o owners del proyecto
                if(!project.userIsOwner(reqUsername) && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }

                const updatedProject = await projectsManager.updateProject(projectId, req.body);
                if (updatedProject) {
                    res.json(updatedProject);
                } else {
                    res.status(404).json({ error: "Project not found" });
                }

            } catch (error) {
                console.error(`Error updating project with ID ${projectId}:`, error);
                res.status(400).json({ error: "Error updating project" });
            }
        });

        /**
         * DELETE /:id/delete
         * @param {string} id - The ID of the project to delete.
         * Deletes a project. Only the project owner or an admin can perform this action.
         */
        router.delete("/:id/delete", async (req, res) => {
            const projectId = req.params.id;
            const reqUsername = req.user.username
            try {
                const project = await projectsManager.findProjectById(projectId);
                if (!project) {
                    return res.status(404).json({ error: "Project not found" });
                }
    
                // Permitir solo a los admins o owners del proyecto
                if(!project.userIsOwner(reqUsername) && req.user.role !== "admin") {
                    return res.status(403).json({ error: "Forbidden" });
                }

                const deleted = await projectsManager.deleteProject(projectId);
                if (deleted) {
                    res.json({ message: "Project deleted successfully" });
                } else {
                    res.status(404).json({ error: "Project not found" });
                }
                
            } catch (error) {
                console.error(`Error deleting project with ID ${projectId}:`, error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        return router;
    }
}

module.exports = { Project, ProjectUpdate, ProjectsManager };