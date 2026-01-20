// 1) Pega aquí tu WebApp URL (Deployment)
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzc9VK7oeS8djC-lYXt5je7zMQY-vfGxrRrZdqDP2KGI0fRlSCHXmu88-kweBbO5JC7/exec"; // ejemplo: https://script.google.com/macros/s/XXXXX/exec

const $ = (id)=>document.getElementById(id);

async function api(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params });
  const url = `${WEBAPP_URL}?${qs.toString()}`;
  const res = await fetch(url, { method:"GET" });
  // PDF no se pide por aquí (se abre en nueva pestaña)
  return await res.json();
}

function setStatus(msg){ $("status").textContent = msg || ""; }
function setError(msg){ $("error").textContent = msg || ""; }

async function loadMeta() {
  setError("");
  setStatus("Cargando empleados...");
  const data = await api("meta");
  if (!data.ok) throw new Error(data.error || "Error meta");
  const sel = $("employee");
  // limpiar
  sel.innerHTML = `<option value="TODOS">TODOS</option>`;
  (data.employees || []).forEach(n=>{
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    sel.appendChild(opt);
  });
  setStatus(`Empleados cargados: ${(data.employees||[]).length}`);
}

function renderTable(rows) {
  const thead = $("thead");
  const tbody = $("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    $("meta").textContent = "Sin resultados";
    return;
  }

  const cols = Object.keys(rows[0]);

  const trh = document.createElement("tr");
  cols.forEach(c=>{
    const th = document.createElement("th");
    th.textContent = c;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  rows.forEach(r=>{
    const tr = document.createElement("tr");
    cols.forEach(c=>{
      const td = document.createElement("td");
      td.textContent = (r[c] ?? "");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function runQuery() {
  setError("");
  setStatus("Consultando...");
  $("btnPdf").disabled = true;

  const from = $("from").value;
  const to = $("to").value;
  const employee = $("employee").value || "TODOS";

  const data = await api("query", { from, to, employee, limit:"200", offset:"0" });
  if (!data.ok) throw new Error(data.error || "Error query");

  $("meta").textContent = `Total match: ${data.total} | Mostrando: ${data.rows.length} | Offset: ${data.offset}`;
  renderTable(data.rows);
  setStatus("Listo.");

  // habilita PDF si hay datos
  $("btnPdf").disabled = !(data.total > 0);
}

function openPdf() {
  const from = $("from").value;
  const to = $("to").value;
  const employee = $("employee").value || "TODOS";

  const qs = new URLSearchParams({ action:"pdf", from, to, employee });
  window.open(`${WEBAPP_URL}?${qs.toString()}`, "_blank");
}

document.addEventListener("DOMContentLoaded", async ()=>{
  $("btnQuery").addEventListener("click", ()=>runQuery().catch(e=>setError(e.message||String(e))));
  $("btnPdf").addEventListener("click", openPdf);
  loadMeta().catch(e=>setError(e.message||String(e)));
});
