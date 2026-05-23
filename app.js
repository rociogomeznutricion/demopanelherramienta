// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN GLOBAL Y ESTADO
// ─────────────────────────────────────────────────────────────
let ingredientesBloqueados = [];
let currentPacienteId = "";
let datosPlanSemanal = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });
    document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });
    inicializarSelectorDias();
});

// ─────────────────────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────────────────────
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
    } catch(e) { return ''; }
}

// ─────────────────────────────────────────────────────────────
//  LOGIN Y DASHBOARD
// ─────────────────────────────────────────────────────────────
function ejecutarLogin() {
    const userIn = document.getElementById('username').value.trim();
    const passIn = document.getElementById('password').value.trim();
    const errBox = document.getElementById('error-box');
    const errTxt = document.getElementById('error-text');

    if (!userIn || !passIn) return;

    fetch(MASTER_CONTROL_URL)
        .then(r => r.text())
        .then(rawData => {
            const json = cleanJSON(rawData);
            const filas = json.table.rows;
            let autenticado = false;

            for (let i = 1; i < filas.length; i++) {
                const c = filas[i].c;
                if (!c) continue;
                const dbUser = String(c[1]?.v || '').trim();
                const dbPass = String(c[2]?.v || '').trim();
                const dbActivo = String(c[3]?.v || 'N').trim().toUpperCase();

                if (dbUser.toLowerCase() === userIn.toLowerCase() && dbPass === passIn) {
                    if (dbActivo !== 'S') {
                        alert("Suscripción inactiva.");
                        return;
                    }
                    currentPacienteId = limpiarYExtraerId(String(c[4]?.v || ''));
                    document.getElementById('login-screen').style.display = "none";
                    document.getElementById('dashboard-screen').style.display = "block";
                    document.getElementById('main-title').innerText = `Plan de Nutrición: ${c[0]?.v || 'Paciente'}`;
                    
                    if (typeof cargarDatosNutricionales === 'function') cargarDatosNutricionales(currentPacienteId);
                    autenticado = true;
                    break;
                }
            }
            if (!autenticado) alert("Usuario o contraseña incorrectos.");
        })
        .catch(e => { console.error(e); alert("Error de conexión al servidor."); });
}

// ─────────────────────────────────────────────────────────────
//  PLANIFICACIÓN SEMANAL (FILTRADA)
// ─────────────────────────────────────────────────────────────
async function cargarPlanSemanal() {
    if (!currentPacienteId) return;
    const gid = '425566588';
    const url = `https://docs.google.com/spreadsheets/d/${currentPacienteId}/gviz/tq?gid=${gid}&tqx=out:json`;
    
    try {
        const response = await fetch(url);
        const json = cleanJSON(await response.text());
        datosPlanSemanal = json.table.rows;
        renderizarDiaSeleccionado(0); // Lunes por defecto
    } catch (e) {
        document.getElementById('plan-grid').innerHTML = "Error al cargar los datos.";
    }
}

function renderizarDiaSeleccionado(idx) {
    if (!datosPlanSemanal[idx]) return;
    const cabeceras = ["Desayuno", "Almuerzo", "Comida", "Merienda", "Cena"];
    let html = `<div class="plan-cards">`;
    for (let i = 0; i < 5; i++) {
        html += `
            <div class="plan-meal-card">
                <strong>${cabeceras[i]}</strong>
                <p>${getCelda(datosPlanSemanal, idx, i + 1)}</p>
            </div>`;
    }
    html += `</div>`;
    document.getElementById('plan-grid').innerHTML = html;
}

function inicializarPlanificacion() {
    const container = document.getElementById('day-selector-container');
    const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    if (container) {
        container.innerHTML = "";
        dias.forEach((dia, index) => {
            const btn = document.createElement('button');
            btn.className = "day-btn";
            btn.innerText = dia.charAt(0);
            btn.onclick = (e) => {
                document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                renderizarDiaSeleccionado(index);
            };
            container.appendChild(btn);
        });
        if(container.firstChild) container.firstChild.classList.add('active');
    }
    cargarPlanSemanal();
}

// ─────────────────────────────────────────────────────────────
//  NAVEGACIÓN Y OTROS
// ─────────────────────────────────────────────────────────────
function cambiarVista(vistaId) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active-view'));
    document.getElementById(vistaId)?.classList.add('active-view');
    
    if (vistaId === 'view-planificacion') inicializarPlanificacion();
    if (vistaId === 'view-diario' && typeof inicializarDiario === 'function') inicializarDiario();
}

function ejecutarGeneracion() {
    const chks = document.querySelectorAll('.ingrediente-check:checked');
    ingredientesBloqueados = Array.from(chks).map(cb => cb.value);
    if (typeof generarPlatoInteligente === 'function') generarPlatoInteligente(ingredientesBloqueados);
}

function inicializarSelectorDias() {
    const select = document.getElementById('day-selector');
    if (select) {
        ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].forEach(d => {
            let opt = document.createElement('option');
            opt.value = d; opt.innerHTML = d;
            select.appendChild(opt);
        });
    }
}

function cerrarSesion() { location.reload(); }
