// ───────────────────────────────────────────────────────────── 
//  MÓDULO: CONFIGURAR PLANIFICACIÓN
// ─────────────────────────────────────────────────────────────

function renderizarPlato(plato) {
    const container = document.getElementById('plate-output');
    container.style.display = "block";
    
    let html = `
        <div class="plate-title"><i class="fa-solid fa-bowl-food"></i> Combinación Sugerida</div>
        <div class="ingredients-list">`;

    plato.ingredientes.forEach(ing => {
        // Si el ID del ingrediente NO está en "bloqueados", significa que está activo y se puede cambiar
        const isChecked = !window.ingredientesBloqueados.includes(ing.id);
        
        html += `
            <div class="ingrediente-item">
                <label>
                    <input type="checkbox" class="ingrediente-check" value="${ing.id}" ${isChecked ? 'checked' : ''}>
                    ${ing.nombre} (${ing.cantidad}${ing.unidad})
                </label>
            </div>`;
    });

   // html += `</div>
     //        <button onclick="solicitarNuevaSugerencia()" class="btn-sugerir">Sugerir Nueva Combinación</button>`;
    
    container.innerHTML = html;
}



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

    if (!blq) return;

    const ingestaUpper = ingesta.toUpperCase();
    const proteinasFiltradas = poolProteinas.filter(item => !item.momentos || item.momentos.includes(ingestaUpper));
    const carbohidratosFiltrados = poolCarbohidratos.filter(item => !item.momentos || item.momentos.includes(ingestaUpper));
    const grasasFiltradas = poolGrasas.filter(item => !item.momentos || item.momentos.includes(ingestaUpper));

    // LEER ESTADO DE LOS CHECKS ACTUALES EN PANTALLA
    // NOTA: Si el check está MARCADO, queremos CAMBIARLO. Si está DESMARCADO, lo MANTENEMOS.
    const chkP = document.getElementById('chk-change-p');
    const chkHC = document.getElementById('chk-change-hc');
    const chkG = document.getElementById('chk-change-g');

    // Inicializamos si es la primera vez o cambiamos de ingesta
    if (platoInteligenteActual.ingesta !== ingesta) {
        platoInteligenteActual = { p: null, hc: null, g: null, ingesta: ingesta };
    }

    // LÓGICA: Si es null (primera vez) O el checkbox está marcado (queremos cambiar)
    if ((!platoInteligenteActual.p || (chkP && chkP.checked)) && proteinasFiltradas.length > 0) {
        platoInteligenteActual.p = proteinasFiltradas[Math.floor(Math.random() * proteinasFiltradas.length)];
    }
    
    if ((!platoInteligenteActual.hc || (chkHC && chkHC.checked)) && carbohidratosFiltrados.length > 0) {
        platoInteligenteActual.hc = carbohidratosFiltrados[Math.floor(Math.random() * carbohidratosFiltrados.length)];
    }
    
    if ((!platoInteligenteActual.g || (chkG && chkG.checked)) && grasasFiltradas.length > 0) {
        platoInteligenteActual.g = grasasFiltradas[Math.floor(Math.random() * grasasFiltradas.length)];
    }

    // RENDERIZADO
    let html = `<div class="plate-title">Propuesta adaptada a tus bloques (${blq.p}P · ${blq.hc}HC · ${blq.g}G)</div>`;

    const renderItem = (item, blqVal, id, label, icon, bg) => {
        if (!item) return '';
        return `
            <div class="plate-item">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="checkbox" id="${id}" checked style="cursor: pointer; width: 16px; height: 16px;">
                    <label for="${id}" style="cursor: pointer;">
                        ${icon} <b>${(blqVal * (item.gramos || 0)).toFixed(0)}${item.unidad}</b> de <b>${item.nombre}</b>
                    </label>
                </div>
                <span class="item-macro-tag ${bg}">${bg.replace('bg-', '').toUpperCase()}</span>
            </div>`;
    };

    html += renderItem(platoInteligenteActual.p, blq.p, 'chk-change-p', 'Proteína', '🥩', 'bg-p');
    html += renderItem(platoInteligenteActual.hc, blq.hc, 'chk-change-hc', 'Hidrato', '🌾', 'bg-hc');
    html += renderItem(platoInteligenteActual.g, blq.g, 'chk-change-g', 'Grasa', '🥑', 'bg-g');

   // html += `<button onclick="generarPlatoInteligente()" style="margin-top:15px; width:100%; padding:10px; cursor:pointer;">Sugerir Nueva Combinación</button>`;
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
