// ─────────────────────────────────────────────────────────────
//  MANEJADORES DE INTERFAZ Y EVENTOS DE INICIO (NÚCLEO)
// ───────────────────────────────────────────────────────────── 

document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });
document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });

function cleanJSON(raw) {
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
                        return;
                    }
                    cuenta = c;
                    nombrePaciente = c[0]?.v ? String(c[0].v).trim() : 'Paciente';
                    break;
                }
            }

            if (!cuenta) {
                errTxt.innerText = "Usuario o contraseña incorrectos.";
                return;
            }

            const urlPaciente = cuenta[4]?.v ? String(cuenta[4].v).trim() : '';
            const idPaciente = limpiarYExtraerId(urlPaciente);

            if (!idPaciente) {
                errTxt.innerText = "La URL del paciente en la columna E no es válida.";
                return;
            }

            document.getElementById('main-title').innerText = `Plan de Nutrición: ${nombrePaciente}`;
            document.getElementById('personalized-welcome').innerText = `Dashboard exclusivo y personalizado para ${nombrePaciente}`;
            errBox.style.display = "none";
            document.getElementById('login-screen').style.display = "none";
            document.getElementById('dashboard-screen').style.display = "block";

            cargarDatosNutricionales(idPaciente);
        })
    
        function inicializarSelectorDias() {
    const select = document.getElementById('day-selector');
    const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const hoy = new Date().getDay(); // 0 es Domingo, 1 es Lunes...
    const indexHoy = hoy === 0 ? 6 : hoy - 1; // Ajuste para que Lunes sea 0

    dias.forEach((dia, i) => {
        let opt = document.createElement('option');
        opt.value = dia;
        opt.innerHTML = dia;
        if(i === indexHoy) opt.selected = true;
        select.appendChild(opt);
    });
}
        .catch(err => {
            console.error(err);
            errTxt.innerText = "Error al conectar con la base de datos.";
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

    // Al cerrar sesión, resetear siempre a la primera pestaña por defecto
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
    // 1. Ocultar todas las vistas y remover clases activas
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active-view');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 2. Activar la vista seleccionada y su correspondiente botón
    const vistaDestino = document.getElementById(vistaId);
    if (vistaDestino) {
        vistaDestino.classList.add('active-view');
    }

    const botonActivo = document.querySelector(`[data-view="${vistaId}"]`);
    if (botonActivo) {
        botonActivo.classList.add('active');
    }

    // 3. Disparadores opcionales 
    if (vistaId === 'view-planificacion' && typeof inicializarPlanificacion === 'function') {
        inicializarPlanificacion();
    } else if (vistaId === 'view-diario' && typeof inicializarDiario === 'function') {
        inicializarDiario();
    }
    
    // Scrollear hacia arriba al cambiar de vista en móvil
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
    // Quitar la clase active a todos los botones
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Añadir la clase active al botón pulsado
    btnElement.classList.add('active');

    // Aquí puedes añadir tu lógica futura para cargar los datos en "plan-dia-content"
    console.log("Filtrando planificación para el día:", dia);
}
