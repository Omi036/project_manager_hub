// ===== 02-data.js =====
// Persistencia y modelo de datos. Se carga antes de las vistas que usan la API.

function buildSampleProjects() {
    return [
        {
            id: "pmcdemo",
            title: "[MINECRAFT] Servidor Create",
            icon: "tabler:cube",
            iconColor: "#16a34a",
            status: "En progreso",
            createdAt: "2026-10-20T09:00:00.000Z",
            owner: "Lucía Márquez",
            collabs: ["Andrés", "Marta"],
            tags: ["minecraft", "create", "servidor"],
            funding: [
                { who: "Andrés", what: "Hosting del servidor (VPS)" },
                { who: "Marta", what: "25 €/mes" },
            ],
            updates: [
                {
                    id: "umcdemo",
                    title: "Servidor en línea",
                    date: "2026-11-02T18:00:00.000Z",
                    desc: "El servidor ya está **activo** con el modpack *Create*.\n\n- Whitelist abierta\n- Mapa base generado",
                },
            ],
            desc: "## Objetivo\nMontar un servidor de **Minecraft** con el mod *Create* para la comunidad.\n\n- Modpack y configuración\n- Normas y whitelist\n- Copias de seguridad semanales\n\n> Las ideas se hablan en el hilo de discusión.",
        },
        {
            id: "pgfdemo",
            title: "[2027] MorenoGameFest",
            icon: "tabler:device-gamepad-2",
            iconColor: "#7c3aed",
            status: "Ideado",
            createdAt: "2026-10-30T09:00:00.000Z",
            owner: "Pablo Ruiz",
            collabs: ["Sofía", "Lucía Márquez"],
            tags: ["evento", "videojuegos", "2027"],
            funding: [
                { who: "Ayuntamiento", what: "Cesión del pabellón" },
                { who: "Pablo", what: "300 €" },
            ],
            updates: [],
            desc: "## Idea\nOrganizar el **MorenoGameFest** de 2027: torneos, zona *indie* y rincón retro.\n\n- Buscar sede y fechas\n- Contactar con desarrolladores\n- Plan de patrocinios",
        },
    ];
}

class API {
    static #me = "lucia_m";
    static #authenticated = false;
    static #users = [
        { username: "lucia_m", nick: "Lucía Márquez" },
        { username: "andres_g", nick: "Andrés", role: "admin" },
        { username: "marta_r", nick: "Marta" },
        { username: "sofia_l", nick: "Sofía" },
        { username: "pablo_ruiz", nick: "Pablo Ruiz" },
    ];

    // Almacena los usuarios en memoria (suponemos que la aplicación no tiene muchos usuarios)
    static get ME() { return API.#me }
    static set ME(username) { API.#me = username }

    static get USERS() { return API.#users }
    static set USERS(users) { API.#users = users }

    static get isAuthenticated() { return API.#authenticated }


    static currentUser() {
        return API.USERS.find((user) => user.username === API.ME) || {
            username: API.ME,
            nick: API.ME,
        };
    }

    static #storageKeys = {
        projects: "gestor-proyectos-v1",
        discussions: "gestor-discusiones-v1",
        settings: "gestor-ajustes-v1",
    };

    static #projects = [];
    static #discussions = [];
    static #news = [];
    static #discussionError = null;
    static #discussionsLoading = false;

    // URL del API. Puede sobrescribirse con window.API_BASE_URL en despliegues separados.
    static #apiBaseUrl = (window.API_BASE_URL || window.location.origin).replace(/\/$/, "");

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

    // Guarda los datos actuales en el almacenamiento local.
    static #persist() {
        try {
            localStorage.setItem(
                API.#storageKeys.projects,
                JSON.stringify(API.#projects),
            );
            localStorage.setItem(
                API.#storageKeys.discussions,
                JSON.stringify(API.#discussions),
            );
        } catch (error) {}
    }

    static #timestamp() { return new Date().toISOString() }
    static #legacySampleIds = ["p1demo", "p2demo", "n1demo"];

    static #replaceLegacySamples(stored, buildSamples) {
        if (!Array.isArray(stored)) return buildSamples();

        const kept = stored.filter((item) => !API.#legacySampleIds.includes(item.id));
        return kept.length === stored.length
            ? stored
            : [...buildSamples(), ...kept];
    }


    static loadData() {
        // Lee los proyectos locales mientras las colecciones respaldadas por el servidor se cargan.
        const storedProjects = API.#readStorage(API.#storageKeys.projects);

        API.#projects.splice(0, API.#projects.length, ...API.#replaceLegacySamples(storedProjects, buildSampleProjects));
        API.#discussions.length = 0;
        API.#news.length = 0;

        // Asegura que cada proyecto tenga los campos necesarios y valores por defecto.
        API.#projects.forEach((project) => {
            project.createdAt = project.createdAt || API.#timestamp();
            project.status = project.status || STATUS[0];
            project.updates = project.updates || [];
            project.tags = project.tags || [];
        });

        return {
            projects: API.#projects,
            discussions: API.#discussions,
            news: API.#news,
        };
    }

    static #normalizeNews(item) {
        return {
            id: item.id,
            title: item.title,
            desc: item.description ?? item.desc ?? "",
            banner: item.banner || "",
            createdAt: item.created_at ?? item.createdAt,
            createdBy: item.created_by ?? item.createdBy,
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
                    createdAt: discussion.created_at,
                    messages: Array.isArray(messages)
                        ? messages.map((message) => ({
                            id: message.id,
                            author: message.author,
                            date: message.created_at,
                            text: message.text,
                        }))
                        : [],
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

    // Mantiene la compatibilidad con las llamadas existentes y devuelve el usuario autenticado.
    static async login() {
        return API.restoreSession();
    }

    // Devuelve los ajustes de la aplicación
    static getSettings() {
        return {
            theme: "light",
            accent: "blue",
            showStats: true,
            showNews: true,
            // combinando los valores por defecto con los almacenados en localStorage.
            ...API.#readStorage(API.#storageKeys.settings),
        };
    }

    // Guarda los ajustes de la aplicación
    static saveSettings(settings) {
        try {
            localStorage.setItem(API.#storageKeys.settings, JSON.stringify(settings));
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

        const creatorUsername = resolveUser(item.createdBy || item.owner).username;
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
    static createProject(fields) {
        //! TODO: REEMPLAZAR CON LLAMADA A SERVIDOR
        const projectData = {
            ...fields,
            id: uid(),
            createdAt: API.#timestamp(),
            createdBy: API.ME,
            updates: [],
        };

        API.#projects.push(projectData);
        API.#persist();
        return projectData;
    }

    // Actualiza un proyecto existente con nuevos valores.
    static updateProject(projectId, changes) {
        // Encuentra el proyecto por su ID y verifica si el usuario tiene permisos para actualizarlo.
        const project = API.findProject(projectId);
        if (!project) return null;

        //! TODO: REEMPLAZAR CON LLAMADA A SERVIDOR
        Object.assign(project, changes);
        API.#persist();
        return project;
    }

    // Elimina un proyecto existente si el usuario tiene permisos de administrador o es el propietario.
    static deleteProject(projectId) {
        // Encuentra el proyecto por su ID y verifica si el usuario tiene permisos para eliminarlo.
        if (!API.canDelete(API.findProject(projectId))) return false;
        const position = API.#projects.findIndex((project) => project.id === projectId);
        if (position < 0) return false;

        //! TODO: REEMPLAZAR CON LLAMADA A SERVIDOR
        API.#projects.splice(position, 1);
        API.#persist();
        return true;
    }




    // ==== UPDATES ====

    // Crea una actualización de proyecto y la agrega a la lista de actualizaciones del proyecto.
    static createUpdate(projectId, { title, description }) {
        const projectUpdate = {
            id: uid(),
            title,
            desc: description,
            date: API.#timestamp(),
        };

        //! TODO: REEMPLAZAR CON LLAMADA A SERVIDOR
        API.findProject(projectId).updates.push(projectUpdate);
        API.#persist();
        return projectUpdate;
    }

    // Actualiza una actualización de proyecto existente con nuevos valores.
    static updateUpdate(projectId, updateId, { title, description }) {
        //! TODO: REEMPLAZAR CON LLAMADA A SERVIDOR
        //! TODO: CUALQUIERA PUEDE ACTUALIZAR UNA ACTUALIZACIÓN, NO SOLO EL PROPIETARIO DEL PROYECTO. SE DEBERÍA RESTRINGIR A ADMIN O PROPIETARIO O COLABORADOR DEL PROYECTO.

        const projectUpdate = API.findProject(projectId).updates.find((entry) => entry.id === updateId);
        Object.assign(projectUpdate, { title, desc: description });
        API.#persist();

        return projectUpdate;
    }

    // Elimina una actualización de proyecto existente si el usuario tiene permisos de administrador o es el propietario del proyecto.
    static deleteUpdate(projectId, updateId) {
        const project = API.findProject(projectId);
        project.updates = project.updates.filter((entry) => entry.id !== updateId);

        //! TODO: REEMPLAZAR CON LLAMADA A SERVIDOR
        API.#persist();
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
            createdAt: discussion.created_at,
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
        const normalized = {
            id: message.id,
            author: message.author,
            date: message.created_at,
            text: message.text,
        };
        API.findDiscussion(discussionId)?.messages.push(normalized);
        return normalized;
    }
}
