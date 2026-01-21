/******** CONFIG ********/
const API_URL = "https://script.google.com/macros/s/AKfycbxHZg8vPJ9ECi45nIdr4L3CMN3UTupgCr06ho9AQ5iLUx2e-m0RRc2Mfg020IQorIFv/exec";
const API_TOKEN = "RH_CSS_BIOMETRICO_2025_DINALOG_PRIVATE_TOKEN";

/******** HELPERS ********/
const qs = id => document.getElementById(id);

function setStatus(msg) {
  qs("status").textContent = msg;
}

function clearTable(headId, bodyId) {
  qs(headId).innerHTML = "";
  qs(bodyId).innerHTML = "";
}

function renderTable(headId, bodyId, rows) {
  clearTable(headId, bodyId);
  if (!rows || !rows.length) return;

  const headers = Object.keys(rows[0]);

  // header
  const trh = document.createElement("tr");
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    trh.appendChild(th);
  });
  qs(headId).appendChild(trh);

  // body
  rows.forEach(r => {
    const tr = document.createElement("tr");
    headers.forEach(h => {
      const td = document.createElement("td");
      td.textContent = (r[h] === null || r[h] === undefined) ? "" : r[h];
      tr.appendChild(td);
    });
    qs(bodyId).appendChild(tr);
  });
}

/******** INIT ********/
document.addEventListener("DOMContentLoaded", () => {
  loadEmployees();

  qs("btnBuscar").onclick = queryData;
  qs("btnPDF").onclick = exportPDF;

  // Defaults: últimos 30 días
  const now = new Date();
  const to = now.toISOString().slice(0,10);
  const fromDate = new Date(now.getTime() - 29*24*3600*1000);
  const from = fromDate.toISOString().slice(0,10);
  qs("from").value = from;
  qs("to").value = to;
});

/******** META ********/
async function loadEmployees() {
  try {
    const res = await fetch(`${API_URL}?action=meta&token=${API_TOKEN}`);
    const data = await res.json();

    if (!data.ok) {
      setStatus(data.error || "Error en META");
      return;
    }

    const sel = qs("employee");
    // limpiar options menos el primero
    while (sel.options.length > 1) sel.remove(1);

    data.employees.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e;
      opt.textContent = e;
      sel.appendChild(opt);
    });

    setStatus("Listo.");
  } catch (err) {
    setStatus("Error cargando empleados: " + err.message);
  }
}

/******** QUERY ********/
async function queryData() {
  try {
    setStatus("Consultando...");

    clearTable("asistenciaHead", "asistenciaBody");
    clearTable("heHead", "heBody");
    clearTable("benHead", "benBody");

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
      setStatus(data.error || "Error en QUERY");
      return;
    }

    const he = (data.heTxt && data.heTxt.totals) ? data.heTxt.totals : {};
    const ben = (data.benefits && data.benefits.totals) ? data.benefits.totals : {};

    const msg =
      `Eventos: ${data.totalEvents} | Días: ${data.asistencia.total} | ` +
      `HE Calc: ${he.total_he_calc_hours_hhmm || "00:00"} | ` +
      `HE Pag: ${he.total_he_payable_hours_hhmm || "00:00"} | ` +
      `TXT: ${he.total_txt_hours_hhmm || "00:00"} | ` +
      `Beneficios Total: ${ben.total_beneficios || 0}`;

    setStatus(msg);

    renderTable("asistenciaHead", "asistenciaBody", data.asistencia.rows || []);
    renderTable("heHead", "heBody", (data.heTxt && data.heTxt.rows) ? data.heTxt.rows : []);
    renderTable("benHead", "benBody", (data.benefits && data.benefits.rows) ? data.benefits.rows : []);

  } catch (err) {
    setStatus("Error consultando: " + err.message);
  }
}

/******** PDF ********/
function exportPDF() {
  const params = new URLSearchParams({
    action: "pdf",
    token: API_TOKEN,
    employee: qs("employee").value,
    from: qs("from").value,
    to: qs("to").value
  });

  window.open(`${API_URL}?${params.toString()}`, "_blank");
}
