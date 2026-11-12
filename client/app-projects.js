// Proyectos y formularios. Se carga después de la API y antes de la interfaz.

// Carga una única referencia a cada colección para que las vistas trabajen
// siempre sobre los datos actualizados que mantiene API.
const { projects, discussions, news } = API.loadData();

// Referencia al body del contenido
const app = $("#application")

// Modal de proyecto y formulario de edición/creación de proyecto.
const dlg = $("#project_dialog")
const form = $("#project_form");

// Renderizado de proyectos, formularios y actualizaciones
function render() {
    // Renderiza la página según el hash de la URL y el estado de la aplicación.
    renderPage();
    refreshBell();

    // Renderiza la página de inicio si no hay hash en la URL.
    const home = !location.hash;
    
    // Añade clases CSS para animaciones de entrada y salida.
    // La clase "enter" se usa para animar la entrada de la pagina
    app.className = (home ? "home" : "") + (location.hash !== renderedHash ? " enter" : "");
    
    renderedHash = location.hash;
    
    if (home) {
        const mainColumn = document.createElement("div");

        // Se encarga de mostrar las noticias y discusiones en una columna aparte
        mainColumn.innerHTML = app.innerHTML;
        app.innerHTML = "";
        app.append(mainColumn);
        mainColumn.insertAdjacentHTML(
            "afterend",
            `<div class="sidecol">${newsPanel()}${discPanel()}</div>`,
        );

        // Renderiza estadísticas si están habilitadas en la configuración
        if (settings.showStats) app.insertAdjacentHTML("afterbegin", statsHtml());
        
        // Renderiza noticias si están habilitadas en la configuración
        if (settings.showNews !== false) {
            app.insertAdjacentHTML("afterbegin", heroHtml());
            markClamps();
        }
    }
}





// Renderiza la página según el hash de la URL y el estado de la aplicación.
function renderPage() {
    // Si el hash es "#noticias", renderiza la sección de noticias.
    if (location.hash === "#noticias") {
        renderNews();
        return;
    }

    // Si el hash es "#proyecto-<ID>", renderiza la vista detallada del proyecto.
    const projectMatch = location.hash.match(/^#proyecto-([A-Za-z0-9_-]+)$/);
    const currentProject = projectMatch && API.findProject(projectMatch[1]);
    if (currentProject) {
        renderDetail(currentProject);
        return;
    }

    // Si el hash es "#discusion-<ID>", renderiza la vista de discusión.
    const discussionMatch = location.hash.match(/^#discusion-([A-Za-z0-9_-]+)$/);
    const currentDiscussion = discussionMatch && API.findDiscussion(discussionMatch[1]);
    if (currentDiscussion) {
        renderChat(currentDiscussion);
        return;
    }


    // Si el hash no coincide con ninguna de las condiciones anteriores, renderiza la lista de proyectos.
    renderProjects();
}


function renderProjects() {
    // Si no se encuentra un hash específico, renderiza la lista de proyectos.
    // Determina la vista a mostrar según el hash de la URL (todos los proyectos por defecto)
    let view = 'all';
    let projectsList = projects;

    if (location.hash === "#mis-proyectos") view = "own";
    else if (location.hash === "#mis-colaboraciones") view = "col";
    
    // Filtra la lista de proyectos según la vista seleccionada (propios, colaboraciones o todos)
    if (view === "own") {
        projectsList = projects.filter((project) => same(project.owner, API.currentUser().nick));

    } else if (view === "col") {
        projectsList = projects.filter((project) => project.collabs.some((collaboratorName) => same(collaboratorName, API.currentUser().nick)));

    } 
    

    // Selecciona el título según la vista actual
    const title = {
        own: "Mis proyectos",
        col: "Mis colaboraciones",
        all: "Todos los proyectos",
    }[view];


    // Si no hay proyectos muestra un mensaje indicando que no hay proyectos y un botón para crear uno nuevo.
    if (!projectsList.length) {
        app.innerHTML = `
        <div class="empty">
            <h2>${API.projectsError ? "No se pudieron cargar los proyectos" : "Aún no hay proyectos"}</h2>
            <p>${API.projectsError ? "Comprueba la conexión e inténtalo de nuevo." : "Crea el primero para verlo aquí."}</p>
            ${API.projectsError ? '<button class="btn pri" data-retryprojects>Reintentar</button>' : '<button class="btn pri" data-new>+ Crear proyecto</button>'}
        </div>`;
        return;
    }

    // Renderiza la lista de proyectos.
    app.innerHTML = `
        <section class="panel">
            <div class="panel-head">
                <div class="panel-title">
                    <h2>${title}</h2>
                    <span>${projectsList.length}</span>
                </div>
                
                ${projectsList.length > 4 ? `<button class="link" data-toggleall>${expanded ? "Mostrar menos" : "Ver todos"}${tablerSvg("arrow-right", 16)}</button>` : ""}
            </div>
            <div class="rows">` +
                (expanded ? projectsList : projectsList.slice(0, 4)).map((project) => `
                <button class="tile" data-open="${project.id}">
                    ${iconBox(project)}

                    <span class="tt">
                        <b>${esc(project.title)}</b>
                        <small>Propietario: ${esc(project.owner || "—")}</small>
                    </span>

                    ${badge(project.status)}

                    <span class="dt">${fmtDay(project.createdAt)}</span>
                </button>`).join("") +`
            </div>
        </section>
    `;
}




// Renderiza la vista detallada de un proyecto específico.
function renderDetail(project) {
    // Renderiza los updates del proyecto, ordenados por fecha descendente.
    const updatesDom = (project.updates || [])
        .slice()
        .sort((first, second) => second.date.localeCompare(first.date))
        .map((projectUpdate) =>`
            <article class="upd">
                <div class="uhd">
                    <h3>${esc(projectUpdate.title)}</h3>
                    <span class="muted">${fmtDate(projectUpdate.date)}</span>

                    <div class="actw">
                        <button class="btn actbtn" data-acts aria-expanded="false" aria-label="Acciones del update">⋯</button>
                        <div class="acts">
                            <button class="btn" data-editup="${projectUpdate.id}" data-pid="${project.id}">Editar</button>
                            <button class="btn del" data-delup="${projectUpdate.id}" data-pid="${project.id}">Eliminar</button>
                        </div>
                    </div>
                </div>

                <div class="md">
                    ${MarkdownRenderer.render(projectUpdate.desc)}
                </div>

            </article>`,
        ).join("") || '<p class="muted">Aún no hay updates.</p>';


    // Renderiza los colaboradores
    const chips = project.collabs.length
        ? project.collabs.map((collaborator) => `<span class="chip">${esc(collaborator)}</span>`).join("")
        : '<span class="muted">Sin colaboradores</span>';


    // Renderiza la financiación
    const fund = project.funding.length
        ?   `<ul class="fund">` + project.funding.map((fundingEntry) => `
                <li>
                    <span>${esc(fundingEntry.who)}</span>
                    <span>${esc(fundingEntry.what)}</span>
                </li>`).join("") + 
            `</ul>`
        : '<span class="muted">Sin aportaciones</span>';


    app.innerHTML = `
    <div class="detail">
        <div class="dhead">
            ${iconBox(project)}
            <h1>${esc(project.title)}</h1>

            <div class="actw">
                <button class="btn actbtn" data-acts aria-expanded="false" aria-label="Acciones del proyecto">⋯</button>
                <div class="acts">
                    <button class="btn" data-edit="${project.id}">Editar</button>
                    ${API.canDelete(project) ? `<button class="btn del" data-del="${project.id}">Eliminar</button>` : ""}
                </div>
            </div>
        </div>

        <div class="cols">
            <div class="md">
                ${project.desc.trim() ? MarkdownRenderer.render(project.desc) : '<p class="muted">Sin descripción.</p>'}
            </div>

            <aside class="side">
                <section>
                    <h3>Estado</h3>
                    ${badge(project.status)}
                </section>

                <section>
                    <h3>Fecha de creación</h3>
                    <b>${fmtDate(project.createdAt)}</b>
                </section>
                
                <section>
                    <h3>Propietario</h3>
                    <b>${esc(project.owner || "—")}</b>
                </section>
                
                <section class="${project.tags && project.tags.length ? "" : "side-section--empty"}">
                    <h3>Etiquetas</h3>
                    ${tagsHtml(project.tags)}
                </section>

                <section class="${project.collabs.length ? "" : "side-section--empty"}">
                    <h3>Colaboradores</h3>
                    <div class="chips">${chips}</div>
                </section>

                <section class="${project.funding.length ? "" : "side-section--empty"}">
                    <h3>Financiación</h3>
                    ${fund}
                </section>
            </aside>
        </div>

        <section class="updates">
            <div class="uh">
                <h2>Updates</h2>
                <button class="btn pri" data-newup="${project.id}">+ Añadir update</button>
            </div>
            ${updatesDom}
        </section>
    </div>`;
}



let projectDraft = null;


// Abre el formulario de creación o edición de un proyecto. 
// Si se pasa un proyecto existente, se abre en modo edición; de lo contrario, se abre en modo creación.
function openForm(project) {
    projectDraft = project
        ? JSON.parse(JSON.stringify(project))
        : {
            id: uid(),
            title: "",
            icon: "tabler:rocket",
            iconColor: "#2d4ca3",
            desc: "",
            owner: API.currentUser().nick,
            collabs: [],
            funding: [],
            status: "Ideado",
            createdAt: new Date().toISOString(),
        };


    // Marca si el proyecto es nuevo o existente para determinar si se debe crear o actualizar al guardar.
    projectDraft._new = !project;


    form.innerHTML = `
    <h2>${project ? "Editar proyecto" : "Nuevo proyecto"}</h2>
    <label>Título<input type="text" id="project_title_input" value="${esc(projectDraft.title)}" required></label>

    <label>Estado
        <select id="project_status_select">${STATUS.map((statusName) => 
            `<option${statusName === projectDraft.status ? " selected" : ""}>${statusName}</option>`).join("")}
        </select>
    </label>

    <div class="lbl">Icono
        <div class="emojis" id="project_icon_picker"></div>
        <label class="colorrow">Color del icono
            <input type="color" id="project_icon_color_input" value="${safeColor(projectDraft.iconColor)}">
        </label>
    </div>

    <div class="lbl">
        <div class="row">
            <span>Descripción (Markdown)</span>
            <span class="tabs" style="margin-left:auto">
                <button type="button" data-tab="edit" aria-pressed="true">Editar</button>
                <button type="button" data-tab="prev" aria-pressed="false">Vista previa</button>
            </span>
        </div>

        <textarea id="project_description_input" placeholder="# Título&#10;Usa **negrita**, *cursiva*, listas, enlaces…">${esc(projectDraft.desc)}</textarea>
        <div class="preview md" id="project_description_preview" hidden></div>
    </div>

    <label>Propietario
        <input type="text" id="project_owner_input" value="${esc(projectDraft.owner)}">
    </label>

    <label>Etiquetas (separadas por comas)
        <input type="text" id="project_tags_input" value="${esc((projectDraft.tags || []).join(", "))}" placeholder="diseño, urgente, web">
    </label>

    <div class="lbl">Colaboradores
        <div class="chips" id="project_collaborators_list"></div>
    
        <div class="row">
            <input type="text" id="project_collaborator_input" placeholder="Nombre y pulsa Enter">
            <button type="button" class="btn" data-addcol>Añadir</button>
        </div>
    </div>

    <div class="lbl">Financiación
        <div id="project_funding_list" style="display:flex;flex-direction:column;gap:8px"></div>
    
        <div>
            <button type="button" class="btn" data-addfund>+ Añadir aportación</button>
        </div>
    </div>

    <div class="actions">
        <button type="button" class="btn" data-cancel>Cancelar</button>
        <button type="submit" class="btn pri">Guardar proyecto</button>
    </div>`;

    // Dibuja el selector de iconos, los chips de colaboradores y la lista de financiación.
    drawTablerPicker();
    drawChips();
    drawFund();

    // Muestra el diálogo del formulario y enfoca el campo de título.
    dlg.showModal();
    $("#project_title_input").focus();
}



// Renderiza los chips de colaboradores en el formulario.
function drawChips() {
    $("#project_collaborators_list").innerHTML = projectDraft.collabs.map((collaborator, index) => `
        <span class="chip">${esc(collaborator)}
            <button type="button" data-delcol="${index}" aria-label="Quitar ${esc(collaborator)}">×</button>
        </span>`,
    ).join("");
}


// Renderiza la lista de financiación en el formulario.
function drawFund() {
    $("#project_funding_list").innerHTML = projectDraft.funding.map((fundingEntry, index) => `
        <div class="fr">
            <input type="text" data-fw="${index}" value="${esc(fundingEntry.who)}" placeholder="Persona" aria-label="Persona">
            <input type="text" data-fa="${index}" value="${esc(fundingEntry.what)}" placeholder="Cantidad o recurso" aria-label="Cantidad o recurso">
            
            <button type="button" class="x" data-delfund="${index}" aria-label="Quitar aportación">×</button>
        </div>`,
    ).join("");
}



// Agrega un colaborador al proyecto en el formulario.
function addCol() {
    const collaboratorInput = $("#project_collaborator_input")
    const collaboratorName = collaboratorInput.value.trim();

    if (collaboratorName) {
        projectDraft.collabs.push(collaboratorName);
        collaboratorInput.value = "";
        drawChips();
    }

    collaboratorInput.focus();
}


// Botones de acción para abrir el formulario de creación de proyecto y volver a la página de inicio.
$("#new_project_button").onclick = () => openForm();
$("#home_button").onclick = () => {location.hash = "";};


// Maneja los eventos de clic en los botones de la aplicación.
document.addEventListener("click", (event) => {
    const eventTarget = event.target.closest("button");
    if (!eventTarget) return;

    // Función auxiliar para leer los datos del dataset del botón.
    const readData = (key) => eventTarget.dataset[key];
    const hasData = (key) => key in eventTarget.dataset;

    // Abrir proyecto
    if (readData("open")) {
        location.hash = "proyecto-" + readData("open");

    // Abrir formulario de creación de proyecto
    } else if (hasData("new")) {
        openForm();

    // Reintentar la carga de proyectos desde el servidor.
    } else if (hasData("retryprojects")) {
        API.loadProjects().then(render).catch(() => render());

    // Regresar a la página de inicio
    } else if (hasData("back")) {
        location.hash = "";

    // Abrir formulario de edición de proyecto
    } else if (readData("edit")) {
        openForm(projects.find((project) => project.id === readData("edit")));

    // Eliminar proyecto
    } else if (readData("del")) {
        const project = projects.find((project) => project.id === readData("del"));
        if (confirm(`¿Eliminar “${project.title}”? Esta acción no se puede deshacer.`)) {
            API.deleteProject(project.id)
                .then(() => {
                    location.hash = "";
                    render();
                })
                .catch((error) => alert(`No se pudo eliminar el proyecto: ${error.message}`));
        }

    // Abrir formulario de creación de update
    } else if (readData("newup")) {
        openUp(readData("newup"));

    // Abrir formulario de edición de update
    } else if (readData("editup")) {
        openUp(eventTarget.dataset.pid, readData("editup"));

    // Eliminar update
    } else if (readData("delup")) {
        const project = projects.find((project) => project.id === eventTarget.dataset.pid)
        const projectUpdate = project.updates.find((update) => update.id === readData("delup"));

        if (confirm(`¿Eliminar el update “${projectUpdate.title}”?`)) {
            API.deleteUpdate(project.id, projectUpdate.id)
                .then(render)
                .catch((error) => alert(`No se pudo eliminar el update: ${error.message}`));
        }

    // Cerrar formulario de update
    } else if (hasData("ucancel")) {
        udlg.close();

    // Cancela la edición o creación de proyecto y cierra el diálogo.
    } else if (hasData("cancel")) {
        dlg.close();

    // Establece el icono del proyecto y dibuja el selector de iconos.
    } else if (readData("tabler")) {
        projectDraft.icon = "tabler:" + readData("tabler");
        drawTablerPicker();

    // Cambia entre la vista de edición y la vista previa de la descripción del proyecto (markdown).
    } else if (readData("tab")) {
        const showPreview = readData("tab") === "prev";
        $("#project_description_input").hidden = showPreview;
        $("#project_description_preview").hidden = !showPreview;

        if (showPreview) {
            $("#project_description_preview").innerHTML = MarkdownRenderer.render($("#project_description_input").value) || '<span class="muted">Nada que mostrar.</span>';
        }

        document.querySelectorAll("[data-tab]")
            .forEach((tabButton) => tabButton.setAttribute("aria-pressed", tabButton === eventTarget));

    // Agrega un nuevo colaborador al proyecto.
    } else if (hasData("addcol")) {
        addCol();

    // Elimina un colaborador del proyecto.
    } else if (readData("delcol")) {
        projectDraft.collabs.splice(+readData("delcol"), 1);
        drawChips();

    // Agrega una nueva entrada de financiación al proyecto.
    } else if (hasData("addfund")) {
        projectDraft.funding.push({ who: "", what: "" });
        drawFund();
        const fundingInputs = document.querySelectorAll("[data-fw]");
        fundingInputs[fundingInputs.length - 1].focus();

    // Elimina una entrada de financiación del proyecto.
    } else if (readData("delfund")) {
        projectDraft.funding.splice(+readData("delfund"), 1);
        drawFund();
    }
});


// Maneja los eventos de entrada en el formulario del proyecto para actualizar el borrador del proyecto.
form.addEventListener("input", (event) => {
    const eventTarget = event.target;

    // Actualiza la persona que aporta en la financiación según el índice del dataset.
    if (eventTarget.dataset.fw !== undefined)
        projectDraft.funding[+eventTarget.dataset.fw].who = eventTarget.value;

    // Actualiza la cantidad o recurso que aporta en la financiación según el índice del dataset.
    else if (eventTarget.dataset.fa !== undefined)
        projectDraft.funding[+eventTarget.dataset.fa].what = eventTarget.value;
});


// Maneja el envío del formulario del proyecto para crear o actualizar un proyecto.
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = $("#project_title_input").value.trim();

    // Valida que el título del proyecto no esté vacío antes de continuar.
    if (!title) {
        $("#project_title_input").focus();
        $("#project_title_input").placeholder = "El título es obligatorio";
        return;
    }

    // Agrega el colaborador pendiente si hay alguno en el campo de entrada.
    const pending = $("#project_collaborator_input").value.trim();
    if (pending) projectDraft.collabs.push(pending);

    const fields = {
        title,
        icon: projectDraft.icon || "tabler:rocket",
        iconColor: safeColor(projectDraft.iconColor),
        desc: $("#project_description_input").value,
        owner: $("#project_owner_input").value.trim(),
        collabs: projectDraft.collabs,
        funding: projectDraft.funding.filter((fundingEntry) => fundingEntry.who.trim() || fundingEntry.what.trim()),
        status: $("#project_status_select").value,
        tags: parseTags($("#project_tags_input").value),
    };

    // Establece que ejecutar si el proyecto es nuevo o si se está actualizando uno existente.
    try {
        const project = projectDraft._new
            ? await API.createProject(fields)
            : await API.updateProject(projectDraft.id, fields);

        dlg.close();
        if (projectDraft._new) location.hash = "proyecto-" + project.id;
        else render();
    } catch (error) {
        alert(`No se pudo guardar el proyecto: ${error.message}`);
    }
});



const uform = $("#update_form")
const udlg = $("#update_dialog");
let updateTarget = null;


// Abre el formulario de creación o edición de un update.
function openUp(projectId, updateId) {
    const project = API.findProject(projectId)
    const projectUpdate = updateId
            ? project.updates.find((entry) => entry.id === updateId)
            : null;

    updateTarget = {
        projectId,
        updateId: projectUpdate ? projectUpdate.id : null,
    };

    uform.innerHTML = `
    <h2>${projectUpdate ? "Editar update" : "Nuevo update"}</h2>

    <label>Título
        <input type="text" id="update_title_input" value="${esc(projectUpdate ? projectUpdate.title : "")}">
    </label>

    <label>Descripción (Markdown)
        <textarea id="update_description_input">${esc(projectUpdate ? projectUpdate.desc : "")}</textarea>
    </label>
    
    <div class="actions">
        <button type="button" class="btn" data-ucancel>Cancelar</button>
        <button type="submit" class="btn pri">Guardar update</button>
    </div>`;

    // Muestra el diálogo del formulario de update y enfoca el campo de título.
    udlg.showModal();
    $("#update_title_input").focus();
}


// Maneja el envío del formulario de update para crear o actualizar un update.
uform.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = $("#update_title_input").value.trim();

    // Valida que el título del update no esté vacío antes de continuar.
    if (!title) {
        $("#update_title_input").focus();
        $("#update_title_input").placeholder = "El título es obligatorio";
        return;
    }

    const description = $("#update_description_input").value;

    // Si se está editando un update existente, actualiza el update; de lo contrario, crea un nuevo update.
    try {
        if (updateTarget.updateId) {
            await API.updateUpdate(updateTarget.projectId, updateTarget.updateId, { title, description });
        } else {
            await API.createUpdate(updateTarget.projectId, { title, description });
        }
        udlg.close();
        render();
    } catch (error) {
        alert(`No se pudo guardar el update: ${error.message}`);
    }
});
