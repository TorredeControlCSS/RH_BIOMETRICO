/******** CONFIG ********/
const API_URL = "https://script.google.com/macros/s/AKfycbxHZg8vPJ9ECi45nIdr4L3CMN3UTupgCr06ho9AQ5iLUx2e-m0RRc2Mfg020IQorIFv/exec";
const API_TOKEN = "EL_MISMO_TOKEN_DEL_CODE_GS";

/******** HELPERS ********/
const qs = id => document.getElementById(id);

/******** INIT ********/
document.addEventListener("DOMContentLoaded", () => {
  loadEmployees();
  qs("btnBuscar").onclick = queryData;
  qs("btnPDF").onclick = exportPDF;
});

/******** META ********/
async function loadEmployees() {
  const res = await fetch(`${API_URL}?action=meta&token=${API_TOKEN}`);
  const data = await res.json();

  if (!data.ok) {
    qs("status").textContent = data.error;
    return;
  }

  const sel = qs("employee");
  data.employees.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    sel.appendChild(opt);
  });
}

/******** QUERY ********/
async function queryData() {
  qs("status").textContent = "Consultando...";
  qs("tableBody").innerHTML = "";
  qs("tableHead").innerHTML = "";

  const params = new URLSearchParams({
    action: "query",
    token: API_TOKEN,
    employee: qs("employee").value,
    from: qs("from").value,
    to: qs("to").value,
    limit: 500
  });

  const res = await fetch(`${API_URL}?${params.toString()}`);
  const data = await res.json();

  if (!data.ok) {
    qs("status").textContent = data.error;
    return;
  }

  qs("status").textContent = `Registros encontrados: ${data.total}`;

  if (!data.rows.length) return;

  // Header
  Object.keys(data.rows[0]).forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    qs("tableHead").appendChild(th);
  });

  // Rows
  data.rows.forEach(r => {
    const tr = document.createElement("tr");
    Object.values(r).forEach(v => {
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    });
    qs("tableBody").appendChild(tr);
  });
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
