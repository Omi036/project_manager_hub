// ===== 05-ui.js =====
// Interfaz, configuración e iconos. Este es el último módulo que se carga.

// Elementos del formulario y diálogo de noticias
const newsForm = $("#news_form")
const newsDialog = $("#news_dialog");

const ACCENTS = {
    blue: {
        label: "Azul",
        light: ["#2d4ca3", "#e6ebfa"],
        dark: ["#6ea8ff", "#1f2d44"],
    },
    orange: {
        label: "Naranja",
        light: ["#c2570c", "#fbeee3"],
        dark: ["#ff9a4d", "#3b2a1c"],
    },
    red: {
        label: "Rojo",
        light: ["#b3261e", "#fbe9e7"],
        dark: ["#ff7b72", "#3d2220"],
    },
    green: {
        label: "Verde",
        light: ["#1e7a46", "#e3f3ea"],
        dark: ["#4fd08a", "#1d3a2b"],
    },
    purple: {
        label: "Morado",
        light: ["#6d3fc0", "#efe8fa"],
        dark: ["#b497ff", "#2f2546"],
    },
    slate: {
        label: "Slate",
        light: ["#334155", "#e2e8f0"],
        dark: ["#94a3b8", "#263143"],
    },
};


const TABLER_ICONS = {
    loader: [
        "M12 6l0 -3",
        "M16.25 7.75l2.15 -2.15",
        "M18 12l3 0",
        "M16.25 16.25l2.15 2.15",
        "M12 18l0 3",
        "M7.75 16.25l-2.15 2.15",
        "M6 12l-3 0",
        "M7.75 7.75l-2.15 -2.15",
    ],
    "arrow-right": ["M5 12l14 0", "M13 18l6 -6", "M13 6l6 6"],
    message: [
        "M4 21v-13a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v6a3 3 0 0 1 -3 3h-9l-4 4",
    ],
    news: [
        "M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-13a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11",
        "M8 8l4 0",
        "M8 12l4 0",
        "M8 16l4 0",
    ],
    messages: [
        "M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10",
        "M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2",
    ],
    rocket: [
        "M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3",
        "M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3",
        "M15 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
    ],
    bulb: [
        "M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7",
        "M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3",
        "M9.7 17l4.6 0",
    ],
    leaf: [
        "M5 21c.5 -4.5 2.5 -8 7 -10",
        "M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12 9c0 1 0 3 2 5h3z",
    ],
    palette: [
        "M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25",
        "M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
        "M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
        "M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
    ],
    book: [
        "M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0",
        "M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0",
        "M3 6l0 13",
        "M12 6l0 13",
        "M21 6l0 13",
    ],
    code: ["M7 8l-4 4l4 4", "M17 8l4 4l-4 4", "M14 4l-4 16"],
    "device-gamepad-2": [
        "M12 5h3.5a5 5 0 0 1 0 10h-5.5l-4.015 4.227a2.3 2.3 0 0 1 -3.923 -2.035l1.634 -8.173a5 5 0 0 1 4.904 -4.019h3.4z",
        "M14 15l4.07 4.284a2.3 2.3 0 0 0 3.925 -2.023l-1.6 -8.232",
        "M8 9v2",
        "M7 10h2",
        "M14 10h2",
    ],
    cube: [
        "M21 16.008v-8.018a1.98 1.98 0 0 0 -1 -1.717l-7 -4.008a2.016 2.016 0 0 0 -2 0l-7 4.008c-.619 .355 -1 1.01 -1 1.718v8.018c0 .709 .381 1.363 1 1.717l7 4.008a2.016 2.016 0 0 0 2 0l7 -4.008c.619 -.355 1 -1.01 1 -1.718z",
        "M12 22v-10",
        "M12 12l8.73 -5.04",
        "M3.27 6.96l8.73 5.04",
    ],
    trophy: [
        "M8 21l8 0",
        "M12 17l0 4",
        "M7 4l10 0",
        "M17 4v8a5 5 0 0 1 -10 0v-8",
        "M5 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        "M19 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
    ],
    music: [
        "M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",
        "M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",
        "M9 17v-13h10v13",
        "M9 8h10",
    ],
    flask: [
        "M9 3l6 0",
        "M10 9l4 0",
        "M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6",
    ],
    home: [
        "M5 12l-2 0l9 -9l9 9l-2 0",
        "M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7",
        "M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6",
    ],
    "chart-line": ["M4 19l16 0", "M4 15l4 -6l4 2l4 -5l4 4"],
    world: [
        "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0",
        "M3.6 9h16.8",
        "M3.6 15h16.8",
        "M11.5 3a17 17 0 0 0 0 18",
        "M12.5 3a17 17 0 0 1 0 18",
    ],
    heart: [
        "M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572",
    ],
    star: [
        "M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z",
    ],
    bolt: ["M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"],
    briefcase: [
        "M3 7m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z",
        "M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2",
        "M12 12l0 .01",
        "M3 13a20 20 0 0 0 18 0",
    ],
    camera: [
        "M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2",
        "M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",
    ],
    shield: [
        "M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3",
    ],
};

const PICKABLE_ICONS = [
    "rocket",
    "bulb",
    "leaf",
    "palette",
    "book",
    "code",
    "device-gamepad-2",
    "cube",
    "trophy",
    "music",
    "flask",
    "home",
    "chart-line",
    "world",
    "heart",
    "star",
    "bolt",
    "briefcase",
    "camera",
    "shield",
];


// Carga la configuración del usuario y aplica el tema y color de acento seleccionados.
let settings = API.getSettings();
if (!ACCENTS[settings.accent]) settings.accent = "blue";


// Recarga toda la interfaz
function refreshUI() {
    updateCurrentUserAvatar();
    updateLoginButton();
    render();
};

// Centraliza la aplicación visual de los ajustes para que los cambios
// de tema y color se reflejen sin recargar la página.
function applySettings() {
    const root = document.documentElement
    const isDark = settings.theme === "dark";
    const [accentColor, softColor] = ACCENTS[settings.accent][isDark ? "dark" : "light"];

    root.dataset.theme = isDark ? "dark" : "light";
    root.style.setProperty("--accent", accentColor);
    root.style.setProperty("--soft", softColor);
    root.style.setProperty("--accent-ink", isDark ? "#0f1218" : "#ffffff");
}


// Renderiza el formulario de configuración con los botones de selección de tema y color de acento
function renderSettings() {
    const modeButtons = [
        ["light", "Claro"],
        ["dark", "Oscuro"],
    ].map(([value, label]) => `
        <button type="button" data-set-theme="${value}" aria-pressed="${settings.theme === value}">${label}
        </button>`).join("");


    const swatches = Object.entries(ACCENTS).map(([key, option]) =>`
        <button type="button" class="swatch" style="--sw:${option.light[0]}" data-set-accent="${key}" aria-pressed="${settings.accent === key}" aria-label="${option.label}" title="${option.label}">
        </button>`).join("");


    $("#settings_form").innerHTML = `
    <h2>Configuración</h2>
    
    <div class="lbl">Modo
        <div class="seg">${modeButtons}</div>
    </div>
    
    <div class="lbl">Color de acento
        <div class="swatches">${swatches}</div>
    </div>
    
    <div class="lbl">Noticia destacada del inicio
        <div class="seg">
            <button type="button" data-set-news="true" aria-pressed="${settings.showNews !== false}">Mostrar</button>
            <button type="button" data-set-news="false" aria-pressed="${settings.showNews === false}">Ocultar</button>
        </div>
    </div>
    
    <div class="lbl">Resumen del inicio
        <div class="seg">
            <button type="button" data-set-stats="true" aria-pressed="${settings.showStats !== false}">Mostrar</button>
            <button type="button" data-set-stats="false" aria-pressed="${settings.showStats === false}">Ocultar</button>
        </div>
    </div>
    
    <div class="actions">
        <button type="button" class="btn pri" data-close-settings>Listo</button>
    </div>`;
}


// Reenderiza el diálogo de configuración y lo muestra
function openSettings() {
    renderSettings();
    $("#settings_dialog").showModal();
}


// Escucha los clics en el documento para manejar cambios de tema, color de acento, visibilidad de noticias y estadísticas, y cierre del diálogo de configuración.
document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    // Maneja el cambio de tema
    if (button.dataset.setTheme) {
        settings = API.saveSettings({...settings, theme: button.dataset.setTheme});
        applySettings();
        renderSettings();

    // Maneja el cambio de color de acento
    } else if (button.dataset.setAccent) {
        settings = API.saveSettings({...settings, accent: button.dataset.setAccent});
        applySettings();
        renderSettings();

    // Maneja la visibilidad de noticias
    } else if (button.dataset.setNews) {
        settings = API.saveSettings({...settings,showNews: button.dataset.setNews === "true"});
        renderSettings();
        render();

    // Maneja la visibilidad de estadísticas
    } else if (button.dataset.setStats) {
        settings = API.saveSettings({...settings,showStats: button.dataset.setStats === "true"});
        renderSettings();
        render();

    // Cierra el diálogo de configuración
    } else if ("closeSettings" in button.dataset) $("#settings_dialog").close();
});

// Aplica los ajustes de tema y color de acento al cargar la página
applySettings();

// Renderiza una sección lateral con un título, un contador, acciones y filas de contenido.
const sideSection = (title, count, actionHtml, rowsHtml) => `
    <section class="panel side-section">
        <div class="panel-head">
            <div class="panel-title">
                <h2>${title}</h2>
                <span>${count}</span>
            </div>
            
            ${actionHtml}
        </div>
        
        <div class="rows">
            ${rowsHtml}
        </div>
    </section>`;

// Escapa caracteres especiales en una cadena para evitar problemas de seguridad y formato en HTML.
const safeUrl = (value) => /^(https?:\/\/|data:image\/)/i.test(value.trim()) ? value.trim() : "";

// Genera el HTML para la sección de héroe con la noticia más reciente
function heroHtml() {
    const latest = sortedNews()[0];
    if (!latest) return "";

    return `
        <section class="hero">
            <div class="hero-media">
                ${latest.banner ? `<img src="${esc(latest.banner)}" alt="" loading="lazy">` : ""}
            </div>
            
            <div class="hero-body">
                <span class="eyebrow">Última noticia · ${fmtDay(latest.createdAt)}</span>
                <h2>${esc(latest.title)}</h2>
                
                <div class="md clamp">
                    ${MarkdownRenderer.render(latest.desc)}
                </div>

                <button class="btn pri" data-gonews>Leer más ${tablerSvg("arrow-right", 16)}</button>
            </div>
        </section>`;
}


// Escucha los errores de carga de imágenes y elimina las imágenes que no se pudieron cargar en la sección de héroe o en los banners de noticias.
const handleImageError = (event) => {
    const failed = event.target;
    if (failed.matches && failed.matches(".hero-media img,.newsbanner")) failed.remove();
}


document.addEventListener( "error", (event) => handleImageError(event),true);


// Renderiza un icono de Tabler con un nombre y tamaño especificados.
const tablerSvg = (name, size) => `<svg class="ti" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(TABLER_ICONS[name] || []).map((pathData) => `<path d="${pathData}"/>`).join("")}</svg>`;

// Verifica si un icono es un icono de Tabler válido.
const isTablerIcon = (icon) =>
    typeof icon === "string" &&
    icon.startsWith("tabler:") &&
    Boolean(TABLER_ICONS[icon.slice(7)]);

// Escapa caracteres especiales en una cadena de color hex para evitar problemas de seguridad y formato en HTML.
const safeColor = (value) =>
    /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#334155";


// Genera el HTML para un icono de proyecto, ya sea un icono de Tabler o un icono personalizado.
function iconMarkup(project, size) {
    return isTablerIcon(project.icon)
        ? tablerSvg(project.icon.slice(7), size)
        : project.icon
            ? esc(project.icon)
            : tablerSvg("rocket", size);
}

// Genera el HTML para un cuadro de icono de proyecto, incluyendo un color de fondo y un icono.
function iconBox(project) {
    const color = safeColor(project.iconColor);
    const tint = isTablerIcon(project.icon) || !project.icon
            ? `style="color:${color};background:color-mix(in srgb,${color} 14%,var(--surface))"`
            : ``;

    return `<div class="ico" aria-hidden="true"${tint}>${iconMarkup(project, 24)}</div>`;
}

// Renderiza un selector de iconos de Tabler para elegir un icono de proyecto.
function drawTablerPicker() {
    $("#project_icon_picker").innerHTML = PICKABLE_ICONS.map((name) => `
        <button type="button" data-tabler="${name}" aria-pressed="${projectDraft.icon === "tabler:" + name}" aria-label="Icono ${name}" title="${name}">
            ${tablerSvg(name, 20)}
        </button>`,
    ).join("");
}


// Marca los bloques de texto con la clase "clamp" que tienen contenido que se desborda, agregando la clase "cut" a esos bloques.
function markClamps() {
    document
        .querySelectorAll(".clamp")
        .forEach((block) =>
            block.classList.toggle("cut", block.scrollHeight > block.clientHeight + 1),
        );
}

// Espera a que las fuentes estén listas antes de marcar los bloques de texto con la clase "clamp".
if (document.fonts) document.fonts.ready.then(markClamps);


// Actualiza la visibilidad del punto de notificación en el botón de campana según si hay noticias recientes.
function refreshBell() {
    const bellDot = document.querySelector("#news_notifications_button .dot");
    if (bellDot)
        bellDot.hidden = !news.some(
            (item) =>
                Date.now() - new Date(item.createdAt).getTime() <
                14 * 24 * 60 * 60 * 1000,
        );
}

// Escucha los clics en el botón de notificaciones de noticias
$("#news_notifications_button").onclick = () => {location.hash = "noticias"};


// Genera el HTML para la sección de estadísticas, incluyendo proyectos en progreso, noticias recientes y discusiones recientes.
function statsHtml() {
    const isRecent = (isoDate) =>
        Date.now() - new Date(isoDate).getTime() < 14 * 24 * 60 * 60 * 1000;

    const newestFirst = (first, second) =>
        second.createdAt.localeCompare(first.createdAt);

    const row = (attribute, targetId, title, isoDate) => `
        <button class="mini-row" ${attribute}="${targetId}">    
            <b>${esc(title)}</b>
            <small>${fmtDay(isoDate)}</small>
        </button>`;

    const inProgress = projects
        .filter((project) => project.status === "En progreso")
        .sort(newestFirst);

    const recentNews = sortedNews().filter((item) => isRecent(item.createdAt));
    const recentDiscussions = discussions
        .filter((discussion) => isRecent(discussion.createdAt))
        .sort(newestFirst);

    const card = (title, iconName, tone, items, toRow) => `
        <section class="stat-card">
            <div class="stat-head">
                <span class="stat-ico tone-${tone}">${tablerSvg(iconName, 20)}</span>
                
                <div class="stat-text">
                    <span class="stat-label">${title}</span>
                    <b class="stat-count">${items.length}</b>
                </div>
            </div>

            ${items.length ? `<div class="mini-list">${items.slice(0, 3).map(toRow).join("")}</div>` : ""}
        </section>`;

    // Renderiza las tres tarjetas de estadísticas
    return `
        <div class="stats">
            ${card("Proyectos en progreso", "loader", "blue", inProgress, 
                (project) => row("data-open", project.id, project.title, project.createdAt))}
                
            ${card("Noticias recientes", "news", "green", recentNews, 
                (item) => row("data-gonews", "", item.title, item.createdAt))}
                
            ${card("Discusiones recientes", "messages", "purple", recentDiscussions, 
                (discussion) => row("data-opendisc", discussion.id, discussion.title, discussion.createdAt))}
                
        </div>`;
}


// Analiza una cadena de texto separada por comas y devuelve un array de etiquetas únicas
const parseTags = (text) => [
    ...new Set(text
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
    ),
];

// Genera el HTML para mostrar las etiquetas de un proyecto
const tagsHtml = (tags) =>
    tags && tags.length
        ? `<div class="chips">${tags.map((tag) => `<span class="chip tag">${esc(tag)}</span>`).join("")}</div>`
        : '<span class="muted">Sin etiquetas</span>';


// Devuelve las noticias ordenadas por fecha de creación, de más reciente a más antigua
const sortedNews = () =>
    news
        .slice()
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt));


// Genera el HTML para la sección de noticias en el panel laaterl, mostrando las noticias más recientes y un botón para ver todas las noticias.
function newsPanel() {
    // Si la configuración indica que no se deben mostrar noticias, se omite la primera noticia
    const skip = settings.showNews === false ? 0 : 1;

    const others = sortedNews().slice(skip, skip + 3);
    if (!others.length) return "";

    // Genera las filas de las noticias
    const rows =
        others
            .map((item) =>
                `<button class="drow" data-gonews>
                    <b>${esc(item.title)}</b>
                    <small>${fmtDay(item.createdAt)}</small>
                </button>`,
            ).join("") || '<p class="muted">Aún no hay noticias.</p>';

    return sideSection("Noticias", news.length, '<button class="btn" data-gonews>Ver todas</button>',rows);
}



function renderNews() {
    const canManage = API.isAdmin(API.ME);
    const items =
        sortedNews()
            .map((item) => `
                <article class="upd paper">
                    ${item.banner ? `<img class="newsbanner" src="${esc(item.banner)}" alt="" loading="lazy">` : ""}
                    
                    <div class="uhd">
                        <h3>${esc(item.title)}</h3>
                        
                        <span class="muted">${fmtDate(item.createdAt)}</span>
                        
                        ${canManage ? `
                        <div class="actw">
                            <button class="btn actbtn" data-acts aria-expanded="false" aria-label="Acciones de la noticia">⋯</button>
                            
                            <div class="acts">
                                <button class="btn" data-editnews="${item.id}">Editar</button>
                                <button class="btn del" data-delnews="${item.id}">Eliminar</button>
                            </div>
                        </div>` : ""}

                    </div>
                    
                    <div class="md">
                        ${MarkdownRenderer.render(item.desc)}
                    </div>
                </article>`,
            ).join("") || '<p class="muted">Aún no hay noticias.</p>';


    app.innerHTML = `
        <div class="head">
            <h1>Noticias</h1>
            <span>${news.length}</span>

            <div class="head-actions">
                ${canManage ? 
                '<button class="btn pri" data-newnews>+ Nueva noticia</button>' : ""}
                <button class="btn" data-backhome>Volver al inicio</button>
            </div>
        </div>
        
        <div class="list news-list">
            ${items}
        </div>`;
}


// Variable para almacenar el ID de la noticia que se está editando
let editingNewsId = null;

// Abre el diálogo de noticias para crear una nueva noticia o editar una existente
function openNews(newsId) {
    const item = newsId ? API.findNews(newsId) : null;
    editingNewsId = item ? item.id : null;
    newsForm.innerHTML = `
        <h2>${item ? "Editar noticia" : "Nueva noticia"}</h2>

        <label>Título
            <input type="text" id="news_title_input" value="${esc(item ? item.title : "")}">
        </label>

        <label>Banner (URL de imagen)
            <input type="text" id="news_banner_input" value="${esc(item ? item.banner || "" : "")}" placeholder="https://…">
        </label>
        
        <label>Descripción (Markdown)
            <textarea id="news_description_input">${esc(item ? item.desc : "")}</textarea>
        </label>
        
        <div class="actions">
            <button type="button" class="btn" data-ncancel>Cancelar</button>
            <button type="submit" class="btn pri">Guardar noticia</button>
        </div>`;

    // Muestra el diálogo de noticias y enfoca el campo de título
    newsDialog.showModal();
    $("#news_title_input").focus();
}


// Escucha el evento de envío del formulario de noticias para crear o actualizar una noticia
newsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = $("#news_title_input").value.trim();

    // Valida que el título no esté vacío
    if (!title) {
        $("#news_title_input").focus();
        $("#news_title_input").placeholder = "El título es obligatorio";
        return;
    }

    // Crea el payload con los datos de la noticia
    const payload = {
        title,
        description: $("#news_description_input").value,
        banner: safeUrl($("#news_banner_input").value),
    };

    // Si se está editando una noticia existente, actualiza la noticia; de lo contrario, crea una nueva noticia
    try {
        if (editingNewsId) await API.updateNews(editingNewsId, payload);
        else await API.createNews(payload);

        newsDialog.close();
        render();
    } catch (error) {
        console.error("No se pudo guardar la noticia:", error);
        alert("No se pudo guardar la noticia.");
    }
});


// Escucha los clics en el documento para manejar la navegación a noticias, creación, edición y eliminación de noticias, así como el cierre del diálogo de noticias.
document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    // Boton de ir a noticias
    if (button.dataset.gonews !== undefined) location.hash = "noticias";
    // Boton de abrir noticia específica
    else if (button.dataset.newnews !== undefined) openNews();
    // Boton de editar noticia específica
    else if (button.dataset.editnews) openNews(button.dataset.editnews);
    // Boton de eliminar noticia específica
    else if (button.dataset.delnews) {
        const item = API.findNews(button.dataset.delnews);
        if (item && confirm(`¿Eliminar la noticia “${item.title}”?`)) {
            API.deleteNews(item.id)
                .then(() => render())
                .catch((error) => {
                    console.error("No se pudo eliminar la noticia:", error);
                    alert("No se pudo eliminar la noticia.");
                });
        }

    // Boton de cerrar el diálogo de noticias
    } else if (button.dataset.ncancel !== undefined) newsDialog.close();
});


// Redirige al usuario a la sección de noticias cuando se hace clic en el botón de noticias
$("#news_button").onclick = () => {location.hash = "noticias"};

// Escucha los cambios en el hash de la URL para actualizar la vista de la aplicación y cerrar cualquier sección expandida.
window.addEventListener("hashchange", () => {
    expanded = false;
    render();
});


// Renderiza la vista inicial de la aplicación al cargar la página
refreshUI();
Promise.all([API.restoreSession(), API.loadUsers(), API.loadDiscussions(), API.loadNews()])
    .then(() => refreshUI())
    .catch(() => refreshUI());