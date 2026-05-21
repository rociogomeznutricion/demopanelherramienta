// ─────────────────────────────────────────────────────────────
//  MANEJADORES DE INTERFAZ Y NAVEGACIÓN MÓVIL (SPA)
// ─────────────────────────────────────────────────────────────

document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });
document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });

// Cambiar de pestaña (Navegación Inferior)
function switchTab(tabId, buttonElement) {
    // Ocultar todas las pestañas
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    // Quitar active de los botones de navegación
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activar pestaña y botón correspondientes
    document.getElementById(tabId).classList.add('active');
    buttonElement.classList.add('active');
    
    // Scroll hacia arriba automático al cambiar de pestaña
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Selector Visual de Días de la semana
function seleccionarDia(dia) {
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const btnActivo = document.getElementById(`day-${dia}`);
    if (btnActivo) btnActivo.classList.add('active');
    
    // Guardamos el día seleccionado en nuestro estado global para futuros usos (como guardar en Sheets)
    platoInteligenteActual.diaSeleccionado = dia;
}

// Auto-seleccionar el día real de hoy en base al sistema
function inicializarDiaDeHoy() {
    const diasEquivalencia = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
    const numeroDia = new Date().getDay(); // 0 = Domingo, 1 = Lunes...
    const stringDiaHoy = diasEquivalencia[numeroDia];
    seleccionarDia(stringDiaHoy);
}

// Helpers de formateo y extracción
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
                        errTxt.innerText = "Suscripción inactiva.";
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
                errTxt.innerText = "URL de paciente inválida.";
                return;
            }

            document.getElementById('main-title').innerText = nombrePaciente;
            errBox.style.display = "none";
            document.getElementById('login-screen').style.display = "none";
            document.getElementById('dashboard-screen').style.display = "block";

            // Forzar volver a la pestaña de inicio ("Diario") al loguear
            switchTab('tab-plan', document.getElementById('nav-plan'));

            cargarDatosNutricionales(idPaciente);
        })
        .catch(err => {
            console.error(err);
            errTxt.innerText = "Error al conectar con el servidor.";
        });
}

function cerrarSesion() {
    document.getElementById('dashboard-screen').style.display = "none";
    document.getElementById('login-screen').style.display = "flex";
    document.getElementById('username').value = "";
    document.getElementById('password').value = "";
    document.getElementById('plate-output').style.display = "none";
    document.getElementById('salvavidas-output').style.display = "none";
    
    bloquesAsignadosPorIngesta = {};
    poolProteinas = []; poolCarbohidratos = []; poolGrasas = []; poolBuscadorCompleto = [];
    platoInteligenteActual = { p: null, hc: null, g: null, ingesta: "", diaSeleccionado: "LUNES" };
    exclusionesPaciente = { tagsExcluir: [], alimentosOdiados: [] }; 
}

// ─── Carga e Inyección de datos Nutricionales ───
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
        
        // Autoseleccionar el día de hoy al cargar todo con éxito
        inicializarDiaDeHoy();
    }).catch(err => {
        console.error(err);
        document.getElementById('sync-status').innerText = "Error de carga";
        document.getElementById('sync-status').style.background = "#ffeeec";
        document.getElementById('sync-status').style.color = "#991b1b";
    });
}

// ─── Procesar hoja MASTER del paciente ───
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

    function redondMult(valor) {
        return Math.round(valor / 0.5) * 0.5;
    }

    bloquesAsignadosPorIngesta = {};
    const grid = document.getElementById('meal-grid');
    let html = "";

    const mealEmojisApp = { "DESAYUNO": "🍞", "ALMUERZO": "🥗", "COMIDA": "🍳", "MERIENDA": "🍪", "CENA": "🌙" };

    MEAL_NAMES.forEach((nombre, i) => {
        const pct = percentages[i] || 0;
        const p   = redondMult(totalP  * pct);
        const hc  = redondMult(totalHC * pct);
        const g   = redondMult(totalG  * pct);

        bloquesAsignadosPorIngesta[nombre] = { p, hc, g };
        
        // Formatear texto (ej: Desayuno)
        const nombreBonito = nombre.charAt(0) + nombre.slice(1).toLowerCase();
        const emoji = mealEmojisApp[nombre] || "🍽️";

        html += `
            <div class="meal-card-app">
                <div class="meal-title-app">${emoji} ${nombreBonito}</div>
                <ul class="meal-list-app">
                    <li>🥩 Proteínas: <b>${p} bloques</b></li>
                    <li>🌾 Carbohidratos: <b>${hc} bloques</b></li>
                    <li>🥑 Grasas: <b>${g} bloques</b></li>
                </ul>
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

// ─── Generador de Receta Salvavidas Fija ───
function calcularComodinSalvavidas() {
    const ingesta = document.getElementById('salvavidas-selector').value;
    const blq = bloquesAsignadosPorIngesta[ingesta];
    const out = document.getElementById('salvavidas-output');
    out.style.display = "block";

    if (!blq || (blq.p === 0 && blq.hc === 0 && blq.g === 0)) {
        out.innerHTML = `<div class="plate-title">Sin bloques pautados.</div>`;
        return;
    }

    let html = `<div class="plate-title" style="color: var(--amber-text);">
                    <b>${datosComodinFijo.nombreReceta}</b><br>
                    <small style="font-size:11px; color: var(--text-light); font-weight:400;">
                        Cantidades para ${ingesta.toLowerCase()} (${blq.p}P · ${blq.hc}HC · ${blq.g}G)
                    </small>
                </div>`;

    let hayIngredientes = false;

    function procesarMacroComodin(listaIds, bloquesTotales, poolAlimentos, emoji) {
        if (!listaIds || listaIds.length === 0 || bloquesTotales <= 0) return '';
        const bloquesPorAlimento = bloquesTotales / listaIds.length;
        let subHtml = '';

        listaIds.forEach(id => {
            const idClean = id.replace(/\s+/g, '').toUpperCase();
            if (idClean === '') return;

            const matchNum = idClean.match(/\d+/);
            if (!matchNum) return;

            const indice    = parseInt(matchNum[0], 10) - 1;
            const alimento  = poolAlimentos[indice];

            if (alimento) {
                const gBase = alimento.gramos || 0;
                const gramosCalculados = (bloquesPorAlimento * gBase).toFixed(0);
                subHtml += `
                    <div class="plate-item">
                        <span>${emoji} <b>${gramosCalculados}${alimento.unidad || 'g'}</b> de ${alimento.nombre}</span>
                    </div>`;
                hayIngredientes = true;
            }
        });
        return subHtml;
    }

    html += procesarMacroComodin(datosComodinFijo.proteinasIds,     blq.p,  poolProteinas,      '🥩');
    html += procesarMacroComodin(datosComodinFijo.carbohidratosIds, blq.hc, poolCarbohidratos, '🌾');
    html += procesarMacroComodin(datosComodinFijo.grasasIds,        blq.g,  poolGrasas,        '🥑');

    if (datosComodinFijo.libresTexto && datosComodinFijo.libresTexto !== '' && datosComodinFijo.libresTexto.toLowerCase() !== 'ninguno') {
        html += `
            <div class="plate-item" style="background: rgba(0,0,0,0.02); padding: 8px; border-radius: 6px; margin-top: 5px;">
                <span>🧂 <b>Extras libres:</b> ${datosComodinFijo.libresTexto}</span>
            </div>`;
        hayIngredientes = true;
    }

    if (!hayIngredientes) {
        out.innerHTML = `<div class="plate-title">ℹ️ Revisa los IDs de tu receta.</div>`;
        return;
    }

    out.innerHTML = html;
}

// ─── Generador de Combinación Aleatoria/Inteligente ───
function generarPlatoInteligente() {
    const ingesta = document.getElementById('meal-selector').value;
    const blq = bloquesAsignadosPorIngesta[ingesta];
    const out = document.getElementById('plate-output');
    out.style.display = "block";

    if (!blq || (blq.p === 0 && blq.hc === 0 && blq.g === 0)) {
        out.innerHTML = `<div class="plate-title">Sin bloques pautados.</div>`;
        return;
    }

    const ingestaUpper = ingesta.toUpperCase();

    function poolFiltradoPorMomento(pool) {
        const filtrado = pool.filter(item => !item.momentos || item.momentos.length === 0 || item.momentos.includes(ingestaUpper));
        return filtrado.length > 0 ? filtrado : pool;
    }

    const proteinasFiltradas     = poolFiltradoPorMomento(poolProteinas);
    const carbohidratosFiltrados = poolFiltradoPorMomento(poolCarbohidratos);
    const grasasFiltradas        = poolFiltradoPorMomento(poolGrasas);

    let cambiarP = true, cambiarHC = true, cambiarG = true;

    if (platoInteligenteActual.ingesta === ingesta) {
        const chkP = document.getElementById('chk-change-p');
        const chkHC = document.getElementById('chk-change-hc');
        const chkG = document.getElementById('chk-change-g');

        // En la lógica de casillas: si está marcado (checked), significa que el usuario QUIERE CAMBIARLO.
        if (chkP) cambiarP = chkP.checked;
        if (chkHC) cambiarHC = chkHC.checked;
        if (chkG) cambiarG = chkG.checked;
    } else {
        platoInteligenteActual = { p: null, hc: null, g: null, ingesta: ingesta, diaSeleccionado: platoInteligenteActual.diaSeleccionado || 'LUNES' };
    }

    if (blq.p > 0 && proteinasFiltradas.length > 0 && (cambiarP || !platoInteligenteActual.p)) {
        platoInteligenteActual.p = proteinasFiltradas[Math.floor(Math.random() * proteinasFiltradas.length)];
    }
    if (blq.hc > 0 && carbohidratosFiltrados.length > 0 && (cambiarHC || !platoInteligenteActual.hc)) {
        platoInteligenteActual.hc = carbohidratosFiltrados[Math.floor(Math.random() * carbohidratosFiltrados.length)];
    }
    if (blq.g > 0 && grasasFiltradas.length > 0 && (cambiarG || !platoInteligenteActual.g)) {
        platoInteligenteActual.g = grasasFiltradas[Math.floor(Math.random() * grasasFiltradas.length)];
    }

    let html = `<div class="plate-title" style="font-size:13px; color:var(--text-light); font-weight:400; margin-bottom:12px;">
                    Propuesta (${blq.p}P · ${blq.hc}HC · ${blq.g}G). <br><span style="font-size:11px; color:var(--p-color)">☑ Marca para CAMBIAR en el siguiente intento</span>
                </div>`;

    if (platoInteligenteActual.p) {
        const p = platoInteligenteActual.p;
        html += `
            <div class="plate-item">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" id="chk-change-p" checked style="width: 16px; height: 16px;">
                    <label for="chk-change-p">🥩 <b>${(blq.p * (p.gramos || 0)).toFixed(0)}${p.unidad}</b> de ${p.nombre}</label>
                </div>
            </div>`;
    }
    if (platoInteligenteActual.hc) {
        const h = platoInteligenteActual.hc;
        html += `
            <div class="plate-item">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" id="chk-change-hc" checked style="width: 16px; height: 16px;">
                    <label for="chk-change-hc">🌾 <b>${(blq.hc * (h.gramos || 0)).toFixed(0)}${h.unidad}</b> de ${h.nombre}</label>
                </div>
            </div>`;
    }
    if (platoInteligenteActual.g) {
        const g = platoInteligenteActual.g;
        html += `
            <div class="plate-item">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" id="chk-change-g" checked style="width: 16px; height: 16px;">
                    <label for="chk-change-g">🥑 <b>${(blq.g * (g.gramos || 0)).toFixed(0)}${g.unidad}</b> de ${g.nombre}</label>
                </div>
            </div>`;
    }

    out.innerHTML = html;
}

// ─── Extras de Categorías y Buscador ───
function setCategoryFilter(cat, btn) {
    currentCategoryFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ejecutarFiltroCombinado();
}

function ejecutarFiltroCombinado() {
    const text = document.getElementById('search').value.toLowerCase();
    const trs  = document.getElementById('table-body').getElementsByTagName('tr');
    for (let tr of trs) {
        const name = tr.getElementsByTagName('td')[0]?.textContent.toLowerCase() || '';
        const type = tr.getAttribute('data-type') || '';
        tr.style.display = (name.includes(text) && (currentCategoryFilter === 'all' || type === currentCategoryFilter)) ? '' : 'none';
    }
}

// ─── Procesar y Renderizar BBDD de Equivalencias ───
function procesarYRenderizarEquivalencias(raw) {
    const json = cleanJSON(raw);
    const rows = json.table.rows;

    poolProteinas = []; poolCarbohidratos = []; poolGrasas = []; poolBuscadorCompleto = [];

    function txtCelda(row, idx) {
        if (!row || !row[idx] || row[idx].v === null || row[idx].v === undefined) return '';
        return String(row[idx].v).trim();
    }

    function parsearGramos(valStr) {
        if (!valStr) return null;
        const str   = valStr.replace(/\s+/g, '').toLowerCase();
        const match = str.match(/(\d+(?:[.,]\d+)?)/);
        return match ? parseFloat(match[1].replace(',', '.')) : null;
    }

    function norm(str) { return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i].c;
        if (!row) continue;

        const nombreAlimento = txtCelda(row, 1);
        const macroPrincipal = txtCelda(row, 2).toUpperCase();
        const rawGramos      = txtCelda(row, 3);
        const unidadMedida   = txtCelda(row, 4) || 'g';
        const tagF           = txtCelda(row, 5); 
        const tagH           = txtCelda(row, 7); 

        if (!nombreAlimento || /PROTEÍNAS|CARBOHIDRATOS|GRASAS/i.test(nombreAlimento)) continue;
        
        // Exclusiones de paciente
        const nNorm = norm(nombreAlimento);
        const fNorm = norm(tagF);
        const odiados = exclusionesPaciente.alimentosOdiados || [];
        if (odiados.length > 0 && odiados.find(o => nNorm.includes(o))) continue;
        const tagsExcluir = exclusionesPaciente.tagsExcluir || [];
        if (tagsExcluir.length > 0 && tagsExcluir.find(t => fNorm.includes(t))) continue;

        const gramosNumericos = parsearGramos(rawGramos);
        const itemAlimento = {
            nombre:   nombreAlimento,
            gramos:   gramosNumericos,
            unidad:   unidadMedida,
            tipo:     '',
            momentos: tagH.toUpperCase().split(/[,;]+/).map(s => s.trim()).filter(Boolean)
        };

        if (macroPrincipal === 'P' || macroPrincipal.includes('PROT')) {
            itemAlimento.tipo = 'PROTEÍNAS'; poolProteinas.push(itemAlimento); poolBuscadorCompleto.push(itemAlimento);
        } else if (macroPrincipal === 'HC' || macroPrincipal.includes('CARB')) {
            itemAlimento.tipo = 'CARBOHIDRATOS'; poolCarbohidratos.push(itemAlimento); poolBuscadorCompleto.push(itemAlimento);
        } else if (macroPrincipal === 'G' || macroPrincipal.includes('GRAS')) {
            itemAlimento.tipo = 'GRASAS'; poolGrasas.push(itemAlimento); poolBuscadorCompleto.push(itemAlimento);
        } else if (macroPrincipal === 'MIXTO') {
            itemAlimento.tipo = 'ALIMENTOS MIXTOS'; itemAlimento.gramos = null; itemAlimento.unidad = rawGramos; poolBuscadorCompleto.push(itemAlimento);
        }
    }

    const tbody = document.getElementById('table-body');
    let htmlTable = '';

    poolBuscadorCompleto.forEach(item => {
        let bClass = 'bg-p';
        if      (item.tipo === 'CARBOHIDRATOS')    bClass = 'bg-hc';
        else if (item.tipo === 'GRASAS')           bClass = 'bg-g';
        else if (item.tipo === 'ALIMENTOS MIXTOS') bClass = 'bg-m';

        const visualizacionCantidad = item.tipo === 'ALIMENTOS MIXTOS' ? `<i>${item.unidad || 'Ver'}</i>` : `${item.gramos !== null ? item.gramos + item.unidad : '—'}`;

        htmlTable += `<tr data-type="${item.tipo.toLowerCase()}">
            <td><strong>${item.nombre}</strong></td>
            <td>${visualizacionCantidad}</td>
            <td><span class="badge ${bClass}">${item.tipo.split(' ')[0]}</span></td>
        </tr>`;
    });

    tbody.innerHTML = htmlTable;

    let obsG = [], obsI = [];
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
        if (rows[i]?.c) {
            if (rows[i].c[8]?.v)  obsG.push(String(rows[i].c[8].v).trim());
            if (rows[i].c[9]?.v)  obsI.push(String(rows[i].c[9].v).trim());
        }
    }

    document.getElementById('obs-grid').innerHTML = `
        <div class="obs-card">
            <div class="obs-title">${obsG[0] || 'Info'}</div>
            <div class="obs-content">${obsG.slice(1).filter(Boolean).join('<br>')}</div>
        </div>
        <div class="obs-card c2">
            <div class="obs-title">${obsI[0] || 'Pautas'}</div>
            <div class="obs-content">${obsI.slice(1).filter(Boolean).join('<br>')}</div>
        </div>
        <div class="obs-card c3">
            <div class="obs-title">Notas de tu Nutri</div>
            <div class="obs-content">${(datosComodinFijo.obsPacientePersonalizada || []).filter(Boolean).join('<br>')}</div>
        </div>`;
}
