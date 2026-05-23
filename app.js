// ─────────────────────────────────────────────────────────────
//  ESTADO GLOBAL
// ─────────────────────────────────────────────────────────────
let ingredientesBloqueados = [];
let currentPacienteId = "";
let datosPlanSemanal = [];

// ─────────────────────────────────────────────────────────────
//  INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Si no existen estas constantes, las definimos aquí como medida de seguridad
    if (typeof MASTER_CONTROL_URL === 'undefined') {
        window.MASTER_CONTROL_URL = 'https://docs.google.com/spreadsheets/d/1L7lbZ4JkE7dqO_oizMEDKQabtyUBbR4yaqcrt3LMa6Q/gviz/tq?gid=0&tqx=out:json';
    }
    
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
    return recortado.substring(0, fin).trim();
}

function getCelda(rows, rowIdx, colIdx) {
    try { return String(rows[rowIdx].c[colIdx]?.v || '').trim(); } catch(e) { return ''; }
}

// ─────────────────────────────────────────────────────────────
//  LOGIN Y CARGA
// ─────────────────────────────────────────────────────────────
function ejecutarLogin() {
    const userIn = document.getElementById('username').value.trim();
    const passIn = document.getElementById('password').value.trim();
    
    fetch(MASTER_CONTROL_URL)
        .then(r => r.text())
        .then(rawData => {
            const json = cleanJSON(rawData);
            const filas = json.table.rows;
            for (let i = 1; i < filas.length; i++) {
                const c = filas[i].c;
                if (!c) continue;
                if (String(c[1]?.v).trim().toLowerCase() === userIn.toLowerCase() && String(c[2]?.v).trim() === passIn) {
                    currentPacienteId = limpiarYExtraerId(String(c[4]?.v || ''));
                    document.getElementById('login-screen').style.display = "none";
                    document.getElementById('dashboard-screen').style.display = "block";
                    // Llamamos a las funciones que deberían existir en tu app original
                    if (typeof cargarDatosNutricionales === 'function') cargarDatosNutricionales(currentPacienteId);
                    return;
                }
            }
            alert("Usuario o contraseña incorrectos.");
        }).catch(e => { console.error(e); alert("Error de conexión con el Master."); });
}

// ─────────────────────────────────────────────────────────────
//  PLANIFICACIÓN CON FILTROS (L, M, X...)
// ─────────────────────────────────────────────────────────────
async function cargarPlanSemanal() {
    if (!currentPacienteId) return;
    const url = `https://docs.google.com/spreadsheets/d/${currentPacienteId}/gviz/tq?gid=425566588&tqx=out:json`;
    try {
        const res = await fetch(url);
        const json = cleanJSON(await res.text());
        datosPlanSemanal = json.table.rows;
        renderizarDiaSeleccionado(0);
    } catch (e) { document.getElementById('plan-grid').innerHTML = "Error cargando plan."; }
}

function renderizarDiaSeleccionado(idx) {
    if (!datosPlanSemanal[idx]) return;
    const cabeceras = ["Desayuno", "Almuerzo", "Comida", "Merienda", "Cena"];
    let html = `<div class="plan-cards">`;
    for (let i = 0; i < 5; i++) {
        html += `<div class="plan-meal-card"><strong>${cabeceras[i]}</strong><p>${getCelda(datosPlanSemanal, idx, i + 1)}</p></div>`;
    }
    html += `</div>`;
    document.getElementById('plan-grid').innerHTML = html;
}

function inicializarPlanificacion() {
    const container = document.getElementById('day-selector-container');
    if (!container) return;
    container.innerHTML = "";
    const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
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
    cargarPlanSemanal();
}

// ─────────────────────────────────────────────────────────────
//  Navegación y Generación
// ─────────────────────────────────────────────────────────────
function cambiarVista(vistaId) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active-view'));
    document.getElementById(vistaId)?.classList.add('active-view');
    if (vistaId === 'view-planificacion') inicializarPlanificacion();
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
