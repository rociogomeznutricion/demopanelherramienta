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

async function cargarPlanSemanal() {
    if (!currentPacienteId) {
        alert("Primero inicia sesión.");
        return;
    }
    
    const gidRegistroSemanal = '425566588'; 
    const url = `https://docs.google.com/spreadsheets/d/${currentPacienteId}/gviz/tq?gid=${gidRegistroSemanal}&tqx=out:json`;
    
    const container = document.getElementById('plan-grid');
    container.innerHTML = "Cargando...";

    try {
        const response = await fetch(url);
        const text = await response.text();
        const json = cleanJSON(text);
        const rows = json.table.rows;
        
        let html = `<table class="plan-table"><thead><tr>
            <th>Día</th><th>Desayuno</th><th>Almuerzo</th><th>Comida</th><th>Merienda</th><th>Cena</th>
            </tr></thead><tbody>`;
        
        // Asumiendo que A2:A8 son los días y B:F las ingestas (filas 0 a 6)
        for (let i = 0; i < Math.min(rows.length, 7); i++) {
            html += `<tr>
                <td><strong>${getCelda(rows, i, 0)}</strong></td>
                <td>${getCelda(rows, i, 1)}</td>
                <td>${getCelda(rows, i, 2)}</td>
                <td>${getCelda(rows, i, 3)}</td>
                <td>${getCelda(rows, i, 4)}</td>
                <td>${getCelda(rows, i, 5)}</td>
            </tr>`;
        }
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = "Error al cargar los datos.";
        console.error(e);
    }
}
