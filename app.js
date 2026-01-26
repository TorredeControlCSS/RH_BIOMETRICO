/*******************************************************
 * RH BIOMÉTRICO – FRONTEND (GitHub Pages)
 * - Consume WebApp GAS: action=meta | action=query
 * - Dash ejecutivo con KPIs, charts y tablas
 * - PDF Generation: Frontend (Browser-based)
 *******************************************************/

const API_URL = "https://script.google.com/macros/s/AKfycbxHZg8vPJ9ECi45nIdr4L3CMN3UTupgCr06ho9AQ5iLUx2e-m0RRc2Mfg020IQorIFv/exec";
const TOKEN = "RH_DINALOG"; 

// VARIABLES GLOBALES
let chartDayType = null;
let chartBenefits = null;
let chartCycles = null;
let currentData = null; // Variable crítica para guardar la última consulta

const el = {
  employee: document.getElementById("employee"),
  cycle: document.getElementById("cycle"),
  from: document.getElementById("from"),
  to: document.getElementById("to"),
  btnQuery: document.getElementById("btnQuery"),
  btnPdf: document.getElementById("btnPdf"),
  btnPdfManager: document.getElementById("btnPdfManager"), 
  btnClear: document.getElementById("btnClear"),
  status: document.getElementById("status"),

  // KPIs
  kpiEvents: document.getElementById("kpiEvents"),
  kpiDays: document.getElementById("kpiDays"),
  kpiHeCalc: document.getElementById("kpiHeCalc"),
  kpiHePay: document.getElementById("kpiHePay"),
  kpiTxt: document.getElementById("kpiTxt"),
  kpiHeAmount: document.getElementById("kpiHeAmount"), // Nuevo KPI Monto
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
// Lógica de Ciclos
// =====================
function populateCycles() {
  const sel = el.cycle;
  sel.innerHTML = '<option value="manual">Rango manual</option>';

  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const endDate = new Date(now.getFullYear(), now.getMonth() - i, 15);
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 16);

    const sStr = startDate.toISOString().split("T")[0];
    const eStr = endDate.toISOString().split("T")[0];

    const opts = { month: 'short', year: 'numeric', day: 'numeric' };
    const label = `${startDate.toLocaleDateString('es-ES', opts)} → ${endDate.toLocaleDateString('es-ES', opts)}`;

    const opt = document.createElement("option");
    opt.value = `${sStr}|${eStr}`;
    opt.textContent = label;
    sel.appendChild(opt);
  }
}

// =====================
// Meta (empleados)
// =====================
async function loadMeta() {
  setStatus("Cargando empleados...", "");
  try {
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
  } catch(e) {
    setStatus("Error cargando empleados: " + e.message, "danger");
  }
}

// =====================
// Query (Consulta)
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
    
    // --- GUARDA DATOS GLOBALES PARA PDF ---
    currentData = q; 
    // --------------------------------------

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
// Render
// =====================
function renderKPIs(q) {
  const t = q.totals || {};
  
  el.kpiEvents.textContent = safeNum(t.total_events);
  el.kpiDays.textContent   = safeNum(t.total_days);
  el.kpiHeCalc.textContent = t.he_calc_hhmm || "00:00";
  el.kpiHePay.textContent  = t.he_paid_capped_hhmm || "00:00";
  el.kpiTxt.textContent    = t.txt_total_hhmm || "00:00";
  
  // Nuevo KPI Monto (Verificamos que el elemento exista en el HTML antes de escribir)
  if(el.kpiHeAmount) el.kpiHeAmount.textContent = money(t.he_amount_paid_capped || 0);

  el.kpiBen.textContent    = money(t.total_beneficios);
}

function renderTables(q) {
  const asistenciaCols = ["full_name","date","weekday","day_type","marks_count","first_in","last_out","work_span_hhmm","audit_flag","issues"];
  buildTable(el.headAsistencia, el.bodyAsistencia, asistenciaCols, q.asistencia || []);

  const heCols = ["full_name","date","day_type","first_in","last_out","he_calc_hhmm","he_payable_hhmm","txt_hhmm","rule_applied","catalog_match"];
  buildTable(el.headHE, el.bodyHE, heCols, q.he_daily || []);

  const benCols = ["full_name","date","day_type","alim_b","transp_b","benefits_b","benefits_rule","catalog_match_benef"];
  buildTable(el.headBEN, el.bodyBEN, benCols, q.beneficios || []);

  const cycCols = ["cycle","full_name","he_calc_total_hhmm","he_paid_capped_hhmm","txt_total_hhmm","he_amount_paid_capped","alim_total","transp_total","beneficios_total_usd"];
  buildTable(el.headCYC, el.bodyCYC, cycCols, q.resumen_ciclo || []);
}

function renderCharts(q) {
  const heRows = q.he_daily || [];
  const benRows = q.beneficios || [];
  const monthlyRows = q.resumen_ciclo || [];
  const dayTypes = ["LABORABLE","FIN_DE_SEMANA","FERIADO"];
  const sum = (arr, fn) => arr.reduce((a, r) => a + fn(r), 0);

  const heCalcBy = dayTypes.map(dt => sum(heRows.filter(r => r.day_type === dt), r => hhmmToHours(r.he_calc_hhmm)));
  const hePayBy  = dayTypes.map(dt => 0); 

  const ctx1 = document.getElementById("chartDayType").getContext("2d");
  if (chartDayType) chartDayType.destroy();
  chartDayType = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: dayTypes,
      datasets: [
        { label: "HE Calc (h)", data: heCalcBy },
        { label: "HE Pagable (h)", data: hePayBy }, 
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } }
    }
  });

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

  const byCycle = new Map();
  for (const r of monthlyRows) {
    const c = String(r.cycle || "");
    if (!c) continue;
    if (!byCycle.has(c)) byCycle.set(c, { hePaid: 0, txt: 0, heCalc: 0 });
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
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
    }
  });
}

// =====================
// Clear UI
// =====================
function clearUI() {
  currentData = null; // Limpiamos la variable global
  lastQueryData = null; // (Legacy)

  el.kpiEvents.textContent = "0";
  el.kpiDays.textContent = "0";
  el.kpiHeCalc.textContent = "00:00";
  el.kpiHePay.textContent = "00:00";
  el.kpiTxt.textContent = "00:00";
  if(el.kpiHeAmount) el.kpiHeAmount.textContent = "USD 0.00";
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

/* ======================================================
   GENERADOR DE PDF (FRONT-END) - VERSIÓN CORREGIDA (SUMAS)
   ====================================================== */
function printReport(type) {
  if (!currentData || !currentData.ok) {
    alert("Primero debes realizar una consulta (Consultar) para generar el PDF.");
    return;
  }

  const q = currentData;
  const p = q.params || {};
  const t = q.totals || {}; // Usamos esto para horas, pero para dinero recalculamos abajo para seguridad

  // LOGO
  const LOGO_URL = "./icons/icon-512.png"; 

  // Helpers
  const esc = s => String(s || "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
  const fmtMoney = v => "$ " + (Number(v) || 0).toFixed(2); // Formato seguro: $ 0.00

  // DATOS
  const rowsCiclo = (q.resumen_ciclo || []);
  const rowsAsistencia = (q.asistencia || []);
  const rowsHe = (q.he_daily || []);
  const rowsBen = (q.beneficios || []);

  // --- CALCULO DE TOTALES EN VIVO (Para asegurar que cuadren con la tabla) ---
  let sumHeMoney = 0;
  let sumBen = 0;
  let sumAlim = 0;
  let sumTransp = 0;

  rowsCiclo.forEach(r => {
    sumHeMoney += Number(r.he_amount_paid_capped) || 0;
    sumBen     += Number(r.beneficios_total) || 0;
    sumAlim    += Number(r.alim_total) || 0;
    sumTransp  += Number(r.transp_total) || 0;
  });
  // -------------------------------------------------------------------------

  // Gráfico de Pastel (QuickChart) con los totales calculados
  const chartUrl = `https://quickchart.io/chart?c={type:'pie',data:{labels:['Alimentación','Transporte'],datasets:[{data:[${sumAlim},${sumTransp}]}]},options:{plugins:{legend:{position:'right'},datalabels:{display:true,color:'white'}}}}`;

  const table = (title, cols, rows, labels) => {
    if (!rows.length) return "";
    const th = cols.map((c, i) => `<th>${labels[i]}</th>`).join("");
    const body = rows.map((r, i) => {
      const td = cols.map(c => `<td>${esc(r[c])}</td>`).join("");
      return `<tr class="${i%2===0?'even':'odd'}">${td}</tr>`;
    }).join("");
    return `<div class="section-title">${title}</div><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
  };

  // HTML
  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Reporte_${p.employee}</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10px; color: #333; margin: 0; -webkit-print-color-adjust: exact; }
      
      .header { background-color: #0b1f3a; color: white; padding: 15px; display: flex; align-items: center; border-bottom: 4px solid #bf9000; }
      .logo { width: 50px; height: 50px; margin-right: 15px; background: white; border-radius: 4px; padding: 2px; object-fit: contain; }
      .header-titles { flex: 1; }
      .main-title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
      .sub-title { font-size: 11px; opacity: 0.9; }
      .meta-info { text-align: right; font-size: 10px; color: #eee; }

      .rules-box { background: #f4f6f9; border-left: 5px solid #0b1f3a; padding: 10px; margin: 15px 0; font-size: 9px; display: flex; justify-content: space-between; }
      
      .kpi-container { display: flex; gap: 10px; margin-bottom: 20px; }
      .kpi-card { flex: 1; border: 1px solid #ccc; border-radius: 4px; padding: 8px; text-align: center; background: white; }
      .kpi-label { font-size: 8px; color: #666; font-weight: 700; text-transform: uppercase; }
      .kpi-val { font-size: 14px; font-weight: bold; color: #0b1f3a; }
      .highlight { color: #0a7a2f; }

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
        <div class="rules-title">Reglas de Pago Aplicadas</div>
        <div>1. <b>Laborables:</b> HE inician 15:30 (Condición: Salida ≥ 16:30).</div>
        <div>2. <b>Fines de Semana:</b> HE inician desde hora de Entrada.</div>
        <div>3. <b>Cierre de Ciclo:</b> Cap de <b>40 horas</b> pagadas. Excedente pasa a TXT (Bolsón).</div>
        <div style="margin-top:4px; border-top:1px dashed #ccc; padding-top:2px;">
           4. <b>Alimentación ($8.00):</b> Aplica en Dias Laborables si <b>Salida ≥ 19:00</b>. Fines de Semana según asistencia minimo 4 horas trabajadas.
           <br>5. <b>Transporte:</b> Monto variable según Tabla. Aplica si <b>Salida ≥ 18:00</b>.
        </div>
      </div>
      <div style="text-align:right; align-self:center;">
        <b>ESTATUS: AUDITABLE</b>
      </div>
    </div>
      <div style="text-align:right; align-self:center;">
        <b>ESTATUS: AUDITABLE</b>
      </div>
    </div>

    <div class="kpi-container">
      <div class="kpi-card"><div class="kpi-label">HE Calc</div><div class="kpi-val">${esc(t.he_calc_hhmm)}</div></div>
      <div class="kpi-card"><div class="kpi-label">HE Pagadas</div><div class="kpi-val">${esc(t.he_paid_capped_hhmm)}</div></div>
      <div class="kpi-card"><div class="kpi-label">TXT Bolsón</div><div class="kpi-val">${esc(t.txt_total_hhmm)}</div></div>
      
      <!-- USAMOS LAS VARIABLES SUMADAS A MANO -->
      <div class="kpi-card" style="border-color:#0a7a2f"><div class="kpi-label highlight">Monto HE</div><div class="kpi-val highlight">${fmtMoney(sumHeMoney)}</div></div>
      <div class="kpi-card" style="background:#f0f8ff"><div class="kpi-label">Beneficios (Alim+Transp)</div><div class="kpi-val">${fmtMoney(sumBen)}</div></div>
    </div>
    
    <!-- Gráfico (visible solo si hay beneficios) -->
    ${ sumBen > 0 ? `
    <div style="text-align:center; margin-bottom:15px; border:1px solid #eee; padding:10px; border-radius:5px;">
       <div style="font-size:9px; font-weight:bold; margin-bottom:5px; color:#555;">DISTRIBUCIÓN DE BENEFICIOS</div>
       <img src="${chartUrl}" style="max-height:120px;">
    </div>` : '' }

    ${table("Consolidado de Nómina por Ciclo",
      ["cycle","he_calc_total_hhmm","he_paid_capped_hhmm","txt_total_hhmm","he_amount_paid_capped","alim_total","transp_total","beneficios_total"],
      rowsCiclo,
      ["Ciclo","HE Calc","HE Pagada","TXT","Monto HE ($)","Alim ($)","Transp ($)","Total Ben ($)"]
    )}
  `;

  if (type === 'manager') {
    html += `<div class="footer">Reporte Gerencial - Resumen Ejecutivo</div></body></html>`;
  } else {
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

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 1000);
}

// =====================
// Init (EventListeners)
// =====================
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  
  // 1. Llenamos el combo de ciclos
  populateCycles(); 
  
  await loadMeta();

  el.btnQuery.addEventListener("click", doQuery);
  el.btnClear.addEventListener("click", clearUI);
  
  // Eventos de PDF (Usan la nueva función printReport)
  el.btnPdf.addEventListener("click", () => printReport('detail'));
  el.btnPdfManager.addEventListener("click", () => printReport('manager'));

  // 2. Lógica al cambiar el ciclo: Actualiza fechas automáticamente
  el.cycle.addEventListener("change", () => {
    const val = el.cycle.value;
    if (val === "manual") return;
    const [dFrom, dTo] = val.split("|");
    el.from.value = dFrom;
    el.to.value = dTo;
  });
  
  const setManual = () => { el.cycle.value = "manual"; };
  el.from.addEventListener("input", setManual);
  el.to.addEventListener("input", setManual);
});
