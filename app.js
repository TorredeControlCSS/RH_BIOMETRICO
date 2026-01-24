/*******************************************************
 * RH BIOMÉTRICO – FRONTEND (GitHub Pages)
 * - Consume WebApp GAS: action=meta | action=query | action=pdf
 * - Dash ejecutivo con KPIs, charts y tablas
 *******************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbxHZg8vPJ9ECi45nIdr4L3CMN3UTupgCr06ho9AQ5iLUx2e-m0RRc2Mfg020IQorIFv/exec";
const TOKEN = "RH_DINALOG"; // puedes acortarlo si quieres, pero mantén algo difícil de adivinar

let chartDayType = null;
let chartBenefits = null;
let chartCycles = null;

const el = {
  employee: document.getElementById("employee"),
  cycle: document.getElementById("cycle"),
  from: document.getElementById("from"),
  to: document.getElementById("to"),
  btnQuery: document.getElementById("btnQuery"),
  btnPdf: document.getElementById("btnPdf"),
  btnClear: document.getElementById("btnClear"),
  status: document.getElementById("status"),

  // KPIs
  kpiEvents: document.getElementById("kpiEvents"),
  kpiDays: document.getElementById("kpiDays"),
  kpiHeCalc: document.getElementById("kpiHeCalc"),
  kpiHePay: document.getElementById("kpiHePay"),
  kpiTxt: document.getElementById("kpiTxt"),
  kpiBen: document.getElementById("kpiBen"),

  // Tables
  headAsistencia: document.getElementById("headAsistencia"),
  bodyAsistencia: document.getElementById("bodyAsistencia"),
  headHE: document.getElementById("headHE"),
  bodyHE: document.getElementById("bodyHE"),
  headBEN: document.getElementById("headBEN"),
  bodyBEN: document.getElementById("bodyBEN"),
  headCYC: document.getElementById("headCYC"),
  bodyCYC: document.getElementById("bodyCYC"),
};

let lastQueryData = null;

// =====================
// Util
// =====================
function qs(params) {
  const u = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") u.searchParams.set(k, v);
  });
  return u.toString();
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Error desconocido");
  return j;
}

function setStatus(msg, cls) {
  el.status.textContent = msg || "";
  el.status.className = cls ? cls : "";
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : (v ?? "0");
}

function hhmmToHours(hhmm) {
  const s = String(hhmm || "00:00");
  const parts = s.split(":").map(x => parseInt(x, 10));
  if (parts.length < 2) return 0;
  return (parts[0] || 0) + (parts[1] || 0) / 60;
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "USD 0.00";
  return `USD ${n.toFixed(2)}`;
}

function buildTable(headEl, bodyEl, cols, rows) {
  if (!headEl || !bodyEl) return;
  headEl.innerHTML = "";
  bodyEl.innerHTML = "";

  // header
  const trh = document.createElement("tr");
  cols.forEach(c => {
    const th = document.createElement("th");
    th.textContent = c;
    trh.appendChild(th);
  });
  headEl.appendChild(trh);

  // body
  rows.forEach(r => {
    const tr = document.createElement("tr");
    cols.forEach(c => {
      const td = document.createElement("td");
      td.textContent = (r && r[c] != null) ? String(r[c]) : "";
      tr.appendChild(td);
    });
    bodyEl.appendChild(tr);
  });
}

// =====================
// Tabs
// =====================
function initTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  tabs.forEach(t => {
    t.addEventListener("click", () => {
      tabs.forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      const id = t.getAttribute("data-tab");
      document.querySelectorAll(".tab-content").forEach(p => p.classList.remove("active"));
      const panel = document.getElementById(id);
      if (panel) panel.classList.add("active");
    });
  });
}

// =====================
// Cycles (16→15)
// =====================
function computeCycleLabel(from, to) {
  if (!from || !to) return "";
  return `${from} → ${to} (Rango)`;
}

// =====================
// Meta (empleados)
// =====================
async function loadMeta() {
  setStatus("Cargando empleados...", "");
  const url = qs({ action: "meta", token: TOKEN });
  const j = await fetchJSON(url);

  el.employee.innerHTML = "";
  (j.employees || []).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    el.employee.appendChild(opt);
  });

  setStatus("Listo.", "ok");
}

// =====================
// Query
// =====================
async function doQuery() {
  const employee = el.employee.value || "TODOS";
  const from = el.from.value;
  const to = el.to.value;

  if (!from || !to) {
    setStatus("Debes seleccionar Desde y Hasta.", "danger");
    return;
  }

  el.btnQuery.disabled = true;
  try {
    setStatus("Consultando...", "");
    const url = qs({ action: "query", token: TOKEN, employee, from, to });
    const q = await fetchJSON(url);
    lastQueryData = q;

    renderKPIs(q);
    renderCharts(q);
    renderTables(q);

    setStatus("Consulta completada.", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Error: " + e.message, "danger");
  } finally {
    el.btnQuery.disabled = false;
  }
}

// =====================
// PDF
// =====================
async function doPdf() {
  const employee = el.employee.value || "TODOS";
  const from = el.from.value;
  const to = el.to.value;

  if (!from || !to) {
    setStatus("Debes seleccionar Desde y Hasta.", "danger");
    return;
  }

  el.btnPdf.disabled = true;
  try {
    setStatus("Generando PDF...", "");
    const url = qs({ action: "pdf", token: TOKEN, employee, from, to });
    const j = await fetchJSON(url);

    // abre descarga
    window.open(j.downloadUrl, "_blank");
    setStatus("PDF generado.", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Error PDF: " + e.message, "danger");
  } finally {
    el.btnPdf.disabled = false;
  }
}

// =====================
// Render
// =====================
function renderKPIs(q) {
  const t = q.totals || {};
  
  el.kpiEvents.textContent = safeNum(t.total_events);
  el.kpiDays.textContent   = safeNum(t.total_days);
  el.kpiHeCalc.textContent = t.he_calc_hhmm || "00:00";

  // HE pagadas y TXT se determinan por CAP 40h por ciclo (16→15), no por día.
  el.kpiHePay.textContent  = t.he_paid_capped_hhmm || "00:00";
  el.kpiTxt.textContent    = t.txt_total_hhmm || "00:00";

  el.kpiBen.textContent    = money(t.total_beneficios);
}

function renderTables(q) {
  // Asistencia
  const asistenciaCols = ["full_name","date","weekday","day_type","marks_count","first_in","last_out","work_span_hhmm","audit_flag","issues"];
  buildTable(el.headAsistencia, el.bodyAsistencia, asistenciaCols, q.asistencia || []);

  // HE/TXT (diario – TXT suele venir 00:00 porque el TXT real es por CAP)
  const heCols = ["full_name","date","day_type","first_in","last_out","he_calc_hhmm","he_payable_hhmm","txt_hhmm","rule_applied","catalog_match"];
  buildTable(el.headHE, el.bodyHE, heCols, q.he_daily || []); // Antes decía q.he_txt

  // Beneficios
  const benCols = ["full_name","date","day_type","alim_b","transp_b","benefits_b","benefits_rule","catalog_match_benef"];
  buildTable(el.headBEN, el.bodyBEN, benCols, q.beneficios || []);

  // Resumen por ciclo (CAP 40h)
  const cycCols = [
    "cycle",
    "full_name",
    "he_calc_total_hhmm",
    "he_paid_capped_hhmm",
    "txt_total_hhmm",
    "he_amount_paid_capped",
    "alim_total",
    "transp_total",
    "beneficios_total_usd"
  ];
  buildTable(el.headCYC, el.bodyCYC, cycCols, q.resumen_ciclo || []);
}

function renderCharts(q) {
  const heRows = q.he_daily || [];
  const benRows = q.beneficios || [];
  const monthlyRows = q.resumen_ciclo || [];

  const dayTypes = ["LABORABLE","FIN_DE_SEMANA","FERIADO"];
  const sum = (arr, fn) => arr.reduce((a, r) => a + fn(r), 0);

  // Chart 1: CORREGIDO (Quitamos he_payable_hhmm que da error)
  const heCalcBy = dayTypes.map(dt => sum(heRows.filter(r => r.day_type === dt), r => hhmmToHours(r.he_calc_hhmm)));
  
  // Como el backend no manda 'he_payable' diario, ponemos 0 para que no falle.
  const hePayBy  = dayTypes.map(dt => 0); 

  const ctx1 = document.getElementById("chartDayType").getContext("2d");
  if (chartDayType) chartDayType.destroy();
  chartDayType = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: dayTypes,
      datasets: [
        { label: "HE Calc (h)", data: heCalcBy },
        // Puedes quitar este dataset si quieres, o dejarlo en 0
        { label: "HE Pagable (h)", data: hePayBy }, 
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } }
    }
  });

  // Chart 2: beneficios (IGUAL QUE ANTES)
  const alimBy = dayTypes.map(dt => sum(benRows.filter(r => r.day_type === dt), r => Number(r.alim_b || 0)));
  const transpBy = dayTypes.map(dt => sum(benRows.filter(r => r.day_type === dt), r => Number(r.transp_b || 0)));

  const ctx2 = document.getElementById("chartBenefits").getContext("2d");
  if (chartBenefits) chartBenefits.destroy();
  chartBenefits = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: dayTypes,
      datasets: [
        { label: "Alimentación", data: alimBy },
        { label: "Transporte", data: transpBy },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } }
    }
  });

  // Chart 3: CORREGIDO (Escala controlada por el HTML)
  const byCycle = new Map();
  for (const r of monthlyRows) {
    const c = String(r.cycle || "");
    if (!c) continue;
    if (!byCycle.has(c)) {
      byCycle.set(c, { hePaid: 0, txt: 0, heCalc: 0 });
    }
    const o = byCycle.get(c);
    o.hePaid += hhmmToHours(r.he_paid_capped_hhmm);
    o.txt    += hhmmToHours(r.txt_total_hhmm);
    o.heCalc += hhmmToHours(r.he_calc_total_hhmm);
  }

  const cycleLabels = Array.from(byCycle.keys());
  const hePaidCapH = cycleLabels.map(c => byCycle.get(c).hePaid);
  const txtH = cycleLabels.map(c => byCycle.get(c).txt);
  const heCalcTotH = cycleLabels.map(c => byCycle.get(c).heCalc);

  const ctx3 = document.getElementById("chartCycles").getContext("2d");
  if (chartCycles) chartCycles.destroy();
  chartCycles = new Chart(ctx3, {
    type: "bar",
    data: {
      labels: cycleLabels,
      datasets: [
        { label: "HE Pagadas (cap 40h)", data: hePaidCapH, stack: "stack1" },
        { label: "TXT (bolsón)", data: txtH, stack: "stack1" },
        { label: "HE Calculadas (total)", data: heCalcTotH, stack: "stack2" },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // <--- ESTO ES CLAVE
      plugins: { legend: { position: "top" } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    }
  });
}

// =====================
// Clear
// =====================
function clearUI() {
  lastQueryData = null;

  el.kpiEvents.textContent = "0";
  el.kpiDays.textContent = "0";
  el.kpiHeCalc.textContent = "00:00";
  el.kpiHePay.textContent = "00:00";
  el.kpiTxt.textContent = "00:00";
  el.kpiBen.textContent = "USD 0.00";

  el.headAsistencia.innerHTML = ""; el.bodyAsistencia.innerHTML = "";
  el.headHE.innerHTML = ""; el.bodyHE.innerHTML = "";
  el.headBEN.innerHTML = ""; el.bodyBEN.innerHTML = "";
  el.headCYC.innerHTML = ""; el.bodyCYC.innerHTML = "";

  if (chartDayType) chartDayType.destroy();
  if (chartBenefits) chartBenefits.destroy();
  if (chartCycles) chartCycles.destroy();
  chartDayType = null; chartBenefits = null; chartCycles = null;

  setStatus("", "");
}

// =====================
// Init
// =====================
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  await loadMeta();

  el.btnQuery.addEventListener("click", doQuery);
  el.btnPdf.addEventListener("click", doPdf);
  el.btnClear.addEventListener("click", clearUI);

  // Si cambias el ciclo manualmente, solo mostramos label (tu lógica de ciclos la decides luego)
  el.cycle.addEventListener("change", () => {
    // placeholder: si luego quieres que ciclo setee from/to automáticamente, lo conectamos aquí
  });
});
