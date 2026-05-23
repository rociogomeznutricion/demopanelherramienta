// ─────────────────────────────────────────────────────────────
//  MÓDULO: PLANIFICACIÓN NUTRICIONAL (VERSIÓN BURBUJAS)
// ───────────────────────────────────────────────────────────── 

// Guardamos los datos aquí para no tener que recargarlos de internet cada vez que tocas un botón
let datosPlanificacionGlobal = []; 

window.inicializarPlanificacion = async function() {
    console.log("[Módulo Planificación] Cargando datos del paciente:", currentPacienteId);
    
    const gidRegistroSemanal = '425566588'; 
    const url = `https://docs.google.com/spreadsheets/d/${currentPacienteId}/gviz/tq?gid=${gidRegistroSemanal}&tqx=out:json`;
    
    // Buscamos el div principal donde va todo
    const container = document.getElementById('plan-grid'); 
    
    try {
        // Ponemos un mensajito mientras Google nos responde
        container.innerHTML = "<p style='text-align:center; padding: 20px;'>Cargando tu planificación...</p>";
        
        const response = await fetch(url);
        const json = cleanJSON(await response.text());
        
        // Guardamos las 7 filas (Lunes a Domingo) en nuestra variable global
        datosPlanificacionGlobal = json.table.rows; 

        // 1. Construimos la botonera de L a D
        construirInterfazDias(container);
        
        // 2. Simulamos que hacemos "clic" en el Lunes (índice 0) para que no salga la pantalla vacía
        seleccionarDia(0);
        
    } catch (e) {
        console.error("Error al cargar planificación:", e);
        container.innerHTML = "<p style='text-align:center; color: var(--p-color); padding: 20px;'>Error al cargar los datos. Revisa tu conexión.</p>";
    }
};

function construirInterfazDias(container) {
    const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    
    // Titulo de la sección
    let html = `<div class="section-title">📅 Tu Semana al Detalle</div>`;
    
    // Contenedor de las burbujas (centradas y alineadas)
    html += `<div style="display: flex; gap: 12px; justify-content: center; margin-bottom: 25px; flex-wrap: wrap;">`;
    
    // Creamos un botón por cada letra del array 'dias'
    dias.forEach((dia, index) => {
        html += `<button class="day-btn" id="btn-dia-${index}" onclick="seleccionarDia(${index})" 
                 style="width: 45px; height: 45px; border-radius: 50%; border: none; font-weight: 600; cursor: pointer; font-size: 15px; transition: all 0.2s;">
                 ${dia}
                 </button>`;
    });
    html += `</div>`;

    // Debajo de los botones, dejamos un "hueco" donde luego inyectaremos el texto de las comidas
    html += `<div id="contenedor-comidas-dia"></div>`;

    container.innerHTML = html;
}

window.seleccionarDia = function(indexDia) {
    // 1. Reseteamos los colores de todos los botones para apagarlos
    const todosLosBotones = document.querySelectorAll('.day-btn');
    todosLosBotones.forEach(btn => {
        btn.classList.remove('active');
        btn.style.backgroundColor = 'var(--white, #ffffff)'; 
        btn.style.color = 'var(--text-light, #64748b)';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
    });

    // 2. Encendemos solo el botón que hemos tocado (el activo)
    const botonActivo = document.getElementById(`btn-dia-${indexDia}`);
    if (botonActivo) {
        botonActivo.classList.add('active');
        // Colores que encajan con tu tema azul (blue-accent)
        botonActivo.style.backgroundColor = 'var(--blue-accent, #0047ab)';
        botonActivo.style.color = '#ffffff';
        botonActivo.style.boxShadow = '0 4px 8px rgba(0, 71, 171, 0.3)';
        botonActivo.style.transform = 'scale(1.05)';
    }

    // 3. Llamamos a la función que dibuja el texto de la dieta
    renderizarComidasDelDia(indexDia);
};

function renderizarComidasDelDia(indexDia) {
    const contenedor = document.getElementById('contenedor-comidas-dia');
    if (!contenedor || !datosPlanificacionGlobal[indexDia]) return;

    // Cogemos solo la fila del excel que pertenece a este día
    const filaDia = datosPlanificacionGlobal[indexDia];
    const ingestas = ['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena'];
    
    // Función de seguridad por si alguna celda en Google Sheets está vacía
    const getTextoSeguro = (columna) => {
        if (filaDia.c && filaDia.c[columna] && filaDia.c[columna].v) {
            return filaDia.c[columna].v;
        }
        return "<i style='color: #94a3b8;'>Libre o sin asignar</i>";
    };

    let htmlComidas = "";

    // En Sheets: Columna 0 es el Nombre del Día, la 1 es Desayuno, la 2 Almuerzo...
    // Recorremos las 5 comidas creando una tarjeta para cada una
    ingestas.forEach((nombreIngesta, i) => {
        const contenido = getTextoSeguro(i + 1); 
        
        // Usamos las clases que ya existen en tu styles.css
        htmlComidas += `
            <div class="plan-meal-card" style="margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div class="plan-meal-header" style="color: var(--blue-accent, #0047ab);">
                    <i class="fa-solid fa-utensils"></i> <strong>${nombreIngesta}</strong>
                </div>
                <div style="color: var(--text-dark, #1e293b); font-size: 15px; line-height: 1.6; margin-top: 10px; white-space: pre-line;">
                    ${contenido}
                </div>
            </div>
        `;
    });

    // Volcamos todo el texto en el hueco que preparamos antes
    contenedor.innerHTML = htmlComidas;
}
