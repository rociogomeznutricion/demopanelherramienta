// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN PRINCIPAL Y ESTADO GLOBAL 
// ─────────────────────────────────────────────────────────────

const MASTER_CONTROL_URL = 'https://docs.google.com/spreadsheets/d/1L7lbZ4JkE7dqO_oizMEDKQabtyUBbR4yaqcrt3LMa6Q/gviz/tq?gid=0&tqx=out:json';

// GID de la pestaña MASTER del paciente individual
const GID_PACIENTE_MASTER = '0';

// NUEVA BBDD GLOBAL DE EQUIVALENCIAS (ALIMENTOS)
const SPREADSHEET_ID_EQUIV_GLOBAL = '1qxe-uHMw7rba6CVV3TDY38aA1kULHm3FInrSyYcK4Oo';
const GID_EQUIV_GLOBAL = '0';

const mealIcons = {
    "DESAYUNO": "fa-coffee",
    "ALMUERZO": "fa-apple-whole",
    "COMIDA": "fa-utensils",
    "MERIENDA": "fa-cookie",
    "CENA": "fa-moon"
};

const MEAL_NAMES = ["DESAYUNO", "ALMUERZO", "COMIDA", "MERIENDA", "CENA"];

// Variables de Estado Dinámico
let bloquesAsignadosPorIngesta = {};
let poolProteinas = [];
let poolCarbohidratos = [];
let poolGrasas = [];
let poolBuscadorCompleto = [];
let currentCategoryFilter = 'all';

// Mantiene el estado del plato aleatorio generado para poder mutar solo lo marcado
let platoInteligenteActual = {
    p: null,
    hc: null,
    g: null,
    ingesta: ""
};

let datosComodinFijo = {
    nombreReceta: "",
    proteinasIds: [],
    carbohidratosIds: [],
    grasasIds: [],
    libresTexto: ""
};

let exclusionesPaciente = {
    estiloVida: "",
    tagsExcluir: [],
    alimentosOdiados: []
};
