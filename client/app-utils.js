// Funciones compartidas para escapar HTML, formatear fechas y renderizar Markdown.

// Selector DOM compartido por todos los módulos de la aplicación.
const $ = (selector) => document.querySelector(selector);

// Escapa caracteres especiales en HTML para prevenir inyecciones.
// Lista de caracteres a escapar
const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;",
};

// Itera por cada caracter prohibido y lo escapa
const esc = (input) =>
    input == null
        ? ""
        : String(input).replace(/[&<>"'`]/g, (character) => entities[character]);



// Obtiene la URL del avatar de un usuario, si existe y es válida.
const avatarUrl = (user) => {
    const url = user?.avatar_url;
    return typeof url === "string" && url.startsWith("https://cdn.discordapp.com/") ? url : null;
};


// Genera las iniciales de un nombre de usuario
const userInitials = (name) =>
    (name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase();

// Convierte un nombre de usuario o nick en un objeto de usuario válido.
const resolveUser = (rawUser) => {
    const key = (rawUser || "").trim().toLowerCase();
    return (
        API.USERS.find((user) => user.username === key || user.nick.toLowerCase() === key) || {
            username: key.replace(/\s+/g, "_") || "anon",
            nick: rawUser || "Anónimo",
        }
    );
};


// Genera el marcado HTML para un avatar de usuario
const avatarMarkup = (user, className = "") => {
    const imageUrl = avatarUrl(user);
    const content = imageUrl
        ? `<img src="${esc(imageUrl)}" alt="" loading="lazy">`
        : esc(userInitials(user?.nick));
    return `<div class="avatar ${className}">${content}</div>`;
};


// Actualiza el DOM del avatar del usuario actual en la interfaz de usuario.
const updateCurrentUserAvatar = () => {
    const element = $("#current_user_avatar");
    if (!element) return;

    const user = API.currentUser();
    const imageUrl = avatarUrl(user);

    element.innerHTML = imageUrl
        ? `<img src="${esc(imageUrl)}" alt="" loading="lazy">`
        : esc(userInitials(user.nick));
};

// Genera un identificador único basado en la fecha y un número aleatorio.
const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Estados de los proyectos, en orden de aparición.
const STATUS = ["Ideado", "En progreso", "Finalizado", "Abortado"];

// Compara dos cadenas de texto ignorando mayúsculas, minúsculas y espacios al inicio y al final.
const same = (left, right) => (left || "").trim().toLowerCase() === right.toLowerCase();

// Formatea una fecha ISO a un formato legible en español, o devuelve la fecha original si hay un error.
const fmtGeneral = (isoDate, options = { dateStyle: "long", timeStyle: "short" }) => {
    try {
        return new Date(isoDate).toLocaleString("es-ES", options);
    } catch (error) {
        return isoDate;
    }
}

const fmtDay = (isoDate) => {return fmtGeneral(isoDate, { dateStyle: "medium" })}
const fmtMsg = (isoDate) => {return fmtGeneral(isoDate, { dateStyle: "short", timeStyle: "short" })}
const fmtDate = (isoDate) => {return fmtGeneral(isoDate, { dateStyle: "long", timeStyle: "short" })}
const newestFirstBy = (field) => (first, second) =>
    second[field].localeCompare(first[field]);
const isRecent = (isoDate, days = 14) =>
    Date.now() - new Date(isoDate).getTime() < days * 24 * 60 * 60 * 1000;



// Crea un badge con el estado del proyecto.
const badge = (statusName) => `<span class="st st-${Math.max(0, STATUS.indexOf(statusName))}">${esc(statusName || STATUS[0])}</span>`;

// Renderizador Markdown compartido por proyectos, noticias y discusiones.
class MarkdownRenderer {
    // Renderiza texto de una sola línea con formato Markdown inline.
    static renderInline(text) {
        return esc(text)
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(
                /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/(?:png|jpe?g|gif|webp);base64,)[^)\s]+)\)/g,
                '<img src="$2" alt="$1" loading="lazy">',
            )
            .replace(
                /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
                '<a href="$2" target="_blank" rel="noopener">$1</a>',
            );
    }

    // Renderiza texto multilinea con párrafos, encabezados, listas y citas.
    static render(src) {
        const lines = (src || "").split("\n");
        let html = "";
        let list = null;
        let paragraph = [];
        let match;

        // Función auxiliar para vaciar el párrafo acumulado y agregarlo al HTML.
        const flushParagraph = () => {
            if (paragraph.length) {
                const renderedParagraph = paragraph
                    .map((line) => {
                        const hardBreak = / {2,}$/.test(line);
                        return `<span class="md-line${hardBreak ? " md-line--hard-break" : ""}">${MarkdownRenderer.renderInline(line)}</span>`;
                    })
                    .join("");
                html += `
                    <p>
                        ${renderedParagraph}
                    </p>`;
                paragraph = [];
            }
        };

        // Función auxiliar para cerrar la lista abierta, si existe.
        const closeList = () => {
            if (list) {
                html += "</" + list + ">";
                list = null;
            }
        };

        // Procesa cada línea del texto fuente y genera el HTML correspondiente.
        for (const line of lines) {
            // Encabezados de nivel 1 a 3.
            if ((match = line.match(/^(#{1,3})\s+(.*)/))) {
                // Cierra los parrafos y listas (si existen) antes de agregar el encabezado.
                flushParagraph();
                closeList();

                const headingLevel = match[1].length + 1;
                const hardBreak = / {2,}$/.test(match[2]);
                html += `<h${headingLevel} class="md-line${hardBreak ? " md-line--hard-break" : ""}">${MarkdownRenderer.renderInline(match[2])}</h${headingLevel}>`;

            // Texto secundario
            } else if ((match = line.match(/^\s*-#\s+(.*)/))) {
                flushParagraph();
                closeList();
                const hardBreak = / {2,}$/.test(match[1]);
                html += `<p class="md-subtle md-line${hardBreak ? " md-line--hard-break" : ""}">${MarkdownRenderer.renderInline(match[1])}</p>`;

            // Listas desordenadas
            } else if ((match = line.match(/^\s*[-*]\s+(.*)/))) {
                // Cierra los parrafos (si existen) antes de agregar las listas.
                flushParagraph();

                if (list !== "ul") {
                    closeList();
                    html += "<ul>";
                    list = "ul";
                }
                html += "<li>" + MarkdownRenderer.renderInline(match[1]) + "</li>";

            // Listas ordenadas
            } else if ((match = line.match(/^\s*\d+\.\s+(.*)/))) {
                // Cierra los parrafos (si existen) antes de agregar la lista.
                flushParagraph();

                if (list !== "ol") {
                    closeList();
                    html += "<ol>";
                    list = "ol";
                }

                html += "<li>" + MarkdownRenderer.renderInline(match[1]) + "</li>";

            // Citas
            } else if ((match = line.match(/^>\s?(.*)/))) {
                // Cierra los parrafos y listas (si existen) antes de agregar las citas.
                flushParagraph();
                closeList();

                const hardBreak = / {2,}$/.test(match[1]);
                html +=
                    `<blockquote class="md-line${hardBreak ? " md-line--hard-break" : ""}">` +
                    MarkdownRenderer.renderInline(match[1]) +
                    "</blockquote>";

            // Lineas en blanco cierran cualquier lista y parrafo previo
            } else if (!line.trim()) {
                flushParagraph();
                closeList();
                html += '<div class="md-empty" aria-hidden="true"></div>';
            
            // Cualquier otra línea se acumula en el párrafo actual
            } else {
                // Cierra la lista (si existe) y comienza un nuevo párrafo
                closeList();
                paragraph.push(line.trimStart());
            }
        }

        // Al final del texto, vacía cualquier párrafo o lista pendiente.
        flushParagraph();
        closeList();
        return html;
    }
}
