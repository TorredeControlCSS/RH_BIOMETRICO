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
  btnPdfManager: document.getElementById("btnPdfManager"), // <--- NUEVO
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
  
  // 1. Llenamos el combo de ciclos
  populateCycles(); 
  
  await loadMeta();

  el.btnQuery.addEventListener("click", doQuery);
  
  // CAMBIO: Ahora usamos la función local printReport
  el.btnPdf.addEventListener("click", () => printReport('detail'));
  
  el.btnClear.addEventListener("click", clearUI);

  // CAMBIO: Ahora usamos la función local printReport
  el.btnPdfManager.addEventListener("click", () => printReport('manager'));

  // 2. Lógica al cambiar el ciclo: Actualiza fechas automáticamente
  el.cycle.addEventListener("change", () => {
    const val = el.cycle.value;
    if (val === "manual") {
      // Si elige manual, no borramos las fechas, dejamos que el usuario edite
      return;
    }
    // Si elige un ciclo, separamos el value "YYYY-MM-DD|YYYY-MM-DD"
    const [dFrom, dTo] = val.split("|");
    el.from.value = dFrom;
    el.to.value = dTo;
  });
  
  // (Opcional) Si el usuario toca las fechas manualmente, regresamos el combo a "manual"
  const setManual = () => { el.cycle.value = "manual"; };
  el.from.addEventListener("input", setManual);
  el.to.addEventListener("input", setManual);
});
// =====================
// Lógica de Ciclos
// =====================
function populateCycles() {
  const sel = el.cycle;
  // Limpiamos y dejamos la opción manual
  sel.innerHTML = '<option value="manual">Rango manual</option>';

  const now = new Date();
  // Generamos los últimos 18 ciclos hacia atrás
  for (let i = 0; i < 18; i++) {
    // Fin del ciclo: día 15 del mes actual (restando i meses)
    const endDate = new Date(now.getFullYear(), now.getMonth() - i, 15);
    
    // Inicio del ciclo: día 16 del mes anterior
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 16);

    // Formato para el VALUE (YYYY-MM-DD)
    const sStr = startDate.toISOString().split("T")[0];
    const eStr = endDate.toISOString().split("T")[0];

    // Formato para la ETIQUETA (Ej: 16 Dic 2025 → 15 Ene 2026)
    const opts = { month: 'short', year: 'numeric', day: 'numeric' };
    const label = `${startDate.toLocaleDateString('es-ES', opts)} → ${endDate.toLocaleDateString('es-ES', opts)}`;

    const opt = document.createElement("option");
    opt.value = `${sStr}|${eStr}`; // Guardamos las fechas separadas por |
    opt.textContent = label;
    sel.appendChild(opt);
  }
}
async function doPdfManager() {
  // ... validaciones de employee, from, to igual que antes ...
  const employee = el.employee.value || "TODOS";
  const from = el.from.value;
  const to = el.to.value;
  if (!from || !to) { setStatus("Selecciona fechas.","danger"); return; }

  el.btnPdfManager.disabled = true;
  try {
    setStatus("Generando Reporte Gerencial...", "");
    // Agregamos &type=manager a la URL
    const url = qs({ action: "pdf", token: TOKEN, employee, from, to, type: "manager" });
    const j = await fetchJSON(url);
    window.open(j.downloadUrl, "_blank");
    setStatus("PDF Gerencial listo.", "ok");
  } catch (e) {
    setStatus("Error: " + e.message, "danger");
  } finally {
    el.btnPdfManager.disabled = false;
  }
}
/* ======================================================
   GENERADOR DE PDF (FRONT-END)
   ====================================================== */
function printReport(type) {
  // Verificamos si hay datos cargados en memoria
  if (!currentData || !currentData.ok) {
    alert("Primero debes realizar una consulta para poder generar el PDF.");
    return;
  }

  const q = currentData; // Usamos los datos que ya están en el dashboard
  const t = q.totals || {};
  const p = q.params || {};

  // LOGO: Ahora sí podemos usar la ruta relativa porque estamos en el navegador
  const LOGO_URL = "./icons/icon-512.png"; 

  // Helpers
  const esc = s => String(s || "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
  const money = v => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(v || 0);

  // Gráfico de Pastel (QuickChart)
  const chartUrl = `https://quickchart.io/chart?c={type:'pie',data:{labels:['Alimentación','Transporte'],datasets:[{data:[${t.total_alim_total||0},${t.total_transp_total||0}]}]},options:{plugins:{legend:{position:'right'}}}}`;

  // Datos
  const rowsAsistencia = (q.asistencia || []);
  const rowsHe = (q.he_daily || []);
  const rowsBen = (q.beneficios || []);
  const rowsCiclo = (q.resumen_ciclo || []);

  // Función para crear tablas
  const table = (title, cols, rows, labels) => {
    if (!rows.length) return "";
    const th = cols.map((c, i) => `<th>${labels[i]}</th>`).join("");
    const body = rows.map((r, i) => {
      const td = cols.map(c => `<td>${esc(r[c])}</td>`).join("");
      return `<tr class="${i%2===0?'even':'odd'}">${td}</tr>`;
    }).join("");
    return `<div class="section-title">${title}</div><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
  };

  // --- CONSTRUCCIÓN DEL HTML ---
  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Reporte_${p.employee}</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10px; color: #333; margin: 0; -webkit-print-color-adjust: exact; }
      
      /* HEADER */
      .header { background-color: #0b1f3a; color: white; padding: 15px; display: flex; align-items: center; border-bottom: 4px solid #bf9000; }
      .logo { width: 50px; height: 50px; margin-right: 15px; background: white; border-radius: 4px; padding: 2px; object-fit: contain; }
      .header-titles { flex: 1; }
      .main-title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
      .sub-title { font-size: 11px; opacity: 0.9; }
      .meta-info { text-align: right; font-size: 10px; color: #eee; }

      /* RULES */
      .rules-box { background: #f4f6f9; border-left: 5px solid #0b1f3a; padding: 10px; margin: 15px 0; font-size: 9px; display: flex; justify-content: space-between; }
      .rules-title { font-weight: bold; color: #0b1f3a; text-transform: uppercase; }

      /* KPIS */
      .kpi-container { display: flex; gap: 10px; margin-bottom: 20px; }
      .kpi-card { flex: 1; border: 1px solid #ccc; border-radius: 4px; padding: 8px; text-align: center; background: white; }
      .kpi-label { font-size: 8px; color: #666; font-weight: 700; text-transform: uppercase; }
      .kpi-val { font-size: 14px; font-weight: bold; color: #0b1f3a; }
      .highlight { color: #0a7a2f; }

      /* TABLES */
      .section-title { font-size: 11px; font-weight: bold; color: #0b1f3a; margin-top: 20px; border-bottom: 2px solid #ccc; }
      table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 5px; }
      th { background: #0b1f3a; color: white; padding: 5px; text-align: left; }
      td { padding: 4px 5px; border-bottom: 1px solid #eee; }
      tr.even { background-color: #f9f9f9; }
      
      .footer { margin-top: 30px; font-size: 8px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 5px; }
      .pagebreak { page-break-before: always; }
      
      @media print { .no-print { display: none; } }
    </style>
  </head>
  <body>
    <div class="header">
      <img src="${LOGO_URL}" class="logo">
      <div class="header-titles">
        <div class="main-title">Reporte de Gestión Biométrica</div>
        <div class="sub-title">Torre de Control CSS — DINALOG — CEDIS Panamá</div>
      </div>
      <div class="meta-info">
        <div><b>Colaborador:</b> ${esc(p.employee)}</div>
        <div><b>Periodo:</b> ${esc(p.from)} al ${esc(p.to)}</div>
        <div>Generado: ${new Date().toLocaleDateString()}</div>
      </div>
    </div>

    <div class="rules-box">
      <div>
        <div class="rules-title">Reglas de Pago</div>
        <div>1. Laborables: HE > 15:30 (Salida ≥ 16:30). | 2. Fines Semana: HE desde Entrada. | 3. Cap 40h/ciclo.</div>
      </div>
      <div style="align-self:center;"><b>ESTATUS: AUDITABLE</b></div>
    </div>

    <div class="kpi-container">
      <div class="kpi-card"><div class="kpi-label">HE Calc</div><div class="kpi-val">${esc(t.he_calc_hhmm)}</div></div>
      <div class="kpi-card"><div class="kpi-label">HE Pagadas</div><div class="kpi-val">${esc(t.he_paid_capped_hhmm)}</div></div>
      <div class="kpi-card"><div class="kpi-label">TXT Bolsón</div><div class="kpi-val">${esc(t.txt_total_hhmm)}</div></div>
      <div class="kpi-card" style="border-color:#0a7a2f"><div class="kpi-label highlight">Monto HE</div><div class="kpi-val highlight">$${esc(t.he_amount_paid_capped)}</div></div>
      <div class="kpi-card" style="background:#f0f8ff"><div class="kpi-label">Beneficios</div><div class="kpi-val">$${esc(t.total_beneficios_total)}</div></div>
    </div>
    
    <!-- Gráfico solo si hay beneficios -->
    <div style="text-align:center; margin-bottom:10px;">
       <img src="${chartUrl}" style="max-height:100px;">
    </div>

    ${table("Consolidado de Nómina por Ciclo",
      ["cycle","he_calc_total_hhmm","he_paid_capped_hhmm","txt_total_hhmm","he_amount_paid_capped","alim_total","transp_total","beneficios_total"],
      rowsCiclo,
      ["Ciclo","HE Calc","HE Pagada","TXT","Monto HE ($)","Alim ($)","Transp ($)","Total Ben ($)"]
    )}
  `;

  // --- SI ES GERENCIAL CORTAMOS AQUI ---
  if (type === 'manager') {
    html += `<div class="footer">Reporte Gerencial - Resumen Ejecutivo</div></body></html>`;
  } else {
    // --- SI ES DETALLE AGREGAMOS LO DEMÁS ---
    html += `
      <div class="pagebreak"></div>
      ${table("Registro de Asistencia",
        ["date","weekday","first_in","last_out","work_span_hhmm","marks_count","audit_flag","issues"],
        rowsAsistencia,
        ["Fecha","Día","Entrada","Salida","H. Trab","Marcas","Estado","Obs"]
      )}
      
      <div class="pagebreak"></div>
      ${table("Cálculo Diario HE",
        ["date","day_type","he_calc_hhmm","audit_flag"],
        rowsHe,
        ["Fecha","Tipo Día","HE Calc","Estado"]
      )}
      
      <div style="margin-top:20px"></div>
      ${table("Beneficios Diarios",
        ["date","alim_b","transp_b","benefits_b","benefits_rule"],
        rowsBen,
        ["Fecha","Alim","Transp","Total","Regla"]
      )}
      <div class="footer">Reporte Detallado de Auditoría</div></body></html>
    `;
  }

  // ABRIR VENTANA E IMPRIMIR
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  // Esperar un poquito a que cargue el logo y el gráfico
  setTimeout(() => {
    win.focus();
    win.print();
  }, 800);
}
