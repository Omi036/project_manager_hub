// ===== 02-data.js =====
// Persistencia y modelo de datos. Se carga antes de las vistas que usan la API.

class API {
    static #me = "unlogged";
    static #authenticated = false;
    static #users = [];

    // Almacena los usuarios en memoria (suponemos que la aplicación no tiene muchos usuarios)
    static get ME() { return API.#me }
    static set ME(username) { API.#me = username }

    static get USERS() { return API.#users }
    static set USERS(users) { API.#users = users }

    static get isAuthenticated() { return API.#authenticated }
    
    static #settingsStorageKey = "gestor-ajustes-v1"
    
    static #projects = [];
    static #discussions = [];
    static #news = [];
    static #discussionError = null;
    static #projectsError = null;
    static #discussionsLoading = false;
    
    static #apiBaseUrl = (window.API_BASE_URL || window.location.origin).replace(/\/$/, "");
    
    // Devuelve el objeto completo del usuario (o el username y nick si no se encuentra)
    static currentUser() {
        return API.USERS.find((user) => user.username === API.ME) || {
            username: API.ME,
            nick: API.ME,
        };
    }

    // Realiza una petición HTTP autenticada al servidor, incluyendo cookies de sesión.
    static #authRequest(path, options = {}) {
        return fetch(`${API.#apiBaseUrl}${path}`, {
            credentials: "include",
            ...options,
            headers: {
                "Accept": "application/json",
                ...(options.headers || {}),
            },
        });
    }

    // Realiza una petición HTTP autenticada al servidor y devuelve la respuesta parseada como JSON.
    static async #requestJson(path, options = {}) {
        const response = await API.#authRequest(path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(payload?.error || `API request failed (${response.status})`);
        }
        return payload;
    }

    // Lee un valor del almacenamiento local y lo parsea como JSON.
    static #readStorage(storageKey) {
        try {
            const rawValue = localStorage.getItem(storageKey);
            return rawValue === null ? null : JSON.parse(rawValue);
        } catch (error) {
            return null;
        }
    }

    // Devuelve un objeto con los datos cargados de la API (proyectos, discusiones y noticias).
    static loadData() {
        API.#projects.length = 0;
        API.#discussions.length = 0;
        API.#news.length = 0;

        return {
            projects: API.#projects,
            discussions: API.#discussions,
            news: API.#news,
        };
    }

    static get projectsError() { return API.#projectsError }

    // Normaliza un proyecto para que tenga todos los campos esperados, incluyendo valores por defecto y relaciones.
    static #normalizeProject(project, relations = {}) {
        return {
            id: project.id,
            title: project.title,
            icon: project.icon || "tabler:rocket",
            icon_color: project.icon_color ?? "#2d4ca3",
            status: project.status || STATUS[0],
            description: project.description ?? "",
            owner_name: project.owner_name ?? "",
            owner_username: project.owner_username ?? null,
            created_at: project.created_at,
            created_by: project.created_by,
            tags: Array.isArray(project.tags)
                ? project.tags
                : String(project.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
            collabs: relations.collabs ?? project.collabs ?? [],
            funding: relations.funding ?? project.funding ?? [],
            updates: relations.updates ?? project.updates ?? [],
        };
    }

    // Normaliza una update para que tenga los campos esperados
    static #normalizeUpdate(update) {
        return {
            id: update.id,
            title: update.title,
            description: update.description ?? "",
            created_at: update.created_at,
        };
    }

    static async #hydrateProject(project) {
        const [collabs, funding, updates] = await Promise.all([
            API.#requestJson(`/api/projects/${encodeURIComponent(project.id)}/collaborators`),
            API.#requestJson(`/api/projects/${encodeURIComponent(project.id)}/funding`),
            API.#requestJson(`/api/projects/${encodeURIComponent(project.id)}/updates`),
        ]);
        return API.#normalizeProject(project, {
            collabs: collabs.map((collaborator) => collaborator.name ?? collaborator),
            funding,
            updates: updates.map((update) => API.#normalizeUpdate(update)),
        });
    }

    static async loadProjects() {
        API.#projectsError = null;
        try {
            const response = await API.#requestJson("/api/projects/all");
            if (!Array.isArray(response)) throw new Error("La API devolvió proyectos inválidos");
            const hydrated = await Promise.all(response.map((project) => API.#hydrateProject(project)));
            API.#projects.splice(0, API.#projects.length, ...hydrated);
            return API.#projects;
        } catch (error) {
            API.#projectsError = error;
            console.error("No se pudieron cargar los proyectos:", error);
            throw error;
        }
    }

    static #normalizeNews(item) {
        return {
            id: item.id,
            title: item.title,
            description: item.description ?? "",
            banner: item.banner || "",
            created_at: item.created_at,
            created_by: item.created_by,
        };
    }

    static async loadNews() {
        try {
            const response = await API.#requestJson("/api/news/all");
            if (!Array.isArray(response)) throw new Error("La API devolvió noticias inválidas");

            API.#news.splice(
                0,
                API.#news.length,
                ...response.map((item) => API.#normalizeNews(item)),
            );
            return API.#news;
        } catch (error) {
            API.#news.length = 0;
            console.error("No se pudieron cargar las noticias:", error);
            throw error;
        }
    }

    static get discussionError() { return API.#discussionError }
    static get discussionsLoading() { return API.#discussionsLoading }

    static async loadUsers() {
        try {
            const users = await API.#requestJson("/api/users/all");
            if (Array.isArray(users)) API.USERS = users;
        } catch (error) {
            console.error("No se pudieron cargar los usuarios:", error);
        }
    }

    static async loadDiscussions() {
        API.#discussionsLoading = true;
        API.#discussionError = null;

        try {
            const discussions = await API.#requestJson("/api/discussions/all");
            if (!Array.isArray(discussions)) throw new Error("La API devolvió discusiones inválidas");

            const hydrated = await Promise.all(discussions.map(async (discussion) => {
                const messages = await API.#requestJson(`/api/discussions/${encodeURIComponent(discussion.id)}/messages`);
                return {
                    id: discussion.id,
                    title: discussion.title,
                    owner: discussion.owner,
                    created_at: discussion.created_at,
                    messages: Array.isArray(messages) ? messages : []
                };
            }));

            API.#discussions.splice(0, API.#discussions.length, ...hydrated);
            return API.#discussions;
        } catch (error) {
            API.#discussionError = error;
            API.#discussions.length = 0;
            console.error("No se pudieron cargar las discusiones:", error);
            throw error;
        } finally {
            API.#discussionsLoading = false;
        }
    }

    // Restaura la sesión existente del servidor.
    static async restoreSession() {
        try {
            // Intenta obtener la información del usuario autenticado desde el servidor.
            const response = await API.#authRequest("/auth/me");
            if (!response.ok) {
                API.#authenticated = false;
                return null;
            }

            const { user } = await response.json();

            // Actualiza la lista de usuarios con la información del usuario autenticado.
            API.USERS = [
                ...API.USERS.filter((entry) => entry.username !== user.username),
                user,
            ];

            API.ME = user.username;
            API.#authenticated = true;
            return user;

        } catch (error) {
            console.error("No se pudo restaurar la sesión:", error);
            API.#authenticated = false;
            return null;
        }
    }

    // Devuelve los ajustes de la aplicación
    static getSettings() {
        return {
            theme: "light",
            accent: "blue",
            showStats: true,
            showNews: true,
            // combinando los valores por defecto con los almacenados en localStorage.
            ...API.#readStorage(API.#settingsStorageKey),
        };
    }

    // Guarda los ajustes de la aplicación
    static saveSettings(settings) {
        try {
            localStorage.setItem(API.#settingsStorageKey, JSON.stringify(settings));
        } catch (error) {}
        return settings;
    }

    // Inicia el flujo de autenticación gestionado por el servidor.
    static loginWithDiscord() {
        const authorizeUrl = `${API.#apiBaseUrl}/auth/discord`;
        location.assign(authorizeUrl);
        return authorizeUrl;
    }

    // Cierra la sesión en el servidor.
    static async logout() {
        alert("Cerrando sesión...");

        try {
            const response = await API.#authRequest("/auth/logout", { method: "POST" });
            if (!response.ok) throw new Error(`Logout failed (${response.status})`);

            API.ME = "lucia_m";
            API.#authenticated = false;

            return { ok: true };
        } catch (error) {
            console.error("No se pudo cerrar la sesión:", error);
            return { ok: false, error };
        }
    }




    // ==== MANAGEMENT ====
    static isAdmin(username) {
        return API.USERS.some((user) => user.username === username && user.role === "admin");
    }

    // Verifica si un usuario puede eliminar un elemento (proyecto, noticia o discusión) según su creador o rol de administrador.
    static canDelete(item, actorUsername = API.ME) {
        if (!item) return false;

        const creatorUsername = item.created_by || item.owner_username || resolveUser(item.owner).username;
        return actorUsername === creatorUsername || API.isAdmin(actorUsername);
    }




    // ==== NEWS ====
    // Devuelve una noticia por su ID
    static findNews(newsId) {
        return API.#news.find((item) => item.id === newsId);
    }

    // Crea una noticia nueva y la agrega a la lista de noticias.
    static async createNews({ title, description, banner = "" }) {
        const item = await API.#requestJson("/api/news/create", {
            method: "POST",
            body: JSON.stringify({ title, description, banner }),
        });
        const normalized = API.#normalizeNews(item);
        API.#news.unshift(normalized);
        return normalized;
    }

    // Actualiza una noticia existente con nuevos valores.
    static async updateNews(newsId, { title, description, banner = "" }) {
        const item = await API.#requestJson(`/api/news/${encodeURIComponent(newsId)}/update`, {
            method: "PUT",
            body: JSON.stringify({ title, description, banner }),
        });
        const normalized = API.#normalizeNews(item);
        const position = API.#news.findIndex((entry) => entry.id === newsId);
        if (position >= 0) API.#news.splice(position, 1, normalized);
        return normalized;
    }

    // Elimina una noticia existente si el usuario tiene permisos de administrador.
    static async deleteNews(newsId) {
        await API.#requestJson(`/api/news/${encodeURIComponent(newsId)}/delete`, {
            method: "DELETE",
        });
        const position = API.#news.findIndex((entry) => entry.id === newsId);
        if (position >= 0) API.#news.splice(position, 1);
        return true;
    }



    // ==== PROJECTS ====

    // Devuelve un proyecto por su ID
    static findProject(projectId) {
        return API.#projects.find((project) => project.id === projectId);
    }

    // Crea un proyecto nuevo y lo agrega a la lista de proyectos.
    static async createProject(fields) {
        const project = await API.#requestJson("/api/projects/create", {
            method: "POST",
            body: JSON.stringify({ ...fields, description: fields.description }),
        });
        const normalized = API.#normalizeProject(project, {
            collabs: fields.collabs || [],
            funding: fields.funding || [],
            updates: [],
        });
        API.#projects.unshift(normalized);
        return normalized;
    }

    // Actualiza un proyecto existente con nuevos valores.
    static async updateProject(projectId, changes) {
        const project = await API.#requestJson(`/api/projects/${encodeURIComponent(projectId)}/update`, {
            method: "PUT",
            body: JSON.stringify({ ...changes, description: changes.description }),
        });
        const normalized = await API.#hydrateProject(project);
        const position = API.#projects.findIndex((entry) => entry.id === projectId);
        if (position >= 0) API.#projects.splice(position, 1, normalized);
        return normalized;
    }

    // Elimina un proyecto existente si el usuario tiene permisos de administrador o es el propietario.
    static async deleteProject(projectId) {
        await API.#requestJson(`/api/projects/${encodeURIComponent(projectId)}/delete`, {
            method: "DELETE",
        });
        const position = API.#projects.findIndex((project) => project.id === projectId);
        if (position >= 0) API.#projects.splice(position, 1);
        return true;
    }




    // ==== UPDATES ====

    // Crea una actualización de proyecto y la agrega a la lista de actualizaciones del proyecto.
    static async createUpdate(projectId, { title, description }) {
        const update = await API.#requestJson(`/api/projects/${encodeURIComponent(projectId)}/updates`, {
            method: "POST",
            body: JSON.stringify({ title, description }),
        });
        const projectUpdate = API.#normalizeUpdate(update);
        API.findProject(projectId)?.updates.unshift(projectUpdate);
        return projectUpdate;
    }

    // Actualiza una actualización de proyecto existente con nuevos valores.
    static async updateUpdate(projectId, updateId, { title, description }) {
        const update = await API.#requestJson(`/api/projects/${encodeURIComponent(projectId)}/updates/${encodeURIComponent(updateId)}`, {
            method: "PUT",
            body: JSON.stringify({ title, description }),
        });
        const projectUpdate = API.#normalizeUpdate(update);
        const project = API.findProject(projectId);
        const position = project?.updates.findIndex((entry) => entry.id === updateId) ?? -1;
        if (project && position >= 0) project.updates.splice(position, 1, projectUpdate);
        return projectUpdate;
    }

    // Elimina una actualización de proyecto existente si el usuario tiene permisos de administrador o es el propietario del proyecto.
    static async deleteUpdate(projectId, updateId) {
        await API.#requestJson(`/api/projects/${encodeURIComponent(projectId)}/updates/${encodeURIComponent(updateId)}`, {
            method: "DELETE",
        });
        const project = API.findProject(projectId);
        if (project) project.updates = project.updates.filter((entry) => entry.id !== updateId);
    }




    // ==== DISCUSSIONS ====

    // Devuelve una discusión por su ID
    static findDiscussion(discussionId) {
        return API.#discussions.find((discussion) => discussion.id === discussionId);
    }

    // Crea una discusión nueva y la agrega a la lista de discusiones.
    static async createDiscussion(title) {
        const discussion = await API.#requestJson("/api/discussions/create", {
            method: "POST",
            body: JSON.stringify({ title }),
        });
        const normalized = {
            id: discussion.id,
            title: discussion.title,
            owner: discussion.owner,
            created_at: discussion.created_at,
            messages: [],
        };
        API.#discussions.unshift(normalized);
        return normalized;
    }


    // Elimina una discusión existente si el usuario tiene permisos de administrador o es el propietario.
    static async deleteDiscussion(discussionId) {
        // Encuentra la discusión por su ID y verifica si el usuario tiene permisos para eliminarla.
        const discussion = API.findDiscussion(discussionId);
        if (!discussion || !API.canDelete(discussion)) return false;
        await API.#requestJson(`/api/discussions/${encodeURIComponent(discussionId)}/delete`, { method: "DELETE" });
        API.#discussions.splice(API.#discussions.indexOf(discussion), 1);
        return true;
    }


    // Envía un mensaje a una discusión existente.
    static async sendMessage(discussionId, text) {
        const message = await API.#requestJson(`/api/discussions/${encodeURIComponent(discussionId)}/messages`, {
            method: "POST",
            body: JSON.stringify({ text }),
        });

        API.findDiscussion(discussionId)?.messages.push(message);
        return message;
    }
}
