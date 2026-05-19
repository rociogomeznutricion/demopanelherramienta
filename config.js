// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN PRINCIPAL Y ESTADO GLOBAL
// ─────────────────────────────────────────────────────────────

const MASTER_CONTROL_URL = 'https://docs.google.com/spreadsheets/d/1L7lbZ4JkE7dqO_oizMEDKQabtyUBbR4yaqcrt3LMa6Q/gviz/tq?gid=0&tqx=out:json';

// GIDs de pestañas del paciente
const GID_PACIENTE_MASTER = '0';
const GID_EQUIV = '1979658163';

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