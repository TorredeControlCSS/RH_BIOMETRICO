/*******************************************************
 * RH BIOMÉTRICO — FRONTEND DASHBOARD (GitHub Pages)
 * Consume WebApp GAS:
 *  ?action=meta&token=...
 *  ?action=query&token=...&employee=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *  ?action=pdf&token=...&employee=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *******************************************************/

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxHZg8vPJ9ECi45nIdr4L3CMN3UTupgCr06ho9AQ5iLUx2e-m0RRc2Mfg020IQorIFv/exec";
const API_TOKEN   = "RH_DINALOG"; // Puedes acortarlo, pero reduce seguridad

// =====================
// UI refs
// =====================
const elEmployee = document.getElementById("employee");
const elCycle = document.getElementById("cycleSelect");
const elFrom = document.getElementById("from");
const elTo = document.getElementById("to");
const elStatus = document.getElementById("status");
const btnBuscar = document.getElementById("btnBuscar");
const btnPdf = document.getElementById("btnPdf");
const btnLimpiar = document.getElementById("btnLimpiar");

// KPIs
const kpiEvents = document.getElementById("kpiEvents");
const kpiDays = document.getElementById("kpiDays");
const kpiHeCalc = document.getElementById("kpiHeCalc");
const kpiHePay = document.getElementById("kpiHePay");
const kpiTxt = document.getElementById("kpiTxt");
const kpiBen = document.getElementById("kpiBen");

// Tables
const headAsistencia = document.getElementById("headAsistencia");
const bodyAsistencia = document.getElementById("bodyAsistencia");
const headHE = document.getElementById("headHE");
const bodyHE = document.getElementById("bodyHE");
const headBEN = document.getElementById("headBEN");
const bodyBEN = document.getElementById("bodyBEN");
const headCYCLES = document.getElementById("headCYCLES");
const bodyCYCLES = document.getElementById("bodyCYCLES");

// Charts
let chartCycles = null;
let chartBenefits = null;

// =====================
// Init
// =====================
init();

async function init() {
  initDateTimeTicker();
  initTabs();
  initTheme();

  buildCycles(12);
  attachHandlers();

  setStatus("Cargando empleados...", "muted");
  await loadEmployees();
  setStatus("Listo.", "ok");
}

// =====================
// Handlers
// =====================
function attachHandlers() {
  btnBuscar.addEventListener("click", async () => runQuery());
  btnPdf.addEventListener("click", async () => runPdf());
  btnLimpiar.addEventListener("click", () => clearUI());

  elCycle.addEventListener("change", () => {
    const v = elCycle.value;
    if (!v) return;
    const [from, to] = v.split("|");
    elFrom.value = from;
    elTo.value = to;
  });
}

// =====================
// API
// =====================
async function apiGet(params) {
  const url = new URL(WEB_APP_URL);
  params.token = API_TOKEN;
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, String(v ?? "")));

  const resp = await fetch(url.toString(), { method: "GET" });
  const data = await resp.json();
  if (!data || data.ok !== true) {
    const msg = (data && data.error) ? data.error : "Error desconocido en API";
    throw new Error(msg);
  }
  return data;
}

async function loadEmployees() {
  const data = await apiGet({ action: "meta" });
  const employees = data.employees || ["TODOS"];

  elEmployee.innerHTML = "";
  employees.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    elEmployee.appendChild(opt);
  });
}

async function runQuery() {
  const employee = (elEmployee.value || "TODOS").trim();
  const from = (elFrom.value || "").trim();
  const to = (elTo.value || "").trim();

  if (!from || !to) return setStatus("Debe indicar Desde y Hasta.", "danger");
  if (to < from) return setStatus("Rango inválido: 'Hasta' no puede ser menor que 'Desde'.", "danger");

  btnBuscar.disabled = true;
  btnPdf.disabled = true;

  try {
    setStatus("Consultando datos...", "muted");

    const q = await apiGet({ action: "query", employee, from, to });

    renderKPIs(q);
    renderTables(q);
    renderCharts(q);

    setStatus("Consulta completada.", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Error: " + e.message, "danger");
  } finally {
    btnBuscar.disabled = false;
    btnPdf.disabled = false;
  }
}

async function runPdf() {
  const employee = (elEmployee.value || "TODOS").trim();
  const from = (elFrom.value || "").trim();
  const to = (elTo.value || "").trim();

  if (!from || !to) return setStatus("Debe indicar Desde y Hasta.", "danger");

  btnPdf.disabled = true;
  try {
    setStatus("Generando PDF...", "muted");
    const r = await apiGet({ action: "pdf", employee, from, to });

    if (r.downloadUrl) {
      window.open(r.downloadUrl, "_blank");
      setStatus("PDF generado.", "ok");
    } else {
      setStatus("PDF generado, pero no se recibió URL.", "danger");
    }
  } catch (e) {
    console.error(e);
    setStatus("Error PDF: " + e.message, "danger");
  } finally {
    btnPdf.disabled = false;
  }
}

// =====================
// Render
// =====================
function renderKPIs(q) {
  const t = q.totals || {};
  const rm = q.resumen_mensual || {};
  const rmt = rm.totals || {};

  kpiEvents.textContent = safeNum(t.total_events);
  kpiDays.textContent   = safeNum(t.total_days);

  // Total HE calculada (rango)
  kpiHeCalc.textContent = t.he_calc_hhmm || "00:00";

  // HE pagable cap 40h por ciclo (rango)
  kpiHePay.textContent  = rmt.total_he_paid_capped_hhmm || "00:00";

  // TXT total (rango)
  kpiTxt.textContent    = rmt.total_txt_hhmm || "00:00";

  // Beneficios (rango)
  kpiBen.textContent    = money(t.total_beneficios);
}

function renderTables(q) {
  // Asistencia diaria
  const asistenciaCols = ["full_name","date","weekday","day_type","marks_count","first_in","last_out","work_span_hhmm","audit_flag","issues"];
  buildTable(headAsistencia, bodyAsistencia, asistenciaCols, q.asistencia || []);

  // HE diario (solo “cálculo diario”, el cap por ciclo está en Resumen Mensual)
  const heCols = ["full_name","date","day_type","first_in","last_out","he_calc_hhmm","he_payable_hhmm","rule_applied","catalog_match"];
  buildTable(headHE, bodyHE, heCols, q.he_txt || []);

  // Beneficios
  const benCols = ["full_name","date","day_type","alim_b","transp_b","benefits_b","benefits_rule","catalog_match_benef"];
  buildTable(headBEN, bodyBEN, benCols, q.beneficios || []);

  // Resumen por ciclo (cap 40h + TXT)
  const rm = q.resumen_mensual || {};
  const rows = rm.rows || [];
  const cyclesCols = [
    "cycle",
    "full_name",
    "he_calc_total_hhmm",
    "he_paid_capped_hhmm",
    "txt_total_hhmm",
    "alim_total",
    "tr_total"
  ];
  buildTable(headCYCLES, bodyCYCLES, cyclesCols, rows);
}

function buildTable(headEl, bodyEl, cols, rows) {
  headEl.innerHTML = cols.map(c => `<th>${escapeHtml(c)}</th>`).join("");
  bodyEl.innerHTML = rows.map(r => {
    const tds = cols.map(c => `<td>${escapeHtml(r[c])}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
}

function renderCharts(q) {
  // 1) Horas por ciclo (HE calc / HE pag cap / TXT)
  const rm = q.resumen_mensual || {};
  const rows = rm.rows || [];

  const labels = rows.map(r => String(r.cycle || ""));
  const heCalc = rows.map(r => hhmmToHours(r.he_calc_total_hhmm));
  const hePayC = rows.map(r => hhmmToHours(r.he_paid_capped_hhmm));
  const txtTot = rows.map(r => hhmmToHours(r.txt_total_hhmm));

  const ctxC = document.getElementById("chartCycles");
  if (chartCycles) chartCycles.destroy();
  chartCycles = new Chart(ctxC, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "HE Calc (h)", data: heCalc },
        { label: "HE Pag (cap) (h)", data: hePayC },
        { label: "TXT (h)", data: txtTot }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });

  // 2) Beneficios por tipo de día
  const benRows = q.beneficios || [];
  const dayTypes = ["LABORABLE","FIN_DE_SEMANA","FERIADO"];
  const sum = (arr, fn) => arr.reduce((a,x)=>a + (fn(x)||0), 0);

  const alimBy   = dayTypes.map(dt => sum(benRows.filter(r => r.day_type === dt), r => toNum(r.alim_b)));
  const transpBy = dayTypes.map(dt => sum(benRows.filter(r => r.day_type === dt), r => toNum(r.transp_b)));

  const ctxB = document.getElementById("chartBenefits");
  if (chartBenefits) chartBenefits.destroy();
  chartBenefits = new Chart(ctxB, {
    type: "bar",
    data: {
      labels: dayTypes,
      datasets: [
        { label: "Alimentación", data: alimBy },
        { label: "Transporte", data: transpBy }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

// =====================
// UI utilities
// =====================
function clearUI() {
  kpiEvents.textContent = "0";
  kpiDays.textContent = "0";
  kpiHeCalc.textContent = "00:00";
  kpiHePay.textContent = "00:00";
  kpiTxt.textContent = "00:00";
  kpiBen.textContent = "USD 0.00";

  headAsistencia.innerHTML = ""; bodyAsistencia.innerHTML = "";
  headHE.innerHTML = ""; bodyHE.innerHTML = "";
  headBEN.innerHTML = ""; bodyBEN.innerHTML = "";
  headCYCLES.innerHTML = ""; bodyCYCLES.innerHTML = "";

  if (chartCycles) chartCycles.destroy();
  if (chartBenefits) chartBenefits.destroy();
  chartCycles = null; chartBenefits = null;

  setStatus("Listo.", "ok");
}

function setStatus(msg, cls) {
  elStatus.className = "status";
  if (cls) elStatus.classList.add(cls);
  elStatus.textContent = msg;
}

function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const show = (key) => {
    document.getElementById("tab-asistencia").style.display = (key === "asistencia") ? "block" : "none";
    document.getElementById("tab-he").style.display = (key === "he") ? "block" : "none";
    document.getElementById("tab-ben").style.display = (key === "ben") ? "block" : "none";
    document.getElementById("tab-cycles").style.display = (key === "cycles") ? "block" : "none";
  };

  tabs.forEach(t => {
    t.addEventListener("click", () => {
      tabs.forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      show(t.getAttribute("data-tab"));
    });
  });

  show("asistencia");
}

function initDateTimeTicker() {
  const el = document.getElementById("currentDateTime");
  const tick = () => {
    const d = new Date();
    el.textContent = d.toLocaleString("es-PA", {
      year:"numeric", month:"2-digit", day:"2-digit",
      hour:"2-digit", minute:"2-digit"
    });
  };
  tick();
  setInterval(tick, 15000);
}

function initTheme() {
  const sel = document.getElementById("themeMode");
  const apply = (mode) => {
    document.body.style.background = (mode === "dark") ? "#0b1220" : "#fff";
    document.body.style.color = (mode === "dark") ? "#e5e7eb" : "#111";
  };
  sel.addEventListener("change", () => apply(sel.value));
  apply(sel.value || "light");
}

// =====================
// Ciclos 16 → 15
// =====================
function buildCycles(n = 12) {
  elCycle.innerHTML = "";

  const now = new Date();
  for (let i = 0; i < n; i++) {
    const start = cycleStartDate(addMonths(now, -i));
    const end = cycleEndDate(start);

    const from = ymd(start);
    const to = ymd(end);

    const opt = document.createElement("option");
    opt.value = `${from}|${to}`;
    opt.textContent = `${from} → ${to} (Ciclo)`;
    elCycle.appendChild(opt);
  }

  const [from0, to0] = elCycle.value.split("|");
  elFrom.value = from0;
  elTo.value = to0;
}

function cycleStartDate(d) {
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  if (day >= 16) return new Date(year, month, 16);
  return new Date(year, month - 1, 16);
}

function cycleEndDate(start) {
  return new Date(start.getFullYear(), start.getMonth() + 1, 15);
}

function addMonths(d, m) {
  return new Date(d.getFullYear(), d.getMonth() + m, d.getDate());
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// =====================
// Helpers
// =====================
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function safeNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? String(x) : "0";
}

function money(n) {
  const x = Number(n);
  const v = Number.isFinite(x) ? x : 0;
  return v.toLocaleString("es-PA", { style:"currency", currency:"USD" });
}

// Convierte "HH:MM" a horas (float)
function hhmmToHours(hhmm) {
  const s = String(hhmm || "00:00").trim();
  const parts = s.split(":");
  if (parts.length < 2) return 0;
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h + (m/60);
}

function toNum(v) {
  const x = Number(String(v ?? "0").replaceAll(",",""));
  return Number.isFinite(x) ? x : 0;
}
