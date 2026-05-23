// Variable global para controlar qué ingredientes están bloqueados  (fijos)
let ingredientesBloqueados = []; 

// Modifica la función generarPlatoInteligente para que llame a la lógica con el estado
function ejecutarGeneracion() {
    // Obtenemos los IDs de los checkboxes marcados
    const checkboxes = document.querySelectorAll('.ingrediente-check:checked');
    ingredientesBloqueados = Array.from(checkboxes).map(cb => cb.value);
    
    // Llamamos a la lógica real de generación (asegúrate de que esta función exista en configurador.js)
    generarPlatoInteligente(ingredientesBloqueados);
}

// ─────────────────────────────────────────────────────────────
//  MANEJADORES DE INTERFAZ Y EVENTOS DE INICIO (NÚCLEO)
// ───────────────────────────────────────────────────────────── 

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });
    document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });
    inicializarSelectorDias();
});

function cleanJSON(raw) {
    // La respuesta de Google Sheets gviz suele venir como: google.visualization.Query.setResponse({...});
    // Esta función limpia el JSON
    return JSON.parse(raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); 
}

function limpiarYExtraerId(urlText) {
    if (!urlText || typeof urlText !== 'string') return null;
    let p = urlText.indexOf('/d/');
    if (p === -1) return null;
    let recortado = urlText.substring(p + 3);
    let fin = recortado.indexOf('/');
    if (fin === -1) fin = recortado.indexOf('?');
    if (fin === -1) return recortado.trim();
    return recortado.substring(0, fin).trim();
}

function getCelda(rows, rowIdx, colIdx) {
    try {
        const v = rows[rowIdx].c[colIdx]?.v;
        return v !== null && v !== undefined ? String(v).trim() : '';
    } catch(e) {
        return '';
    }
}

function debugLog(msg) {
    const panel = document.getElementById('debug-panel');
    if (panel) panel.textContent += msg + '\n';
}

// ─── Control de Login ───
function ejecutarLogin() {
    const userIn = document.getElementById('username').value.trim();
    const passIn = document.getElementById('password').value.trim();
    const errBox = document.getElementById('error-box');
    const errTxt = document.getElementById('error-text');

    if (!userIn || !passIn) {
        errTxt.innerText = "Completa todos los campos.";
        errBox.style.display = "flex";
        return;
    }

    errTxt.innerText = "Validando...";
    errBox.style.display = "flex";

    fetch(MASTER_CONTROL_URL)
        .then(r => r.text())
        .then(rawData => {
            const json = cleanJSON(rawData);
            const filas = json.table.rows;
            let cuenta = null;
            let nombrePaciente = "Paciente";

            for (let i = 1; i < filas.length; i++) {
                const c = filas[i].c;
                if (!c) continue;
                const dbUser   = c[1]?.v ? String(c[1].v).trim() : '';
                const dbPass   = c[2]?.v ? String(c[2].v).trim() : '';
                const dbActivo = c[3]?.v ? String(c[3].v).trim().toUpperCase() : 'N';

                if (dbUser.toLowerCase() === userIn.toLowerCase() && dbPass === passIn) {
                    if (dbActivo !== 'S') {
                        errTxt.innerText = "Suscripción inactiva. Consulte con su nutricionista.";
                        errBox.style.display = "flex";
                        return;
                    }
                    cuenta = c;
                    nombrePaciente = c[0]?.v ? String(c[0].v).trim() : 'Paciente';
                    break;
                }
            }

            if (!cuenta) {
                errTxt.innerText = "Usuario o contraseña incorrectos.";
                errBox.style.display = "flex";
                return;
            }

            const urlPaciente = cuenta[4]?.v ? String(cuenta[4].v).trim() : '';
            const idPaciente = limpiarYExtraerId(urlPaciente);
            currentPacienteId = idPaciente; // <--- AÑADE ESTA LÍNEA

            if (!idPaciente) {
                errTxt.innerText = "La URL del paciente en la columna E no es válida.";
                errBox.style.display = "flex";
                return;
            }

            document.getElementById('main-title').innerText = `Plan de Nutrición: ${nombrePaciente}`;
            document.getElementById('personalized-welcome').innerText = `Dashboard exclusivo y personalizado para ${nombrePaciente}`;
            errBox.style.display = "none";
            document.getElementById('login-screen').style.display = "none";
            document.getElementById('dashboard-screen').style.display = "block";

            cargarDatosNutricionales(idPaciente);
        })
        .catch(err => {
            console.error(err);
            errTxt.innerText = "Error al conectar con la base de datos.";
            errBox.style.display = "flex";
        });
}

function inicializarSelectorDias() {
    const select = document.getElementById('day-selector');
    if (!select) return;
    const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const hoy = new Date().getDay(); 
    const indexHoy = hoy === 0 ? 6 : hoy - 1; 

    dias.forEach((dia, i) => {
        let opt = document.createElement('option');
        opt.value = dia;
        opt.innerHTML = dia;
        if(i === indexHoy) opt.selected = true;
        select.appendChild(opt);
    });
}

function cerrarSesion() {
    document.getElementById('dashboard-screen').style.display = "none";
    document.getElementById('login-screen').style.display = "flex";
    document.getElementById('username').value = "";
    document.getElementById('password').value = "";
    document.getElementById('plate-output').style.display = "none";
    document.getElementById('salvavidas-output').style.display = "none";
    document.getElementById('debug-panel').textContent = "";
    
    bloquesAsignadosPorIngesta = {};
    poolProteinas = []; poolCarbohidratos = []; poolGrasas = []; poolBuscadorCompleto = [];
    platoInteligenteActual = { p: null, hc: null, g: null, ingesta: "" };
    exclusionesPaciente = { tagsExcluir: [], alimentosOdiados: [] }; 

    cambiarVista('view-configurador');
}

function cargarDatosNutricionales(spreadsheetId) {
    document.getElementById('sync-status').innerText = "Sincronizando...";
    document.getElementById('sync-status').style.background = "#fef3c7";
    document.getElementById('sync-status').style.color = "#92400e";

    const urlMaster = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?gid=${GID_PACIENTE_MASTER}&tqx=out:json`;
    const urlEquiv  = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID_EQUIV_GLOBAL}/gviz/tq?gid=${GID_EQUIV_GLOBAL}&tqx=out:json`;

    Promise.all([
        fetch(urlMaster).then(r => r.text()),
        fetch(urlEquiv).then(r => r.text())
    ]).then(([dataMaster, dataEquiv]) => {
        procesarMasterPaciente(dataMaster);
        procesarYRenderizarEquivalencias(dataEquiv);

        document.getElementById('sync-status').innerText = "Sincronizado ✓";
        document.getElementById('sync-status').style.background = "#dcfce7";
        document.getElementById('sync-status').style.color = "#15803d";
    }).catch(err => {
        console.error(err);
        document.getElementById('sync-status').innerText = "Error al cargar";
        document.getElementById('sync-status').style.background = "#ffeeec";
        document.getElementById('sync-status').style.color = "#991b1b";
    });
}

function procesarMasterPaciente(raw) {
    const json = cleanJSON(raw);
    const rows = json.table.rows;

    const alergiasRaw          = getCelda(rows, 0, 4); 
    const alimentosOdiadosRaw = getCelda(rows, 1, 4); 

    function normPerfil(str) {
        return String(str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/[,;]+/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    exclusionesPaciente = {
        tagsExcluir:      normPerfil(alergiasRaw),         
        alimentosOdiados: normPerfil(alimentosOdiadosRaw)  
    };

    datosComodinFijo.nombreReceta = getCelda(rows, 2, 4) || "Receta Comodín"; 

    const pRaw = getCelda(rows, 3, 4); 
    datosComodinFijo.proteinasIds = pRaw ? pRaw.split(',').map(id => id.trim().toUpperCase()).filter(id => id !== '') : [];

    const hcRaw = getCelda(rows, 4, 4); 
    datosComodinFijo.carbohidratosIds = hcRaw ? hcRaw.split(',').map(id => id.trim().toUpperCase()).filter(id => id !== '') : [];

    const gRaw = getCelda(rows, 5, 4); 
    datosComodinFijo.grasasIds = gRaw ? gRaw.split(',').map(id => id.trim().toUpperCase()).filter(id => id !== '') : [];

    datosComodinFijo.libresTexto = getCelda(rows, 6, 4); 

    const totalP  = parseFloat(String(getCelda(rows, 10, 1)).replace(',', '.')) || 0;
    const totalG  = parseFloat(String(getCelda(rows, 11, 1)).replace(',', '.')) || 0;
    const totalHC = parseFloat(String(getCelda(rows, 12, 1)).replace(',', '.')) || 0;

    const percentages = [];
    for (let i = 0; i < 5; i++) {
        const filaIndex  = 13 + i;
        const valorCelda = getCelda(rows, filaIndex, 1);
        let val = parseFloat(String(valorCelda).replace(',', '.')) || 0;
        if (val > 1) val = val / 100;
        percentages.push(val);
    }

    function redondMult(valor) { return Math.round(valor / 0.5) * 0.5; }

    bloquesAsignadosPorIngesta = {};
    const grid = document.getElementById('meal-grid');
    let html = "";

    MEAL_NAMES.forEach((nombre, i) => {
        const pct = percentages[i] || 0;
        const p   = redondMult(totalP  * pct);
        const hc  = redondMult(totalHC * pct);
        const g   = redondMult(totalG  * pct);

        bloquesAsignadosPorIngesta[nombre] = { p, hc, g };

        const icon = mealIcons[nombre] || "fa-utensils";
        html += `
            <div class="meal-card">
                <div class="meal-name"><i class="fa-solid ${icon}"></i> ${nombre}</div>
                <div class="meal-content">
                    🥩 Proteínas: <strong>${p} bloques</strong><br>
                    🌾 Carbohidratos: <strong>${hc} bloques</strong><br>
                    🥑 Grasas: <strong>${g} bloques</strong>
                </div>
            </div>`;
    });

    grid.innerHTML = html;

    datosComodinFijo.obsPacientePersonalizada = [];
    for (let i = 0; i < rows.length; i++) {
        if (rows[i]?.c && rows[i].c[5]?.v !== undefined && rows[i].c[5]?.v !== null) {
            datosComodinFijo.obsPacientePersonalizada.push(String(rows[i].c[5].v).trim());
        }
    }
}

// ─── CONTROLADOR DEL MENÚ DE NAVEGACIÓN (SISTEMA DE RUTAS) ───
function cambiarVista(vistaId) {
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active-view');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const vistaDestino = document.getElementById(vistaId);
    if (vistaDestino) {
        vistaDestino.classList.add('active-view');
    }

    const botonActivo = document.querySelector(`[data-view="${vistaId}"]`);
    if (botonActivo) {
        botonActivo.classList.add('active');
    }

    if (vistaId === 'view-planificacion' && typeof cargarPlanSemanal === 'function') {
       // inicializarPlanificacion();
        cargarPlanSemanal();
    } else if (vistaId === 'view-diario' && typeof inicializarDiario === 'function') {
        inicializarDiario();
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function guardarPlan() {
    const contenido = document.getElementById('plate-output').innerText;
    const dia = document.getElementById('day-selector').value;
    const ingesta = document.getElementById('meal-selector').value;
    
    if(!contenido || contenido.includes("Sugerir")) {
        alert("Primero genera un menú.");
        return;
    }

    const payload = {
        paciente: document.getElementById('main-title').innerText,
        dia: dia,
        ingesta: ingesta,
        contenido: contenido
    };

    fetch("https://script.google.com/macros/s/AKfycbyIMROnmkS1MVYK0t9eCCYFgE7YuHVFqdOnreu0ldeIdp5OFikyagBsoOu2HLqCIyRo/exec", {
        method: "POST",
        body: JSON.stringify(payload)
    }).then(() => alert("¡Plan guardado en el Sheet para el " + dia + "!"));
}

// ─── CONTROLADOR DE DÍAS (PLANIFICACIÓN) ───
function seleccionarDia(dia, btnElement) {
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    btnElement.classList.add('active');
    console.log("Filtrando planificación para el día:", dia);
}

// Variable global para almacenar el ID del paciente tras el login
let currentPacienteId = ""; 

// IMPORTANTE: Asegúrate de guardar el ID en la función ejecutarLogin()
// En tu función ejecutarLogin, cuando obtienes 'idPaciente', añade:
// currentPacienteId = idPaciente;



// ─────────────────────────────────────────────────────────────
//  FUNCIÓN DE LOGIN RECUPERADA
// ─────────────────────────────────────────────────────────────
function ejecutarLogin() {
    const userInput = document.getElementById('username');
    const passInput = document.getElementById('password');
    
    // 1. Comprobamos que el usuario haya escrito algo
    if (!userInput || userInput.value.trim() === "") {
        alert("Por favor, introduce tu usuario.");
        return;
    }

    // 2. Guardamos el ID del paciente (tu sistema usa currentPacienteId)
    currentPacienteId = userInput.value.trim();

    // 3. Ocultamos la pantalla de login
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.style.display = 'none';
    }

    // 4. Activamos la primera vista (Configurador)
    if (typeof cambiarVista === 'function') {
        cambiarVista('view-configurador');
    } else {
        console.warn("Aviso: No se ha encontrado la función cambiarVista.");
    }
}
// ─────────────────────────────────────────────────────────────
//  MÓDULO: PLANIFICACIÓN NUTRICIONAL (VERSIÓN BURBUJAS)
// ───────────────────────────────────────────────────────────── 

// Guardamos los datos aquí para no tener que recargarlos de internet cada vez que tocas un botón
let datosPlanificacionGlobal = []; 

window.inicializarPlanificacion = async function() {
    console.log("[Módulo Planificación] Cargando datos del paciente:", currentPacienteId);
    
    const gidRegistroSemanal = '425566588'; 
    const url = `https://docs.google.com/spreadsheets/d/${currentPacienteId}/gviz/tq?gid=${gidRegistroSemanal}&tqx=out:json`;
    
    // Buscamos el div principal donde va todo
    const container = document.getElementById('view-planificacion'); 
    
    try {
        // Ponemos un mensajito mientras Google nos responde
        container.innerHTML = "<p style='text-align:center; padding: 20px;'>Cargando tu planificación...</p>";
        
        const response = await fetch(url);
        const json = cleanJSON(await response.text());
        
        // Guardamos las 7 filas (Lunes a Domingo) en nuestra variable global
        datosPlanificacionGlobal = json.table.rows; 

        // 1. Construimos la botonera de L a D
        construirInterfazDias(container);
        
        // 2. Simulamos que hacemos "clic" en el Lunes (índice 0) para que no salga la pantalla vacía
        seleccionarDia(0);
        
    } catch (e) {
        console.error("Error al cargar planificación:", e);
        container.innerHTML = "<p style='text-align:center; color: var(--p-color); padding: 20px;'>Error al cargar los datos. Revisa tu conexión.</p>";
    }
};

function construirInterfazDias(container) {
    const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    
    // Titulo de la sección
    let html = `<div class="section-title">📅 Tu Semana al Detalle</div>`;
    
    // Contenedor de las burbujas (centradas y alineadas)
    html += `<div style="display: flex; gap: 12px; justify-content: center; margin-bottom: 25px; flex-wrap: wrap;">`;
    
    // Creamos un botón por cada letra del array 'dias'
    dias.forEach((dia, index) => {
        html += `<button class="day-btn" id="btn-dia-${index}" onclick="seleccionarDia(${index})" 
                 style="width: 45px; height: 45px; border-radius: 50%; border: none; font-weight: 600; cursor: pointer; font-size: 15px; transition: all 0.2s;">
                 ${dia}
                 </button>`;
    });
    html += `</div>`;

    // Debajo de los botones, dejamos un "hueco" donde luego inyectaremos el texto de las comidas
    html += `<div id="contenedor-comidas-dia"></div>`;

    container.innerHTML = html;
}

window.seleccionarDia = function(indexDia) {
    // 1. Reseteamos los colores de todos los botones para apagarlos
    const todosLosBotones = document.querySelectorAll('.day-btn');
    todosLosBotones.forEach(btn => {
        btn.classList.remove('active');
        btn.style.backgroundColor = 'var(--white, #ffffff)'; 
        btn.style.color = 'var(--text-light, #64748b)';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
    });

    // 2. Encendemos solo el botón que hemos tocado (el activo)
    const botonActivo = document.getElementById(`btn-dia-${indexDia}`);
    if (botonActivo) {
        botonActivo.classList.add('active');
        // Colores que encajan con tu tema azul (blue-accent)
        botonActivo.style.backgroundColor = 'var(--blue-accent, #0047ab)';
        botonActivo.style.color = '#ffffff';
        botonActivo.style.boxShadow = '0 4px 8px rgba(0, 71, 171, 0.3)';
        botonActivo.style.transform = 'scale(1.05)';
    }

    // 3. Llamamos a la función que dibuja el texto de la dieta
    renderizarComidasDelDia(indexDia);
};

function renderizarComidasDelDia(indexDia) {
    const contenedor = document.getElementById('contenedor-comidas-dia');
    if (!contenedor || !datosPlanificacionGlobal[indexDia]) return;

    // Cogemos solo la fila del excel que pertenece a este día
    const filaDia = datosPlanificacionGlobal[indexDia];
    const ingestas = ['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena'];
    
    // Función de seguridad por si alguna celda en Google Sheets está vacía
    const getTextoSeguro = (columna) => {
        if (filaDia.c && filaDia.c[columna] && filaDia.c[columna].v) {
            return filaDia.c[columna].v;
        }
        return "<i style='color: #94a3b8;'>Libre o sin asignar</i>";
    };

    let htmlComidas = "";

    // En Sheets: Columna 0 es el Nombre del Día, la 1 es Desayuno, la 2 Almuerzo...
    // Recorremos las 5 comidas creando una tarjeta para cada una
    ingestas.forEach((nombreIngesta, i) => {
        const contenido = getTextoSeguro(i + 1); 
        
        // Usamos las clases que ya existen en tu styles.css
        htmlComidas += `
            <div class="plan-meal-card" style="margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div class="plan-meal-header" style="color: var(--blue-accent, #0047ab);">
                    <i class="fa-solid fa-utensils"></i> <strong>${nombreIngesta}</strong>
                </div>
                <div style="color: var(--text-dark, #1e293b); font-size: 15px; line-height: 1.6; margin-top: 10px; white-space: pre-line;">
                    ${contenido}
                </div>
            </div>
        `;
    });

    // Volcamos todo el texto en el hueco que preparamos antes
    contenedor.innerHTML = htmlComidas;
}

// ─────────────────────────────────────────────────────────────
//  ENLACE A LA PLANIFICACIÓN POR BURBUJAS
// ─────────────────────────────────────────────────────────────
function cargarPlanificacionSemanal() {
    if (!currentPacienteId) {
        alert("Primero inicia sesión.");
        return;
    }
    
    // Si existe nuestra función de burbujas, la ejecutamos
    if (typeof inicializarPlanificacion === 'function') {
        inicializarPlanificacion();
    } else {
        console.error("No se ha encontrado la función inicializarPlanificacion en planificacion.js");
    }
}
// ─────────────────────────────────────────────────────────────
//  ENLACE A LA PLANIFICACIÓN POR BURBUJAS (CON NOMBRE CORRECTO)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  ENLACE A LA PLANIFICACIÓN POR BURBUJAS (CON NOMBRE CORRECTO)
// ─────────────────────────────────────────────────────────────
function cargarPlanSemanal() {
    if (!currentPacienteId) {
        alert("Primero inicia sesión.");
        return;
    }
    
    // Si existe nuestra nueva función de burbujas, la ejecutamos
    if (typeof inicializarPlanificacion === 'function') {
        inicializarPlanificacion();
    } else {
        console.error("No se ha encontrado la función inicializarPlanificacion en planificacion.js");
    }
}
