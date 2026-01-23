/*******************************************************
 * RH BIOMÉTRICO – FRONTEND (GitHub Pages)
 * Consume Apps Script Web App:
 *  ?action=meta&token=...
 *  ?action=query&token=...&employee=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *  ?action=pdf&token=...&employee=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *******************************************************/

const API_BASE =
  "https://script.google.com/macros/s/AKfycbxHZg8vPJ9ECi45nIdr4L3CMN3UTupgCr06ho9AQ5iLUx2e-m0RRc2Mfg020IQorIFv/exec";

const qs = (id) => document.getElementById(id);

function setStatus(msg) {
  qs("status").textContent = msg || "";
}

function setKpis(totals) {
  const t = totals || {};
  qs("kpis").textContent =
    `Eventos: ${t.total_events || 0} | Días: ${t.total_days || 0} | ` +
    `HE Calc: ${t.he_calc_hhmm || "00:00"} | HE Pag: ${t.he_pay_hhmm || "00:00"} | ` +
    `TXT: ${t.txt_hhmm || "00:00"} | Beneficios Total: ${t.total_beneficios || 0}`;
}

function clearTable(headId, bodyId) {
  qs(headId).innerHTML = "";
  qs(bodyId).innerHTML = "";
}

function renderTable(headId, bodyId, rows, columns) {
  clearTable(headId, bodyId);
  if (!rows || !rows.length) return;

  // Header
  for (const c of columns) {
    const th = document.createElement("th");
    th.textContent = c;
    qs(headId).appendChild(th);
  }

  // Body
  for (const r of rows) {
    const tr = document.createElement("tr");
    for (const c of columns) {
      const td = document.createElement("td");
      const v = r[c];
      td.textContent = (v === undefined || v === null) ? "" : String(v);
      tr.appendChild(td);
    }
    qs(bodyId).appendChild(tr);
  }
}

function getTokenOrThrow() {
  const token = (qs("token").value || "").trim();
  if (!token) throw new Error("Falta el token. Pégalo en el campo Token.");
  return token;
}

function validateDates(from, to) {
  // Permitimos vacío; pero si ambos existen, validamos orden
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error("Fecha 'Desde' inválida.");
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("Fecha 'Hasta' inválida.");
  if (from && to && from > to) throw new Error("'Desde' no puede ser mayor que 'Hasta'.");
}

async function fetchJson(paramsObj) {
  const url = new URL(API_BASE);
  const p = new URLSearchParams(paramsObj);
  url.search = p.toString();

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });

  // Apps Script a veces devuelve 200 con texto; intentamos parse robusto
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("Respuesta no es JSON. Revisa despliegue de la Web App y permisos.");
  }

  if (!data || data.ok !== true) {
    const msg = (data && data.error) ? data.error : "Error desconocido en backend.";
    throw new Error(msg);
  }

  return data;
}

async function cargarEmpleados() {
  try {
    setStatus("Cargando empleados...");
    setKpis({});
    clearAllTables();

    const token = getTokenOrThrow();
    const data = await fetchJson({ action: "meta", token });

    const sel = qs("employee");
    sel.innerHTML = "";
    for (const name of (data.employees || ["TODOS"])) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    }

    setStatus(`Empleados cargados: ${(data.employees || []).length}`);
  } catch (err) {
    setStatus("Error: " + (err && err.message ? err.message : String(err)));
  }
}

function clearAllTables() {
  clearTable("headAsistencia", "bodyAsistencia");
  clearTable("headHE", "bodyHE");
  clearTable("headBEN", "bodyBEN");
}

async function buscar() {
  try {
    setStatus("Consultando backend...");
    setKpis({});
    clearAllTables();

    const token = getTokenOrThrow();
    const employee = (qs("employee").value || "TODOS").trim();
    const from = (qs("from").value || "").trim();
    const to = (qs("to").value || "").trim();
    validateDates(from, to);

    const data = await fetchJson({
      action: "query",
      token,
      employee,
      from,
      to
    });

    setKpis(data.totals);

    // Render Asistencia
    const asistenciaCols = [
      "full_name","date","weekday","day_type","marks_count",
      "first_in","last_out","work_span_hhmm","audit_flag","issues"
    ];
    renderTable("headAsistencia", "bodyAsistencia", data.asistencia || [], asistenciaCols);

    // Render HE/TXT
    const heCols = [
      "full_name","date","day_type","first_in","last_out",
      "he_calc_hhmm","he_payable_hhmm","txt_hhmm","rule_applied","catalog_match"
    ];
    renderTable("headHE", "bodyHE", data.he_txt || [], heCols);

    // Render Beneficios
    const benCols = [
      "full_name","date","day_type",
      "alim_b","transp_b","benefits_b","benefits_rule","catalog_match_benef"
    ];
    renderTable("headBEN", "bodyBEN", data.beneficios || [], benCols);

    setStatus("");
  } catch (err) {
    setStatus("Error: " + (err && err.message ? err.message : String(err)));
  }
}

async function generarPdf() {
  try {
    setStatus("Generando PDF en Drive...");
    const token = getTokenOrThrow();

    const employee = (qs("employee").value || "TODOS").trim();
    const from = (qs("from").value || "").trim();
    const to = (qs("to").value || "").trim();
    validateDates(from, to);

    const data = await fetchJson({
      action: "pdf",
      token,
      employee,
      from,
      to
    });

    setStatus("PDF generado. Abriendo enlace...");
    // Abre el downloadUrl
    if (data.downloadUrl) window.open(data.downloadUrl, "_blank");
    else setStatus("PDF generado, pero backend no devolvió downloadUrl.");
  } catch (err) {
    setStatus("Error: " + (err && err.message ? err.message : String(err)));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  qs("btnCargarEmpleados").onclick = cargarEmpleados;
  qs("btnBuscar").onclick = buscar;
  qs("btnPDF").onclick = generarPdf;

  setStatus("Listo. Pega el token y presiona 'Cargar empleados'.");
});
