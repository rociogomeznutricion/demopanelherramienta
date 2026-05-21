// ───────────────────────────────────────────────────────────── 
//  MÓDULO: CONFIGURAR PLANIFICACIÓN (Cálculos y Buscador)
// ─────────────────────────────────────────────────────────────

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

    html += procesarMacroComodin(datosComodinFijo.proteinasIds,     blq.p,  poolProteinas,      'bg-p',  '🥩');
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
        return pool.filter(item => !item.momentos || item.momentos.length === 0 || item.momentos.includes(ingestaUpper));
    }

    const proteinasFiltradas     = poolFiltradoPorMomento(poolProteinas);
    const carbohidratosFiltrados = poolFiltradoPorMomento(poolCarbohidratos);
    const grasasFiltradas        = poolFiltradoPorMomento(poolGrasas);

    let cambiarP = true, cambiarHC = true, cambiarG = true;

    if (platoInteligenteActual.ingesta === ingesta) {
        const chkP = document.getElementById('chk-change-p');
        const chkHC = document.getElementById('chk-change-hc');
        const chkG = document.getElementById('chk-change-g');
        if (chkP) cambiarP = chkP.checked;
        if (chkHC) cambiarHC = chkHC.checked;
        if (chkG) cambiarG = chkG.checked;
    } else {
        platoInteligenteActual = { p: null, hc: null, g: null, ingesta: ingesta };
    }

    if (blq.p > 0 && proteinasFiltradas.length > 0) {
        if (cambiarP || !platoInteligenteActual.p) platoInteligenteActual.p = proteinasFiltradas[Math.floor(Math.random() * proteinasFiltradas.length)];
    } else { platoInteligenteActual.p = null; }

    if (blq.hc > 0 && carbohidratosFiltrados.length > 0) {
        if (cambiarHC || !platoInteligenteActual.hc) platoInteligenteActual.hc = carbohidratosFiltrados[Math.floor(Math.random() * carbohidratosFiltrados.length)];
    } else { platoInteligenteActual.hc = null; }

    if (blq.g > 0 && grasasFiltradas.length > 0) {
        if (cambiarG || !platoInteligenteActual.g) platoInteligenteActual.g = grasasFiltradas[Math.floor(Math.random() * grasasFiltradas.length)];
    } else { platoInteligenteActual.g = null; }

    let html = `<div class="plate-title">Propuesta adaptada a tus bloques (${blq.p}P · ${blq.hc}HC · ${blq.g}G)</div>`;

    if (platoInteligenteActual.p) {
        const p = platoInteligenteActual.p;
        html += `
            <div class="plate-item">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="checkbox" id="chk-change-p" style="cursor: pointer; width: 16px; height: 16px;">
                    <label for="chk-change-p" style="cursor: pointer; user-select: none;">
                        🥩 <b>${(blq.p * (p.gramos || 0)).toFixed(0)}${p.unidad}</b> de <b>${p.nombre}</b>
                    </label>
                </div>
                <span class="item-macro-tag bg-p">P</span>
            </div>`;
    }
    if (platoInteligenteActual.hc) {
        const h = platoInteligenteActual.hc;
        html += `
            <div class="plate-item">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="checkbox" id="chk-change-hc" style="cursor: pointer; width: 16px; height: 16px;">
                    <label for="chk-change-hc" style="cursor: pointer; user-select: none;">
                        🌾 <b>${(blq.hc * (h.gramos || 0)).toFixed(0)}${h.unidad}</b> de <b>${h.nombre}</b>
                    </label>
                </div>
                <span class="item-macro-tag bg-hc">HC</span>
            </div>`;
    }
    if (platoInteligenteActual.g) {
        const g = platoInteligenteActual.g;
        html += `
            <div class="plate-item">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="checkbox" id="chk-change-g" style="cursor: pointer; width: 16px; height: 16px;">
                    <label for="chk-change-g" style="cursor: pointer; user-select: none;">
                        🥑 <b>${(blq.g * (g.gramos || 0)).toFixed(0)}${g.unidad}</b> de <b>${g.nombre}</b>
                    </label>
                </div>
                <span class="item-macro-tag bg-g">G</span>
            </div>`;
    }

    out.innerHTML = html;
}

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

function procesarYRenderizarEquivalencias(raw) {
    const json = cleanJSON(raw);
    const rows = json.table.rows;

    poolProteinas = []; poolCarbohidratos = []; poolGrasas = []; poolBuscadorCompleto = [];

    function txtCelda(row, idx) {
        return (!row || !row[idx] || row[idx].v === null || row[idx].v === undefined) ? '' : String(row[idx].v).trim();
    }

    function parsearGramos(valStr) {
        if (!valStr) return null;
        const match = valStr.replace(/\s+/g, '').toLowerCase().match(/(\d+(?:[.,]\d+)?)/);
        return match ? parseFloat(match[1].replace(',', '.')) : null;
    }

    function norm(str) {
        return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    }

    function debeExcluirse(nombre, tagF) {
        if (!nombre) return true;
        const nNorm = norm(nombre), fNorm = norm(tagF);
        const odiados = exclusionesPaciente.alimentosOdiados || [];
        if (odiados.length > 0 && odiados.find(odiado => nNorm.includes(odiado))) return true;
        const tagsExcluir = exclusionesPaciente.tagsExcluir || [];
        if (tagsExcluir.length > 0 && tagsExcluir.find(alergeno => fNorm.includes(alergeno))) return true;
        return false;
    }

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i].c; if (!row) continue;

        const nombreAlimento = txtCelda(row, 1);
        const macroPrincipal = txtCelda(row, 2).toUpperCase();
        const rawGramos      = txtCelda(row, 3);
        const unidadMedida   = txtCelda(row, 4) || 'g';
        const tagF           = txtCelda(row, 5); 
        const tagH           = txtCelda(row, 7); 

        if (!nombreAlimento || /PROTEÍNAS|CARBOHIDRATOS|GRASAS/i.test(nombreAlimento)) continue;
        if (debeExcluirse(nombreAlimento, tagF)) continue;

        const gramosNumericos = parsearGramos(rawGramos);
        const itemAlimento = {
            nombre: nombreAlimento, gramos: gramosNumericos, unidad: unidadMedida, tipo: '',
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

    debugLog(`[BBDD] P: ${poolProteinas.length} | HC: ${poolCarbohidratos.length} | G: ${poolGrasas.length} | Total: ${poolBuscadorCompleto.length}`);

    const tbody = document.getElementById('table-body');
    let htmlTable = '';

    poolBuscadorCompleto.forEach(item => {
        let bClass = item.tipo === 'CARBOHIDRATOS' ? 'bg-hc' : item.tipo === 'GRASAS' ? 'bg-g' : item.tipo === 'ALIMENTOS MIXTOS' ? 'bg-m' : 'bg-p';
        const visualizacionCantidad = item.tipo === 'ALIMENTOS MIXTOS' ? `<i>${item.unidad || 'Ver definición'}</i>` : `${item.gramos !== null ? item.gramos + ' ' + item.unidad : '—'}`;
        htmlTable += `<tr data-type="${item.tipo.toLowerCase()}"><td><strong>${item.nombre}</strong></td><td>${visualizacionCantidad}</td><td><span class="badge ${bClass}">${item.tipo}</span></td></tr>`;
    });
    tbody.innerHTML = htmlTable;

    let obsG = [], obsI = [], obsJ = [];
    const MAX_FILAS_OBS = Math.min(rows.length, 15); 
    for (let i = 0; i < MAX_FILAS_OBS; i++) {
        if (rows[i]?.c) {
            if (rows[i].c[8]?.v)  obsG.push(String(rows[i].c[8].v).trim());
            if (rows[i].c[9]?.v)  obsI.push(String(rows[i].c[9].v).trim());
        }
    }
    obsJ = datosComodinFijo.obsPacientePersonalizada || [];
    
    document.getElementById('obs-grid').innerHTML = `
        <div class="obs-card"><div class="obs-title">${obsG[0] || 'Info'}</div><div class="obs-content">${obsG.slice(1).filter(Boolean).join('<br>')}</div></div>
        <div class="obs-card c2"><div class="obs-title">${obsI[0] || 'Pautas'}</div><div class="obs-content">${obsI.slice(1).filter(Boolean).join('<br>')}</div></div>
        <div class="obs-card c3"><div class="obs-title">${obsJ[0] || 'Extra'}</div><div class="obs-content">${obsJ.slice(1).filter(Boolean).join('<br>')}</div></div>`;
}
