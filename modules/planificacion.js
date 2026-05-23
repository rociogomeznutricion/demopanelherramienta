// ─────────────────────────────────────────────────────────────
//  MÓDULO: PLANIFICACIÓN NUTRICIONAL SECO/SEMANAL
// ───────────────────────────────────────────────────────────── 

window.inicializarPlanificacion = async function() {
    console.log("[Módulo Planificación] Cargando datos del paciente:", currentPacienteId);
    
    // El GID que me diste
    const gidRegistroSemanal = '425566588'; 
    const url = `https://docs.google.com/spreadsheets/d/${currentPacienteId}/gviz/tq?gid=${gidRegistroSemanal}&tqx=out:json`;
    
    const container = document.getElementById('view-planificacion'); // O el div que contenga la sección
    // Si tienes un contenedor específico para la tabla, úsalo aquí
    
    try {
        const response = await fetch(url);
        const json = cleanJSON(await response.text()); // cleanJSON es global, funciona aquí
        const rows = json.table.rows;

        // Aquí renderizas tu tabla usando 'rows'
        // ... (tu lógica de renderizado igual que te pasé antes)
        console.log("Datos cargados correctamente");
    } catch (e) {
        console.error("Error al cargar planificación:", e);
    }
};
