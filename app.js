/ ─────────────────────────────────────────────────────────────
//  ESTADO GLOBAL
// ─────────────────────────────────────────────────────────────
let ingredientesBloqueados = [];
let currentPacienteId = "";

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });
    document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });
});

// ─────────────────────────────────────────────────────────────
//  LOGIN (Conectado con configurador.js)
// ─────────────────────────────────────────────────────────────
function ejecutarLogin() {
    const userIn = document.getElementById('username').value.trim();
    const passIn = document.getElementById('password').value.trim();
    
    fetch(MASTER_CONTROL_URL)
        .then(r => r.text())
        .then(rawData => {
            const json = JSON.parse(rawData.substring(rawData.indexOf('{'), rawData.lastIndexOf('}') + 1));
            const filas = json.table.rows;
            let encontrado = false;

            for (let i = 1; i < filas.length; i++) {
                const c = filas[i].c;
                if (!c) continue;
                if (String(c[1]?.v || '').trim().toLowerCase() === userIn.toLowerCase() && String(c[2]?.v || '').trim() === passIn) {
                    currentPacienteId = limpiarYExtraerId(String(c[4]?.v || ''));
                    document.getElementById('login-screen').style.display = "none";
                    document.getElementById('dashboard-screen').style.display = "block";
                    
                    // Ahora cargarDatosNutricionales existirá porque configurador.js ya cargó
                    if (typeof cargarDatosNutricionales === 'function') {
                        cargarDatosNutricionales(currentPacienteId);
                    }
                    encontrado = true;
                    break;
                }
            }
            if (!encontrado) alert("Usuario o contraseña incorrectos.");
        }).catch(e => { console.error(e); alert("Error de conexión al Master."); });
}

// ─────────────────────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────────────────────
function limpiarYExtraerId(urlText) {
    let p = urlText.indexOf('/d/');
    if (p === -1) return null;
    let r = urlText.substring(p + 3);
    let f = r.indexOf('/'); if (f === -1) f = r.indexOf('?');
    return (f === -1) ? r.trim() : r.substring(0, f).trim();
}

function cambiarVista(vistaId) {
   document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active-view'));
    const view = document.getElementById(vistaId);
    if (view) view.classList.add('active-view');
    
    // Llamada segura a la función global
    if (vistaId === 'view-planificacion' && typeof window.inicializarPlanificacion === 'function') {
        window.inicializarPlanificacion();
    }
}

function cerrarSesion() { location.reload(); }
