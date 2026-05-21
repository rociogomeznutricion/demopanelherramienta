// ─────────────────────────────────────────────────────────────
//  MÓDULO: DIARIO DE SENSACIONES
// ─────────────────────────────────────────────────────────────

function inicializarDiario() {
    console.log("[Módulo Diario] Cargado y listo para expandir.");
    
    const container = document.querySelector('#view-diario .card');
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <p style="font-weight: 500;">Registra tus métricas cualitativas del día:</p>
            <div>
                <label style="display:block; font-size:12px; font-weight:600; margin-bottom:5px;">Nivel de Energía</label>
                <select class="gen-select" style="width:100%; max-width: 300px;">
                    <option>⚡ Alta energía</option>
                    <option>😐 Normal / Neutro</option>
                    <option>💤 Cansado / Fatigado</option>
                </select>
            </div>
            <div>
                <label style="display:block; font-size:12px; font-weight:600; margin-bottom:5px;">Sensaciones Digestivas</label>
                <input type="text" class="search-input" placeholder="Ej: Buenas digestiones, ligero hinchazón por la noche..." style="max-width:500px;">
            </div>
            <button class="gen-btn" style="max-width:200px;" onclick="alert('Funcionalidad de guardado en desarrollo')">Guardar Registro</button>
        </div>
    `;
}
