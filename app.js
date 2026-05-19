// ─────────────────────────────────────────────────────────────
//  MANEJADORES DE INTERFAZ Y EVENTOS DE INICIO
// ─────────────────────────────────────────────────────────────

document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });
document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarLogin(); });

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
                const dbUser  = c[1]?.v ? String(c[1].v).trim() : '';
                const dbPass  = c[2]?.v ? String(c[2].v).trim() : '';
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
}

// ─── Carga e Inyección de datos Nutricionales ───
function cargarDatosNutricionales(spreadsheetId) {
    document.getElementById('sync-status').innerText = "Sincronizando...";
    document.getElementById('sync-status').style.background = "#fef3c7";
    document.getElementById('sync-status').style.color = "#92400e";

    const urlMaster = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?gid=${GID_PACIENTE_MASTER}&tqx=out:json`;
    const urlEquiv  = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?gid=${GID_EQUIV}&tqx=out:json`;

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

    console.log('[DEBUG] Total filas recibidas de la hoja MASTER:', rows.length);

    // ── 1. Exclusiones (columna E = índice 4) ──
    exclusionesPaciente.estiloVida = getCelda(rows, 0, 4).toUpperCase();

    const tagsRaw = getCelda(rows, 1, 4);
    exclusionesPaciente.tagsExcluir = tagsRaw
        ? tagsRaw.split(',').map(t => t.trim().toUpperCase()).filter(t => t !== '')
        : [];

    const odiadosRaw = getCelda(rows, 2, 4);
    exclusionesPaciente.alimentosOdiados = odiadosRaw
        ? odiadosRaw.split(',').map(a => a.trim().toLowerCase()).filter(a => a !== '')
        : [];

    // ── 2. Comodín salvavidas (columna E = índice 4) ──
    datosComodinFijo.nombreReceta = getCelda(rows, 4, 4) || "Receta Comodín";

    const pRaw = getCelda(rows, 5, 4);
    datosComodinFijo.proteinasIds = pRaw
        ? pRaw.split(',').map(id => id.trim().toUpperCase()).filter(id => id !== '')
        : [];

    const hcRaw = getCelda(rows, 6, 4);
    datosComodinFijo.carbohidratosIds = hcRaw
        ? hcRaw.split(',').map(id => id.trim().toUpperCase()).filter(id => id !== '')
        : [];

    const gRaw = getCelda(rows, 7, 4);
    datosComodinFijo.grasasIds = gRaw
        ? gRaw.split(',').map(id => id.trim().toUpperCase()).filter(id => id !== '')
        : [];

    datosComodinFijo.libresTexto = getCelda(rows, 8, 4);


    // ── 3. Bloques totales diarios (Columna B = Índice 1) ──
    // Mapeo exacto según tu captura:
    // Fila 12 del Sheets (Bloques P)  -> Índice 11 en JavaScript
    // Fila 13 del Sheets (Bloques G)  -> Índice 12 en JavaScript
    // Fila 14 del Sheets (Bloques HC) -> Índice 13 en JavaScript
    const totalP  = parseFloat(String(getCelda(rows, 11, 1)).replace(',', '.')) || 0;
    const totalG  = parseFloat(String(getCelda(rows, 12, 1)).replace(',', '.')) || 0;
    const totalHC = parseFloat(String(getCelda(rows, 13, 1)).replace(',', '.')) || 0;

    console.log(`[DEBUG] OBJETIVO DIARIO -> Bloques P: ${totalP}, Bloques G: ${totalG}, Bloques HC: ${totalHC}`);


    // ── 4. Distribución por ingestas (Columna B = Índice 1) ──
    // Mapeo exacto según tu captura:
    // Fila 16 del Sheets (%Desayuno) corresponde al Índice 15 en JavaScript.
    // Recorre consecutivamente: Desayuno (15), Almuerzo (16), Comida (17), Merienda (18), Cena (19)
    const porcentajes = [];
    for (let i = 0; i < 5; i++) {
        const filaIndex = 15 + i; 
        const valorCelda = getCelda(rows, filaIndex, 1);
        
        let val = parseFloat(String(valorCelda).replace(',', '.')) || 0;
        
        // Control de formato: Si en Google Sheets pones un número entero como "20" en lugar de "0.2" o "20%",
        // el sistema detecta que es mayor que 1 y lo normaliza automáticamente dividiendo por 100.
        if (val > 1) val = val / 100;
        
        porcentajes.push(val);
        console.log(`[DEBUG] % ${MEAL_NAMES[i]} (Fila Sheets ${filaIndex + 1}) -> Celda: "${valorCelda}" -> Procesado: ${(val * 100)}%`);
    }


    // ── 5. Cálculo dinámico de bloques por ingesta y renderizado en la interfaz ──
    bloquesAsignadosPorIngesta = {};
    const grid = document.getElementById('meal-grid');
    let html = "";

    MEAL_NAMES.forEach((nombre, i) => {
        const pct = porcentajes[i] || 0;
        
        // Multiplicamos matemáticamente el bloque diario por la densidad/porcentaje de esta ingesta concreta
        const p  = parseFloat((totalP  * pct).toFixed(1));
        const hc = parseFloat((totalHC * pct).toFixed(1));
        const g  = parseFloat((totalG  * pct).toFixed(1));

        // Guardamos los bloques resultantes para que el recomendador y el generador de platos los utilicen después
        bloquesAsignadosPorIngesta[nombre] = { p, hc, g };

        console.log(`[DEBUG] CÁLCULO FINAL para ${nombre}: P=${p} blq | HC=${hc} blq | G=${g} blq`);

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
}


function procesarYRenderizarEquivalencias(raw) {
    const json = cleanJSON(raw);
    const rows = json.table.rows;
    poolProteinas = []; poolCarbohidratos = []; poolGrasas = []; poolBuscadorCompleto = [];

    function parsearGramos(celda) {
        if (!celda || celda.v === null) return null;
        let str = String(celda.v).replace(/\s+/g, '').toLowerCase();
        let match = str.match(/(\d+(?:[.,]\d+)?)/);
        return match ? parseFloat(match[1].replace(',', '.')) : null;
    }

    function detectarUnidad(celdaStr) {
        let str = (celdaStr || '').toLowerCase();
        if (str.includes('ml')) return 'ml';
        if (str.includes('ud') || str.includes('unidad')) return 'udes';
        return 'g';
    }

    function debeExcluirse(nombre, celdaExclusion, celdaEstilo, celdaMomento) {
        if (!nombre) return true;
        const nClean = nombre.toLowerCase();
        if (exclusionesPaciente.alimentosOdiados.some(o => nClean.includes(o))) return true;

        const tags = `
            ${celdaExclusion?.v ? String(celdaExclusion.v) : ''}
            ${celdaEstilo?.v   ? String(celdaEstilo.v)   : ''}
            ${celdaMomento?.v  ? String(celdaMomento.v)  : ''}
        `.toUpperCase();

        if (['VEGETARIANO', 'VEGANO'].includes(exclusionesPaciente.estiloVida)) {
            if (tags.includes('ANIMAL') || tags.includes('CARNE') || tags.includes('PESCADO')) return true;
        }
        for (const tag of exclusionesPaciente.tagsExcluir) {
            if (tags.includes(tag)) return true;
        }
        return false;
    }

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i].c;
        if (!row) continue;

        if (row[0]?.v !== null && String(row[0]?.v || '').trim() !== '' && !String(row[0]?.v || '').includes('PROTEÍNAS')) {
            const n = String(row[0].v).trim();
            if (!debeExcluirse(n, row[5], row[6], row[7])) {
                const item = { nombre: n, gramos: parsearGramos(row[1]), unidad: detectarUnidad(String(row[1]?.v || '')), tipo: 'PROTEÍNAS' };
                poolProteinas.push(item); poolBuscadorCompleto.push(item);
            }
        }
        if (row[2]?.v !== null && String(row[2]?.v || '').trim() !== '' && !String(row[2]?.v || '').includes('CARBOHIDRATOS')) {
            let n = String(row[2].v).trim();
            if (n.endsWith('|')) n = n.slice(0, -1).trim();
            if (!debeExcluirse(n, row[5], row[6], row[7])) {
                const item = { nombre: n, gramos: parsearGramos(row[3]), unidad: detectarUnidad(String(row[3]?.v || '')), tipo: 'CARBOHIDRATOS' };
                poolCarbohidratos.push(item); poolBuscadorCompleto.push(item);
            }
        }
        if (row[4]?.v !== null && String(row[4]?.v || '').trim() !== '' && !String(row[4]?.v || '').includes('GRASAS')) {
            const n = String(row[4].v).trim();
            if (!debeExcluirse(n, row[5], row[6], row[7])) {
                const item = { nombre: n, gramos: parsearGramos(row[5]), unidad: detectarUnidad(String(row[5]?.v || '')), tipo: 'GRASAS' };
                poolGrasas.push(item); poolBuscadorCompleto.push(item);
            }
        }
        if (row[8]?.v !== null && String(row[8]?.v || '').trim() !== '' && !String(row[8]?.v || '').includes('MIXTO')) {
            const n = String(row[8].v).trim();
            if (!debeExcluirse(n, row[5], row[6], row[7])) {
                poolBuscadorCompleto.push({ nombre: n, gramos: null, unidad: '', tipo: 'ALIMENTOS MIXTOS' });
            }
        }
    }

    // Renderizar tabla en el DOM
    const tbody = document.getElementById('table-body');
    let htmlTable = '';
    poolBuscadorCompleto.forEach(item => {
        let bClass = 'bg-p';
        if (item.tipo === 'CARBOHIDRATOS')   bClass = 'bg-hc';
        else if (item.tipo === 'GRASAS')      bClass = 'bg-g';
        else if (item.tipo === 'ALIMENTOS MIXTOS') bClass = 'bg-m';
        htmlTable += `<tr data-type="${item.tipo.toLowerCase()}">
            <td><strong>${item.nombre}</strong></td>
            <td>${item.gramos !== null ? item.gramos + item.unidad : 'Ver definición'}</td>
            <td><span class="badge ${bClass}">${item.tipo}</span></td>
        </tr>`;
    });
    tbody.innerHTML = htmlTable;

    // Seccion de Observaciones (Columnas I, J, K)
    let obsG = [], obsI = [], obsJ = [];
    for (let i = 0; i < rows.length; i++) {
        if (rows[i]?.c) {
            if (rows[i].c[9]?.v)  obsG.push(String(rows[i].c[9].v));
            if (rows[i].c[10]?.v) obsI.push(String(rows[i].c[10].v));
            if (rows[i].c[11]?.v) obsJ.push(String(rows[i].c[11].v));
        }
    }
    document.getElementById('obs-grid').innerHTML = `
        <div class="obs-card"><div class="obs-title">${obsG[0] || 'Info'}</div><div class="obs-content">${obsG.slice(1).join('<br>')}</div></div>
        <div class="obs-card c2"><div class="obs-title">${obsI[0] || 'Pautas'}</div><div class="obs-content">${obsI.slice(1).join('<br>')}</div></div>
        <div class="obs-card c3"><div class="obs-title">${obsJ[0] || 'Extra'}</div><div class="obs-content">${obsJ.slice(1).join('<br>')}</div></div>`;
}

// ─── Generador de Receta Salvavidas Fija ───
function calcularComodinSalvavidas() {
    const ingesta = document.getElementById('salvavidas-selector').value;
    const blq = bloquesAsignadosPorIngesta[ingesta];
    const out = document.getElementById('salvavidas-output');
    out.style.display = "block";

    if (!blq || (blq.p === 0 && blq.hc === 0 && blq.g === 0)) {
        out.innerHTML = `<div class="plate-title">No hay bloques definidos para la ingesta seleccionada.</div>`;
        return;
    }

    let html = `<div class="plate-title" style="color: var(--amber-text); border-bottom-color: var(--amber-border)">
                    <i class="fa-solid fa-utensils"></i> Plato: <b>${datosComodinFijo.nombreReceta}</b><br>
                    <small style="font-size:12px; color: var(--text-light)">
                        Cantidades ajustadas para ${ingesta} &nbsp;·&nbsp; 
                        ${blq.p}P &nbsp;·&nbsp; ${blq.hc}HC &nbsp;·&nbsp; ${blq.g}G
                    </small>
                </div>`;

    let hayIngredientes = false;

    function procesarMacroComodin(listaIds, bloquesTotales, poolAlimentos, bgClass, emoji) {
        if (!listaIds || listaIds.length === 0 || bloquesTotales <= 0) return '';
        const bloquesPorAlimento = bloquesTotales / listaIds.length;
        let subHtml = '';

        listaIds.forEach(id => {
            const idClean = id.replace(/\s+/g, '').toUpperCase();
            if (idClean === '') return;

            const matchNum = idClean.match(/\d+/);
            if (!matchNum) {
                subHtml += `<div class="plate-item" style="color:var(--p-color)">
                    <span>⚠️ ID "<b>${idClean}</b>" no válido. Formato esperado: P_001, HC_002, G_003</span></div>`;
                return;
            }

            const indice = parseInt(matchNum[0], 10) - 1;
            const alimento = poolAlimentos[indice];

            if (alimento) {
                const gBase = alimento.gramos || 0;
                const gramosCalculados = (bloquesPorAlimento * gBase).toFixed(0);
                subHtml += `
                    <div class="plate-item">
                        <span>${emoji} <b>${gramosCalculados}${alimento.unidad || 'g'}</b> de <b>${alimento.nombre}</b>
                            <small style="color:var(--text-light); margin-left:6px">(${bloquesPorAlimento.toFixed(1)} blq · ${gBase}${alimento.unidad}/blq)</small>
                        </span>
                        <span class="item-macro-tag ${bgClass}">${bgClass.replace('bg-', '').toUpperCase()}</span>
                    </div>`;
                hayIngredientes = true;
            } else {
                subHtml += `<div class="plate-item" style="color:var(--p-color)">
                    <span>⚠️ No existe la fila <b>${parseInt(matchNum[0], 10)}</b> en la lista de 
                    ${bgClass === 'bg-p' ? 'proteínas' : bgClass === 'bg-hc' ? 'carbohidratos' : 'grasas'} 
                    (hay ${poolAlimentos.length} alimentos disponibles). ID: <b>${idClean}</b></span></div>`;
            }
        });
        return subHtml;
    }

    html += procesarMacroComodin(datosComodinFijo.proteinasIds,     blq.p,  poolProteinas,     'bg-p',  '🥩');
    html += procesarMacroComodin(datosComodinFijo.carbohidratosIds, blq.hc, poolCarbohidratos, 'bg-hc', '🌾');
    html += procesarMacroComodin(datosComodinFijo.grasasIds,        blq.g,  poolGrasas,        'bg-g',  '🥑');

    if (datosComodinFijo.libresTexto && datosComodinFijo.libresTexto !== '' && datosComodinFijo.libresTexto.toLowerCase() !== 'ninguno') {
        html += `
            <div class="plate-item" style="background-color:#f8fafc; padding:10px; border-radius:6px; margin-top:10px;">
                <span>🧂 <b>Extras libres:</b> ${datosComodinFijo.libresTexto}</span>
                <span class="badge bg-m">Libre</span>
            </div>`;
        hayIngredientes = true;
    }

    if (!hayIngredientes) {
        out.innerHTML = `<div class="plate-title" style="color:var(--text-light); border-bottom:none; margin-bottom:0;">
            ℹ️ No se encontraron ingredientes. Revisa que los IDs en E6, E7, E8 de tu hoja MASTER sean correctos.</div>`;
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
        out.innerHTML = `<div class="plate-title">No hay bloques definidos para esta ingesta.</div>`;
        return;
    }

    let html = `<div class="plate-title">Propuesta adaptada a tus bloques (${blq.p}P · ${blq.hc}HC · ${blq.g}G)</div>`;

    if (blq.p > 0 && poolProteinas.length > 0) {
        const p = poolProteinas[Math.floor(Math.random() * poolProteinas.length)];
        html += `<div class="plate-item"><span>🥩 <b>${(blq.p * (p.gramos || 0)).toFixed(0)}${p.unidad}</b> de <b>${p.nombre}</b></span><span class="item-macro-tag bg-p">P</span></div>`;
    }
    if (blq.hc > 0 && poolCarbohidratos.length > 0) {
        const h = poolCarbohidratos[Math.floor(Math.random() * poolCarbohidratos.length)];
        html += `<div class="plate-item"><span>🌾 <b>${(blq.hc * (h.gramos || 0)).toFixed(0)}${h.unidad}</b> de <b>${h.nombre}</b></span><span class="item-macro-tag bg-hc">HC</span></div>`;
    }
    if (blq.g > 0 && poolGrasas.length > 0) {
        const g = poolGrasas[Math.floor(Math.random() * poolGrasas.length)];
        html += `<div class="plate-item"><span>🥑 <b>${(blq.g * (g.gramos || 0)).toFixed(0)}${g.unidad}</b> de <b>${g.nombre}</b></span><span class="item-macro-tag bg-g">G</span></div>`;
    }

    out.innerHTML = html;
}

// ─── Filtros de Categorías y Buscador ───
function setCategoryFilter(cat, btn) {
    currentCategoryFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ejecutarFiltroCombinado();
}

function ejecutarFiltroCombinado() {
    const text = document.getElementById('search').value.toLowerCase();
    const trs = document.getElementById('table-body').getElementsByTagName('tr');
    for (let tr of trs) {
        const name = tr.getElementsByTagName('td')[0]?.textContent.toLowerCase() || '';
        const type = tr.getAttribute('data-type') || '';
        tr.style.display = (name.includes(text) && (currentCategoryFilter === 'all' || type === currentCategoryFilter)) ? '' : 'none';
    }
}
