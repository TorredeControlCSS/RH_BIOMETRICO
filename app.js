/*******************************************************
 * RH BIOMÉTRICO — FRONTEND DASHBOARD (GitHub Pages)
 * Consume WebApp GAS:
 *  ?action=meta&token=...
 *  ?action=query&token=...&employee=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *  ?action=pdf&token=...&employee=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *******************************************************/

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxHZg8vPJ9ECi45nIdr4L3CMN3UTupgCr06ho9AQ5iLUx2e-m0RRc2Mfg020IQorIFv/exec";
const API_TOKEN   = "RH_DINALOG";

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

// KPI
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
let chartDayType = null;
let chartBenefits = null;
let chartTxtCycle = null;

// =====================
// Init
// =====================
init();

async function init() {
  initDateTimeTicker();
  initTabs();
  initTheme();

  buildCycles(12); // últimos 12 ciclos
  attachHandlers();

  setStatus("Cargando empleados...", "muted");
  await loadEmployees();
  setStatus("Listo.", "ok");
}

// =====================
// Handlers
// =====================
function attachHandlers() {
  btnBuscar.addEventListener("click", async () => {
    await runQuery();
  });

  btnPdf.addEventListener("click", async () => {
    await runPdf();
  });

  btnLimpiar.addEventListener("click", () => {
    clearUI();
  });

  elCycle.addEventListener("change", () => {
    const v = elCycle.value; // "YYYY-MM-DD|YYYY-MM-DD"
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

  if (!from || !to) {
    setStatus("Debe indicar Desde y Hasta.", "danger");
    return;
  }
  if (to < from) {
    setStatus("Rango inválido: 'Hasta' no puede ser menor que 'Desde'.", "danger");
    return;
  }

  btnBuscar.disabled = true;
  btnPdf.disabled = true;

  try {
    setStatus("Consultando datos...", "muted");

    const q = await apiGet({
      action: "query",
      employee,
      from,
      to
    });

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

  if (!from || !to) {
    setStatus("Debe indicar Desde y Hasta.", "danger");
    return;
  }

  btnPdf.disabled = true;
  try {
    setStatus("Generando PDF...", "muted");
    const r = await apiGet({
      action: "pdf",
      employee,
      from,
      to
    });

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
  const m = q.monthly || {};
  const mt = (m.totals || {});

  kpiEvents.textContent = safeNum(t.total_events);
  kpiDays.textContent   = safeNum(t.total_days);
  kpiHeCalc.textContent = t.he_calc_hhmm || "00:00";
  kpiHePay.textContent  = t.he_pay_hhmm || "00:00";

  // TXT (Bolson) = TXT por cap (por ciclo)
  kpiTxt.textContent    = mt.txt_from_cap_hhmm || "00:00";

  kpiBen.textContent    = money(t.total_beneficios);
}

function renderTables(q) {
  // Asistencia
  const asistenciaCols = ["full_name","date","weekday","day_type","marks_count","first_in","last_out","work_span_hhmm","audit_flag","issues"];
  buildTable(headAsistencia, bodyAsistencia, asistenciaCols, q.asistencia || []);

  // HE/TXT (detalle diario)
  const heCols = ["full_name","date","day_type","first_in","last_out","he_calc_hhmm","he_payable_hhmm","txt_hhmm","rule_applied","catalog_match"];
  buildTable(headHE, bodyHE, heCols, q.he_txt || []);

  // Beneficios
  const benCols = ["full_name","date","day_type","alim_b","transp_b","benefits_b","benefits_rule","catalog_match_benef"];
  buildTable(headBEN, bodyBEN, benCols, q.beneficios || []);

  // Ciclos (resumen por ciclo + cap 40h + TXT por cap)
  const cycRows = (q.monthly && Array.isArray(q.monthly.rows)) ? q.monthly.rows : [];
  const cycCols = [
    "cycle",
    "full_name",
    "he_calc_total_hhmm",
    "he_paid_capped_hhmm",
    "txt_from_cap_hhmm",
    "he_amount_paid_capped",
    "alim_total",
    "transp_total"
  ];
  buildTable(headCYCLES, bodyCYCLES, cycCols, cycRows);
}

function buildTable(headEl, bodyEl, cols, rows) {
  headEl.innerHTML = cols.map(c => `<th>${escapeHtml(c)}</th>`).join("");
  bodyEl.innerHTML = rows.map(r => {
    const tds = cols.map(c => `<td>${escapeHtml(r[c])}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
}

function renderCharts(q) {
  const heRows = q.he_txt || [];
  const benRows = q.beneficios || [];

  const dayTypes = ["LABORABLE","FIN_DE_SEMANA","FERIADO"];
  const sum = (arr, fn) => arr.reduce((a,x)=>a + (fn(x)||0), 0);

  const heCalcBy = dayTypes.map(dt => sum(heRows.filter(r => r.day_type === dt), r => hhmmToHours(r.he_calc_hhmm)));
  const hePayBy  = dayTypes.map(dt => sum(heRows.filter(r => r.day_type === dt), r => hhmmToHours(r.he_payable_hhmm)));
  const txtDailyBy = dayTypes.map(dt => sum(heRows.filter(r => r.day_type === dt), r => hhmmToHours(r.txt_hhmm)));

  const alimBy   = dayTypes.map(dt => sum(benRows.filter(r => r.day_type === dt), r => toNum(r.alim_b)));
  const transpBy = dayTypes.map(dt => sum(benRows.filter(r => r.day_type === dt), r => toNum(r.transp_b)));

  // Chart 1 - Horas por tipo de día (TXT diario, NO el bolson por cap)
  const ctx1 = document.getElementById("chartDayType");
  if (chartDayType) chartDayType.destroy();
  chartDayType = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: dayTypes,
      datasets: [
        { label: "HE Calc (h)", data: heCalcBy },
        { label: "HE Pag (h)", data: hePayBy },
        { label: "TXT diario (h)", data: txtDailyBy }
      ]
    },
    options: { responsive:true, scales:{ y:{ beginAtZero:true } } }
  });

  // Chart 2 - Beneficios
  const ctx2 = document.getElementById("chartBenefits");
  if (chartBenefits) chartBenefits.destroy();
  chartBenefits = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: dayTypes,
      datasets: [
        { label: "Alimentación", data: alimBy },
        { label: "Transporte", data: transpBy }
      ]
    },
    options: { responsive:true, scales:{ y:{ beginAtZero:true } } }
  });

  // Chart 3 - TXT por ciclo (cap 40h)
  const cycRows = (q.monthly && Array.isArray(q.monthly.rows)) ? q.monthly.rows : [];
  const cycLabels = cycRows.map(r => String(r.cycle || ""));
  const txtCapHours = cycRows.map(r => hhmmToHours(r.txt_from_cap_hhmm));

  const ctx3 = document.getElementById("chartTxtCycle");
  if (chartTxtCycle) chartTxtCycle.destroy();
  chartTxtCycle = new Chart(ctx3, {
    type: "bar",
    data: {
      labels: cycLabels,
      datasets: [
        { label: "TXT (cap) h", data: txtCapHours }
      ]
    },
    options: { responsive:true, scales:{ y:{ beginAtZero:true } } }
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
  kpiBen.textContent = "$0.00";

  headAsistencia.innerHTML = ""; bodyAsistencia.innerHTML = "";
  headHE.innerHTML = ""; bodyHE.innerHTML = "";
  headBEN.innerHTML = ""; bodyBEN.innerHTML = "";
  headCYCLES.innerHTML = ""; bodyCYCLES.innerHTML = "";

  if (chartDayType) chartDayType.destroy();
  if (chartBenefits) chartBenefits.destroy();
  if (chartTxtCycle) chartTxtCycle.destroy();
  chartDayType = null;
  chartBenefits = null;
  chartTxtCycle = null;

  setStatus("Listo.", "ok");
}

function setStatus(msg, cls) {
  elStatus.className = "status";
  if (cls) elStatus.classList.add(cls);
  elStatus.textContent = msg;
}

function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(t => {
    t.addEventListener("click", () => {
      tabs.forEach(x => x.classList.remove("active"));
      t.classList.add("active");

      const key = t.getAttribute("data-tab");
      document.getElementById("tab-asistencia").style.display = (key === "asistencia") ? "block" : "none";
      document.getElementById("tab-he").style.display = (key === "he") ? "block" : "none";
      document.getElementById("tab-ben").style.display = (key === "ben") ? "block" : "none";
      document.getElementById("tab-cycles").style.display = (key === "cycles") ? "block" : "none";
    });
  });
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
    if (mode === "dark") {
      document.body.style.background = "#0b1220";
      document.body.style.color = "#e5e7eb";
    } else {
      document.body.style.background = "#fff";
      document.body.style.color = "#111";
    }
  };
  sel.addEventListener("change", () => apply(sel.value));
  apply("light");
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

function hhmmToHours(hhmm) {
  const s = String(hhmm || "00:00");
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
