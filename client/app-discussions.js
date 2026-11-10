// Dialogo y formulario para crear una nueva discusión
const dform = $("#discussion_form")
const ddlg = $("#discussion_dialog")

// Elementos de búsqueda de proyectos
const searchInput = $("#project_search_input")
const searchResults = $("#project_search_results")

// Elementos de navegación de la barra principal y menú de usuario
const main_navigation = $("#main_navigation")
const navToggle = $("#navigation_toggle_button");

// Elementos del modal de usuario y botón de avatar
const user_menu = $("#user_menu")
const avatarButton = $("#user_avatar_button");


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


// Convierte un texto en un slug válido para usar en URLs o identificadores.
const slug = (text) => text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");


// Convierte las menciones válidas en enlaces o etiquetas sin modificar
// el contenido que ya ha sido generado como HTML seguro.
function parseMentions(html) {
    return html
        .split(/(<[^>]+>)/)
        .map((segment, index) =>
            // Si el segmento es un tag HTML, no lo procesamos. Solo procesamos el texto plano.
            index % 2
                ? segment
                : segment.replace(
                    // Detecta menciones de usuario (@usuario) y proyecto (#proyecto) en el texto.
                    /(^|[\s(])([@#])([A-Za-z0-9_-]+)/g,
                    // Reemplaza la mención por un enlace o etiqueta según corresponda.
                    (fullMatch, prefix, sigil, key) => {
                        key = key.toLowerCase();

                        // Mención de usuario
                        if (sigil === "@") {
                            const user = API.USERS.find((usr) => usr.username === key);
                            return user
                                ? `${prefix}<span class="men" title="${esc(user.nick)}">@${user.username}</span>`
                                : fullMatch;
                        }
                        
                        // Mención de proyecto
                        if (sigil === "#") {
                            const project = projects.find((entry) => slug(entry.title) === key);
                            return project
                                ? `${prefix}<a class="men" href="#proyecto-${project.id}" title="${esc(project.title)}">#${key}</a>`
                                : fullMatch;
                        }
                    },
                ),
        ).join("");
}

// Mantiene el estado de la vista expandida o colapsada de la lista de discusiones.
let expanded = false;
let renderedHash = null;


function sugUpdate(textarea) {
    // Actualiza las sugerencias de menciones según el texto actual en el textarea.
    const suggestionBox = $("#mention_suggestions")
    const mentionMatch = textarea.value
            .slice(0, textarea.selectionStart)
            .match(/(^|\s)([@#])([A-Za-z0-9_-]*)$/);

    // Si no hay @ o # seguido de texto, ocultamos el cuadro de sugerencias.
    if (!mentionMatch) {
        suggestionBox.hidden = true;
        return;
    }

    // Obtenemos la consulta de búsqueda a partir del texto después del @ o #.
    const query = mentionMatch[3].toLowerCase();
    const items = (
        mentionMatch[2] === "@"
            ? API.USERS.filter((user) =>
                        user.username.includes(query) ||
                        user.nick.toLowerCase().includes(query),
                    ).map((user) => ["@" + user.username, user.nick])
            : projects
                .filter((project) => slug(project.title).includes(query))
                .map((project) => ["#" + slug(project.title), (isTablerIcon(project.icon) ? "" : project.icon + " ") + project.title])
    ).slice(0, 6);


    // Renderizamos los botones de sugerencia en el cuadro de sugerencias.
    suggestionBox.innerHTML = items
        .map(([value, label]) => `<button type="button" data-ins="${value}"><span>${esc(label)}</span><small>${value}</small></button>`)
        .join("");

    // Mostramos u ocultamos el cuadro de sugerencias según si hay elementos para mostrar.
    suggestionBox.hidden = !items.length;
}


// Inserta la mención seleccionada en el textarea en la posición actual del cursor.
function insertMention(mentionText) {
    const textarea = $("#message_text_input")
    const pos = textarea.selectionStart
    const textBefore =
        textarea.value.slice(0, pos).replace(/[@#][A-Za-z0-9_-]*$/, "") +
        mentionText +
        " ";

    textarea.value = textBefore + textarea.value.slice(pos);
    textarea.focus();
    textarea.setSelectionRange(textBefore.length, textBefore.length);
    $("#mention_suggestions").hidden = true;
}


// Escucha los eventos de entrada en el textarea para actualizar las sugerencias de menciones.
document.addEventListener("input", (event) => {
    if (event.target.id === "message_text_input") sugUpdate(event.target);
});


// Devuelve las iniciales de un nombre o nick, útil para mostrar avatares de usuario.
const initials = (name) =>
    (name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase();


// Genera el DOM del panel de discusiones, mostrando la lista de hilos y un botón para crear uno nuevo.
function discPanel() {
    const rows = discussions
            .slice()
            .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
            .map((discussion) => `
                <button class="drow" data-opendisc="${discussion.id}">
                    <b>${esc(discussion.title)}</b>
                    <small>Por ${esc(resolveUser(discussion.owner).nick)}, ${fmtDay(discussion.createdAt)}</small>
                    <small class="replies">${tablerSvg("message", 14)} ${discussion.messages.length} ${discussion.messages.length === 1 ? "respuesta" : "respuestas"}</small>
                </button>`,
            ).join("") || '<p class="muted">Aún no hay discusiones.</p>';

    // Renderiza la sección lateral de discusiones con el número total de hilos y un botón para crear uno nuevo.
    return sideSection(
        "Discusiones",
        discussions.length,
        '<button class="btn pri" data-newdisc>+ Nueva</button>',
        rows,
    );
}


// Carga y renderiza la vista de discusión según el hash de la URL, mostrando el hilo seleccionado o la lista de discusiones.
function renderChat(discussion) {
    const msgs =discussion.messages
        .map((message) =>`
        <div class="msg">
            <div class="avatar sm${resolveUser(message.author).username === API.ME ? "" : " oth"}" aria-hidden="true">
                ${esc(initials(resolveUser(message.author).nick))}
            </div>
            <div class="mb">

                <div class="mh">
                    <b>${esc(resolveUser(message.author).nick)}</b>
                    <span class="muted">@${esc(resolveUser(message.author).username)}
                    </span>

                    ${resolveUser(message.author).username === resolveUser(discussion.owner).username ? '<span class="op">OP</span>' : ""}

                    <span class="muted">${fmtMsg(message.date)}</span>
                </div>

                <div class="mt md">
                    ${parseMentions(MarkdownRenderer.render(message.text, true))}
                </div>
            </div>
        </div>`,
        ).join("") || '<p class="muted">Aún no hay mensajes. Escribe el primero.</p>';


    app.innerHTML = `
    <div class="detail">
        <div class="dhead">
            <h1>${esc(discussion.title)}</h1>
            ${API.canDelete(discussion) ? `<button class="btn del" data-deldisc="${discussion.id}">Eliminar hilo</button>` : ""}
            
            <button class="btn" data-backhome>Volver al inicio</button>
        </div>
        
        <p class="muted" style="margin:0">Creada por <b>${esc(resolveUser(discussion.owner).nick)}</b> (@${esc(resolveUser(discussion.owner).username)}) el ${fmtDate(discussion.createdAt)}</p>

        <div class="conversation_messages" id="conversation_messages">
            ${msgs}
        </div>
        
        <form class="message_form" id="message_form">
            <div class="mention_suggestions" id="mention_suggestions" hidden></div>
            
            <textarea id="message_text_input" rows="2" placeholder="Escribe en Markdown. Usa @usuario o #proyecto…" aria-label="Mensaje"></textarea>
            <button type="submit" class="btn pri">Enviar</button>
        </form>
    </div>`;


    const chatLog = $("#conversation_messages");
    chatLog.scrollTop = chatLog.scrollHeight;
}


// Envía un mensaje en la discusión actual, si hay texto válido en el textarea.
function sendMsg() {
    const discussionMatch = location.hash.match(/^#discusion-(\w+)$/)
    const textarea = $("#message_text_input");

    if (!discussionMatch || !textarea) return;

    const text = textarea.value.trim();
    if (!text) return;

    API.sendMessage(discussionMatch[1], text);

    renderChat(API.findDiscussion(discussionMatch[1]));
    $("#message_text_input").focus();
}


// Abre el diálogo para crear una nueva discusión, mostrando un formulario con un campo de título.
function openNewDisc() {
    dform.innerHTML = `
    <h2>Nueva discusión</h2>
    
    <label>Título
        <input type="text" id="discussion_title_input">
    </label>
    
    <p class="muted" style="margin:0">Se creará a nombre de ${esc(API.currentUser().nick)}.</p>

    <div class="actions">
        <button type="button" class="btn" data-dcancel>Cancelar</button>
        <button type="submit" class="btn pri">Crear discusión</button>
    </div>`;

    // Muestra el diálogo y enfoca el campo de título para que el usuario pueda empezar a escribir inmediatamente.
    ddlg.showModal();
    $("#discussion_title_input").focus();
}


// Escucha el evento de envío del formulario de nueva discusión, valida el título y crea la discusión si es válido.
dform.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#discussion_title_input").value.trim();

    // Si el título está vacío, enfoca el campo y muestra un mensaje de error.
    if (!title) {
        $("#discussion_title_input").focus();
        $("#discussion_title_input").placeholder = "El título es obligatorio";
        return;
    }

    // Crea la nueva discusión a través de la API, cierra el diálogo y navega al hilo recién creado.
    const discussion = API.createDiscussion(title);
    ddlg.close();
    location.hash = "discusion-" + discussion.id;
});


// Escucha el evento de envío del formulario de mensaje
document.addEventListener("submit", (event) => {
    // Si el formulario enviado es el de mensaje, llama a la función para enviar el mensaje.
    if (event.target.id === "message_form") {
        event.preventDefault();
        sendMsg();
    }
});


// Escucha los clics en botones de la página para manejar acciones como abrir discusiones, crear nuevas, eliminar, etc.
document.addEventListener("click", (event) => {
    // Si el elemento presionado no es un boton, retornaar
    const clickedButton = event.target.closest("button");
    if (!clickedButton) return;


    // Abre la discusion
    if (clickedButton.dataset.opendisc) location.hash = "discusion-" + clickedButton.dataset.opendisc;
    // Abre el dialogo de nueva discusion
    else if ("newdisc" in clickedButton.dataset) openNewDisc();
    // Cierra el dialogo de nueva discusion
    else if ("dcancel" in clickedButton.dataset) ddlg.close();
    // Elimina la discusion
    else if (clickedButton.dataset.deldisc) {
        // Busca la discusión correspondiente al botón presionado y solicita confirmación antes de eliminarla.
        const discussion = API.findDiscussion(clickedButton.dataset.deldisc);
        if (confirm(`¿Eliminar el hilo “${discussion.title}”? Esta acción no se puede deshacer.`) && API.deleteDiscussion(discussion.id)) {
            location.hash = "";
        }

    } 
    // Vuelve a la vista principal de discusiones
    else if ("backhome" in clickedButton.dataset) location.hash = "";
    // Alterna la vista expandida o colapsada de la lista de discusiones
    else if ("toggleall" in clickedButton.dataset) {
        expanded = !expanded;
        render();

    // Inserta una mención en el textarea si se selecciona una sugerencia de usuario o proyecto.
    } else if (clickedButton.dataset.ins)
        insertMention(clickedButton.dataset.ins);
});


// Filtra los proyectos cargados según la consulta de búsqueda, devolviendo un máximo de 8 resultados que
// coincidan con el título, propietario, estado, descripción, colaboradores o etiquetas.
function filterProjects(query, loadedProjects) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return loadedProjects.filter((project) =>
            [
                project.title,
                project.owner,
                project.status,
                project.desc,
                ...(project.collabs || []),
                ...(project.tags || []),
            ].join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
        .slice(0, 8);
}


// Realiza la búsqueda de proyectos según el texto ingresado en el campo de búsqueda y actualiza la lista de resultados.
function doSearch() {
    const query = searchInput.value.trim();

    // Si la consulta está vacía, oculta los resultados de búsqueda y retorna.
    if (!query) {
        searchResults.hidden = true;
        return;
    }

    // Encuentra los proyectos que coinciden con la consulta 
    const hits = filterProjects(query, projects);


    // Renderiza los resultados de búsqueda en el contenedor correspondiente, mostrando un mensaje si no hay coincidencias.
    searchResults.innerHTML = hits.length
        ? hits.map((project) =>`
            <button data-open="${project.id}">
                <span class="inline-ico">${iconMarkup(project, 16)} ${esc(project.title)}</span>
                <small>${esc(project.owner || "")}</small>
            </button>`).join("")

        : '<p class="muted" style="margin:8px 12px">Sin resultados</p>';
    searchResults.hidden = false;
}


// Escucha los eventos de entrada y enfoque en el campo de búsqueda para realizar la búsqueda en tiempo real.
searchInput.addEventListener("input", doSearch);
searchInput.addEventListener("focus", doSearch);
searchResults.addEventListener("click", () => {
    searchResults.hidden = true;
    searchInput.value = "";
});


// Escucha los clics en el documento para ocultar los resultados de búsqueda si se hace clic fuera del campo de búsqueda.
document.addEventListener("click", (event) => {
    if (!event.target.closest(".search_bar")) searchResults.hidden = true;
});


// Escucha los eventos de teclado para manejar acciones como cerrar sugerencias, enviar mensajes o cerrar menús.
document.addEventListener("keydown", (event) => {
    // Si se presiona Escape, oculta los resultados de búsqueda y el cuadro de sugerencias de menciones.
    if (event.key === "Escape") {
        searchResults.hidden = true;
        const suggestionBox = $("#mention_suggestions");
        if (suggestionBox) suggestionBox.hidden = true;
    }

    // Si se presiona Enter en el campo de texto del mensaje y no se mantiene Shift, envía el mensaje.
    if ( event.target.id === "message_text_input" && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMsg();
    }
});



// Función para abrir o cerrar la navegación principal
const setNav = (isOpen) => {
    main_navigation.classList.toggle("open", isOpen);
    navToggle.setAttribute("aria-expanded", isOpen);
};


// Escucha el clic en el botón de alternar la navegación para abrir o cerrar el menú principal.
navToggle.onclick = (event) => {
    event.stopPropagation();
    setNav(!main_navigation.classList.contains("open"));
};


// Escucha los clics en la navegación principal para cerrar el menú si se hace clic en un botón dentro de ella.
main_navigation.addEventListener("click", (event) => {
    if (event.target.closest("button")) setNav(false);
});


// Escucha los clics en el documento para cerrar la navegación principal si se hace clic fuera de ella.
document.addEventListener("click", (event) => {
    if (!event.target.closest(".top")) setNav(false);
});


// Escucha los clics en el documento para manejar la apertura y cierre de menús de acciones asociados a botones con el atributo data-acts.
document.addEventListener("click", (event) => {
    const actionToggle = event.target.closest("[data-acts]");

    // Cierra todos los menús de acciones abiertos que no sean el que se acaba de hacer clic.
    document.querySelectorAll(".acts.open").forEach((actionsMenu) => {
        if (!actionToggle || actionsMenu !== actionToggle.nextElementSibling)
            actionsMenu.classList.remove("open");
    });

    // Si se hizo clic en un botón con data-acts, alterna la visibilidad del menú de acciones correspondiente.
    if (actionToggle) {
        const actionsMenu = actionToggle.nextElementSibling;
        actionsMenu.classList.remove("flip");
        actionsMenu.classList.toggle("open");

        // Si el menú de acciones se abre y su borde derecho se sale de la ventana, agrega la clase "flip" para ajustar su posición.
        if ( actionsMenu.classList.contains("open") && actionsMenu.getBoundingClientRect().right > window.innerWidth - 8) actionsMenu.classList.add("flip");

        // Actualiza el atributo aria-expanded del botón para reflejar el estado del menú de acciones.
        actionToggle.setAttribute( "aria-expanded", actionsMenu.classList.contains("open"),);
    }
});


// Función para abrir o cerrar el menú de usuario
const setMenu = (isOpen) => {
    user_menu.hidden = !isOpen;
    avatarButton.setAttribute("aria-expanded", isOpen);
};


// Escucha el clic en el botón de avatar del usuario para abrir o cerrar el menú de usuario.
avatarButton.onclick = (event) => {
    event.stopPropagation();
    setMenu(user_menu.hidden);
};


// Escucha los clics en el menú de usuario para manejar acciones como navegación, cierre de sesión, inicio de sesión con Discord o apertura de configuración.
user_menu.addEventListener("click", (event) => {
    const menuButton = event.target.closest("button");
    if (!menuButton) return;
    setMenu(false);

    if (menuButton.dataset.nav) location.hash = menuButton.dataset.nav;
    if (menuButton.dataset.logout) API.logout().then(() => render());
    if (menuButton.dataset.loginDiscord !== undefined) API.loginWithDiscord();
    if (menuButton.dataset.openSettings !== undefined) openSettings();
});


// Escucha los clics en el documento para cerrar el menú de usuario si se hace clic fuera de él.
document.addEventListener("click", (event) => {
    if (!user_menu.contains(event.target)) setMenu(false);
});


// Escucha los eventos de teclado para cerrar el menú de usuario si se presiona la tecla Escape.
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
});
