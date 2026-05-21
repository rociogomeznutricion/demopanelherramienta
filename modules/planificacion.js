// ─────────────────────────────────────────────────────────────
//  MÓDULO: PLANIFICACIÓN NUTRICIONAL SECO/SEMANAL
// ─────────────────────────────────────────────────────────────

function inicializarPlanificacion() {
    console.log("[Módulo Planificación] Cargado y listo para expandir.");
    
    const container = document.querySelector('#view-planificacion .card');
    
    // Ejemplo de renderizado inicial dinámico. Puedes cambiar esto por peticiones Fetch a tus Sheets
    container.innerHTML = `
        <p style="margin-bottom: 15px; font-weight:500;">Aquí podrás estructurar y consultar los platos de la semana:</p>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; text-align:center;">
            <div style="padding:10px; background:#f1f5f9; border-radius:8px; font-size:13px;"><b>Lunes</b><br>🍗 Pollo Arroz</div>
            <div style="padding:10px; background:#f1f5f9; border-radius:8px; font-size:13px;"><b>Martes</b><br>🐟 Salmón Wok</div>
            <div style="padding:10px; background:#f1f5f9; border-radius:8px; font-size:13px;"><b>Miércoles</b><br>🥩 Ternera Pasta</div>
            <div style="padding:10px; background:#f1f5f9; border-radius:8px; font-size:13px;"><b>Jueves</b><br>🍳 Tortilla Pan</div>
            <div style="padding:10px; background:#f1f5f9; border-radius:8px; font-size:13px;"><b>Viernes</b><br>🥗 Ensalada Mix</div>
        </div>
    `;
}
