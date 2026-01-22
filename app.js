/******** CONFIG ********/
const API_URL = "https://script.google.com/macros/s/AKfycbxHZg8vPJ9ECi45nIdr4L3CMN3UTupgCr06ho9AQ5iLUx2e-m0RRc2Mfg020IQorIFv/exec";
const API_TOKEN = "RH_CSS_BIOMETRICO_2025_DINALOG_PRIVATE_TOKEN";

/******** HELPERS ********/
const qs = id => document.getElementById(id);

function setStatus(msg) {
  qs("status").textContent = msg || "";
}

function clearTable(headId, bodyId) {
  qs(headId).innerHTML = "";
  qs(bodyId).innerHTML = "";
}

function renderTable(headId, bodyId, rows, columns) {
  clearTable(headId, bodyId);
  if (!rows || !rows.length) return;

  // Header
  columns.forEach(c => {
    const th = document.createElement("th");
    th.textContent = c;
    qs(headId).appendChild(th);
  });

  // Body
  rows.forEach(r => {
    const tr = document.createElement("tr");
    columns.forEach(c => {
      const td = document.createElement("td");
      td.textContent = (r[c] !== undefined && r[c] !== null) ? String(r[c]) : "";
      tr.appendChild(td);
    });
    qs(bodyId).appendChild(tr);
  });
}

function setKpis(totals) {
  const t = totals || {};
  qs("kpis").textContent =
    `Eventos: ${t.total_events || 0} | Días: ${t.total_days || 0} | ` +
    `HE Calc: ${t.he_calc_hhmm || "00:00"} | HE Pag: ${t.he_pay_hhmm || "00:00"} | ` +
    `TXT: ${t.txt_hhmm || "00:00"} | Beneficios Total: ${t.total_beneficios || 0}`;
}

/******** INIT ********/
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadEmployees();
  } catch (e) {
    setStatus("Error cargando empleados: " + e.message);
  }

  qs("btnBuscar").onclick = queryData;
  qs("btnPDF").onclick = exportPDF;
});

/******** META ********/
async function loadEmployees() {
  setStatus("Cargando empleados...");
  const res = await fetch(`${API_URL}?action=meta&token=${encodeURIComponent(API_TOKEN)}`);
  const data = await res.json();

  if (!data.ok) {
    setStatus(data.error || "Error en meta");
    return;
  }

  const sel = qs("employee");
  sel.innerHTML = "";
  (data.employees || ["TODOS"]).forEach(e => {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    sel.appendChild(opt);
  });

  setStatus("");
}

/******** QUERY ********/
async function queryData() {
  setStatus("Consultando...");
  setKpis({});

  clearTable("headAsistencia", "bodyAsistencia");
  clearTable("headHE", "bodyHE");
  clearTable("headBEN", "bodyBEN");

  const params = new URLSearchParams({
    action: "query",
    token: API_TOKEN,
    employee: qs("employee").value,
    from: qs("from").value,
    to: qs("to").value
  });

  const res = await fetch(`${API_URL}?${params.toString()}`);
  const data = await res.json();

  if (!data.ok) {
    setStatus(data.error || "Error en query");
    return;
  }

  setStatus("");
  setKpis(data.totals);

  // Asistencia
  const asistenciaCols = ["full_name","date","weekday","day_type","marks_count","first_in","last_out","work_span_hhmm","audit_flag","issues"];
  renderTable("headAsistencia", "bodyAsistencia", data.asistencia || [], asistenciaCols);

  // HE/TXT
  const heCols = ["full_name","date","day_type","first_in","last_out","he_calc_hhmm","he_payable_hhmm","txt_hhmm","rule_applied","catalog_match"];
  renderTable("headHE", "bodyHE", data.he_txt || [], heCols);

  // Beneficios
  const benCols = ["full_name","date","day_type","alim_b","transp_b","benefits_b","benefits_rule","catalog_match_benef"];
  renderTable("headBEN", "bodyBEN", data.beneficios || [], benCols);
}

/******** PDF ********/
async function exportPDF() {
  setStatus("Generando PDF...");

  const params = new URLSearchParams({
    action: "pdf",
    token: API_TOKEN,
    employee: qs("employee").value,
    from: qs("from").value,
    to: qs("to").value
  });

  const res = await fetch(`${API_URL}?${params.toString()}`);
  const data = await res.json();

  if (!data.ok) {
    setStatus(data.error || "Error generando PDF");
    return;
  }

  setStatus("");
  if (data.downloadUrl) {
    window.open(data.downloadUrl, "_blank");
  } else {
    setStatus("PDF generado pero no se recibió URL de descarga.");
  }
}
