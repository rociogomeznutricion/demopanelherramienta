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
    
    // Eliminado estilosVida del estado global
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
    }).catch(err => {
        console.error(err);
        document.getElementById('sync-status').innerText = "Error al cargar";
        document.getElementById('sync-status').style.background = "#ffeeec";
        document.getElementById('sync-status').style.color = "#991b1b";
    });
}

// ─── Procesar hoja MASTER del paciente ───
function procesarMasterPaciente(raw) {
    const json = cleanJSON(raw);
    const rows = json.table.rows;

    console.log('[DEBUG] Total filas recibidas de la hoja MASTER:', rows.length);

 // Ahora restamos 2 a la fila del Excel porque la fila 1 se ignoró
const alergiasRaw          = getCelda(rows, 0, 4); // Índice 0 = Fila 2 del Excel (E2)
const alimentosOdiadosRaw = getCelda(rows, 1, 4); // Índice 1 = Fila 3 del Excel (E3)

    function normPerfil(str) {
        return String(str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/[,;]+/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    // Solo guardamos Alérgenos (E2) y Odiados (E3)
    exclusionesPaciente = {
        tagsExcluir:      normPerfil(alergiasRaw),         
        alimentosOdiados: normPerfil(alimentosOdiadosRaw)  
    };

    debugLog('[PERFIL] Alérgenos (E2): ' + exclusionesPaciente.tagsExcluir.join(', ') + ' | Odiados (E3): ' + exclusionesPaciente.alimentosOdiados.join(', '));

    // Datos comodín
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

    // ── Bloques totales diarios (Columna B) ──
    const totalP  = parseFloat(String(getCelda(rows, 10, 1)).replace(',', '.')) || 0;
    const totalG  = parseFloat(String(getCelda(rows, 11, 1)).replace(',', '.')) || 0;
    const totalHC = parseFloat(String(getCelda(rows, 12, 1)).replace(',', '.')) || 0;

    // ── Distribución por ingestas ──
    const percentages = [];
    for (let i = 0; i < 5; i++) {
        const filaIndex  = 13 + i;
        const valorCelda = getCelda(rows, filaIndex, 1);
        let val = parseFloat(String(valorCelda).replace(',', '.')) || 0;
        if (val > 1) val = val / 100;
        percentages.push(val);
    }

    bloquesAsignadosPorIngesta = {};
    const grid = document.getElementById('meal-grid');
    let html = "";

    MEAL_NAMES.forEach((nombre, i) => {
        const pct = percentages[i] || 0;
        const p   = parseFloat((totalP  * pct).toFixed(1));
        const hc  = parseFloat((totalHC * pct).toFixed(1));
        const g   = parseFloat((totalG  * pct).toFixed(1));

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
                        Cantidades adaptadas para ${ingesta} &nbsp;·&nbsp; 
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

            const indice    = parseInt(matchNum[0], 10) - 1;
            const alimento  = poolAlimentos[indice];

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
            ℹ️ No se encontraron ingredientes. Revisa que los IDs en tu hoja MASTER sean correctos.</div>`;
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

    const ingestaUpper = ingesta.toUpperCase();

    function poolFiltradoPorMomento(pool) {
        const filtrado = pool.filter(item =>
            !item.momentos || item.momentos.length === 0 || item.momentos.includes(ingestaUpper)
        );
        return filtrado.length > 0 ? filtrado : pool;
    }

    const proteinasFiltradas     = poolFiltradoPorMomento(poolProteinas);
    const carbohidratosFiltrados = poolFiltradoPorMomento(poolCarbohidratos);
    const grasasFiltradas        = poolFiltradoPorMomento(poolGrasas);

    let html = `<div class="plate-title">Propuesta adaptada a tus bloques (${blq.p}P · ${blq.hc}HC · ${blq.g}G)</div>`;

    if (blq.p > 0 && proteinasFiltradas.length > 0) {
        const p = proteinasFiltradas[Math.floor(Math.random() * proteinasFiltradas.length)];
        html += `<div class="plate-item"><span>🥩 <b>${(blq.p * (p.gramos || 0)).toFixed(0)}${p.unidad}</b> de <b>${p.nombre}</b></span><span class="item-macro-tag bg-p">P</span></div>`;
    }
    if (blq.hc > 0 && carbohidratosFiltrados.length > 0) {
        const h = carbohidratosFiltrados[Math.floor(Math.random() * carbohidratosFiltrados.length)];
        html += `<div class="plate-item"><span>🌾 <b>${(blq.hc * (h.gramos || 0)).toFixed(0)}${h.unidad}</b> de <b>${h.nombre}</b></span><span class="item-macro-tag bg-hc">HC</span></div>`;
    }
    if (blq.g > 0 && grasasFiltradas.length > 0) {
        const g = grasasFiltradas[Math.floor(Math.random() * grasasFiltradas.length)];
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

    poolProteinas        = [];
    poolCarbohidratos    = [];
    poolGrasas           = [];
    poolBuscadorCompleto = [];

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

    function norm(str) {
        return String(str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

  function debeExcluirse(nombre, tagF) {
    // Marcamos el inicio de la revisión de este alimento específico
    console.log(`\n🔍 [DEBUG] Iniciando comprobación -> Alimento: "${nombre}" | Tags: "${tagF}"`);

    if (!nombre) {
        console.warn(`🛑 [SALIDA] Excluido automáticamente: El nombre del alimento viene vacío o indefinido.`);
        return true;
    }

    const nNorm = norm(nombre);
    const fNorm = norm(tagF);
    console.log(`   [INFO] Textos normalizados -> Nombre: "${nNorm}" | Tags: "${fNorm}"`);

    // 1. E3 (Odiados)
    const odiados = exclusionesPaciente.alimentosOdiados || [];
    console.log(`   [INFO] Lista de alimentos odiados actuales:`, odiados);

    if (odiados.length > 0) {
        // Usamos .find para saber cuál es el culpable exacto si salta el filtro
        const odiadoCulpable = odiados.find(odiado => nNorm.includes(odiado));
        if (odiadoCulpable) {
            console.log(`❌ [SALIDA] EXCLUIDO por Alimento Odiado. El culpable es: "${odiadoCulpable}"`);
            return true;
        }
    }

    // 2. E2 (Alérgenos)
    const tagsExcluir = exclusionesPaciente.tagsExcluir || [];
    console.log(`   [INFO] Lista de alérgenos a excluir actuales:`, tagsExcluir);

    if (tagsExcluir.length > 0) {
        // Usamos .find para capturar el alérgeno exacto que hace match
        const alergenoCulpable = tagsExcluir.find(alergeno => fNorm.includes(alergeno));
        if (alergenoCulpable) {
            console.log(`❌ [SALIDA] EXCLUIDO por Alérgeno/Restricción. El culpable es: "${alergenoCulpable}"`);
            return true;
        }
    }

    // Si llega aquí, es que pasó todos los filtros
    console.log(`✅ [SALIDA] APTO. El alimento no coincide con ninguna exclusión.`);
    return false;
}
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i].c;
        if (!row) continue;

        const nombreAlimento = txtCelda(row, 1);
        const macroPrincipal = txtCelda(row, 2).toUpperCase();
        const rawGramos      = txtCelda(row, 3);
        const unidadMedida   = txtCelda(row, 4) || 'g';
        const tagF           = txtCelda(row, 5); // Columna F: Alérgenos / Tags del alimento
        const tagH           = txtCelda(row, 7); // Columna H: Momentos

        if (!nombreAlimento || /PROTEÍNAS|CARBOHIDRATOS|GRASAS/i.test(nombreAlimento)) continue;
        
        // Pasamos solo el nombre y la columna F a la función
        if (debeExcluirse(nombreAlimento, tagF)) continue;

        const gramosNumericos = parsearGramos(rawGramos);
        const itemAlimento = {
            nombre:   nombreAlimento,
            gramos:   gramosNumericos,
            unidad:   unidadMedida,
            tipo:     '',
            momentos: tagH
                        .toUpperCase()
                        .split(/[,;]+/)
                        .map(s => s.trim())
                        .filter(Boolean)
        };

        if (macroPrincipal === 'P' || macroPrincipal.includes('PROT')) {
            itemAlimento.tipo = 'PROTEÍNAS';
            poolProteinas.push(itemAlimento);
            poolBuscadorCompleto.push(itemAlimento);
        } else if (macroPrincipal === 'HC' || macroPrincipal.includes('CARB')) {
            itemAlimento.tipo = 'CARBOHIDRATOS';
            poolCarbohidratos.push(itemAlimento);
            poolBuscadorCompleto.push(itemAlimento);
        } else if (macroPrincipal === 'G' || macroPrincipal.includes('GRAS')) {
            itemAlimento.tipo = 'GRASAS';
            poolGrasas.push(itemAlimento);
            poolBuscadorCompleto.push(itemAlimento);
        } else if (macroPrincipal === 'MIXTO') {
            itemAlimento.tipo   = 'ALIMENTOS MIXTOS';
            itemAlimento.gramos = null;
            itemAlimento.unidad = rawGramos; 
            poolBuscadorCompleto.push(itemAlimento);
        }
    }

    debugLog(`[BBDD] P: ${poolProteinas.length} | HC: ${poolCarbohidratos.length} | G: ${poolGrasas.length} | Total: ${poolBuscadorCompleto.length}`);

    // Renderizado de tabla
    const tbody = document.getElementById('table-body');
    let htmlTable = '';

    poolBuscadorCompleto.forEach(item => {
        let bClass = 'bg-p';
        if      (item.tipo === 'CARBOHIDRATOS')    bClass = 'bg-hc';
        else if (item.tipo === 'GRASAS')           bClass = 'bg-g';
        else if (item.tipo === 'ALIMENTOS MIXTOS') bClass = 'bg-m';

        const visualizacionCantidad = item.tipo === 'ALIMENTOS MIXTOS'
            ? `<i>${item.unidad || 'Ver definición'}</i>`
            : `${item.gramos !== null ? item.gramos + ' ' + item.unidad : '—'}`;

        htmlTable += `<tr data-type="${item.tipo.toLowerCase()}">
            <td><strong>${item.nombre}</strong></td>
            <td>${visualizacionCantidad}</td>
            <td><span class="badge ${bClass}">${item.tipo}</span></td>
        </tr>`;
    });

    tbody.innerHTML = htmlTable;

    let obsG = [], obsI = [], obsJ = [];
    const MAX_FILAS_OBS = Math.min(rows.length, 15); 
    
    for (let i = 0; i < MAX_FILAS_OBS; i++) {
        if (rows[i]?.c) {
            if (rows[i].c[8]?.v)  obsG.push(String(rows[i].c[8].v).trim());
            if (rows[i].c[9]?.v)  obsI.push(String(rows[i].c[9].v).trim());
            if (rows[i].c[10]?.v) obsJ.push(String(rows[i].c[10].v).trim());
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
            <div class="obs-title">${obsJ[0] || 'Extra'}</div>
            <div class="obs-content">${obsJ.slice(1).filter(Boolean).join('<br>')}</div>
        </div>`;
}
