/******** CONFIG ********/
const API_URL = "https://script.google.com/macros/s/AKfycbxHZg8vPJ9ECi45nIdr4L3CMN3UTupgCr06ho9AQ5iLUx2e-m0RRc2Mfg020IQorIFv/exec";
const API_TOKEN = "RH_CSS_BIOMETRICO_2025_DINALOG_PRIVATE_TOKEN";

/******** HELPERS ********/
const qs = (id) => document.getElementById(id);

function setStatus(msg) {
  const el = qs("status");
  if (el) el.textContent = msg || "";
}

function valOrEmpty(id) {
  const el = qs(id);
  return el ? String(el.value || "").trim() : "";
}

function ensureContainers() {
  // KPI
  if (!qs("kpiBox")) {
    const box = document.createElement("div");
    box.id = "kpiBox";
    box.style.margin = "10px 0";
    box.style.padding = "10px";
    box.style.border = "1px solid #ddd";
    box.style.background = "#fafafa";
    const anchor = qs("status")?.parentElement || document.body;
    anchor.insertBefore(box, anchor.firstChild);
  }

  // Secciones de tablas
  const sections = [
    { id: "tblAsistencia", title: "Asistencia diaria" },
    { id: "tblHeTxt", title: "Horas Extra + TXT" },
    { id: "tblBenefits", title: "Beneficios (Alimentación + Transporte)" }
  ];

  const root = qs("tablesRoot") || document.body;

  sections.forEach((s) => {
    if (!qs(s.id)) {
      const wrap = document.createElement("div");
      wrap.style.marginTop = "14px";

      const h = document.createElement("h3");
      h.textContent = s.title;

      const table = document.createElement("table");
      table.id = s.id;
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";

      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      trh.id = `${s.id}Head`;
      thead.appendChild(trh);

      const tbody = document.createElement("tbody");
      tbody.id = `${s.id}Body`;

      table.appendChild(thead);
      table.appendChild(tbody);

      wrap.appendChild(h);
      wrap.appendChild(table);
      root.appendChild(wrap);
    }
  });
}

function clearTable(tableId) {
  const head = qs(`${tableId}Head`);
  const body = qs(`${tableId}Body`);
  if (head) head.innerHTML = "";
  if (body) body.innerHTML = "";
}

function renderTable(tableId, rows, columnOrder = null, maxRows = 3000) {
  clearTable(tableId);

  const head = qs(`${tableId}Head`);
  const body = qs(`${tableId}Body`);

  if (!head || !body) return;
  if (!rows || !rows.length) return;

  const cols = columnOrder && columnOrder.length ? columnOrder : Object.keys(rows[0]);

  // Header
  cols.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c;
    th.style.border = "1px solid #ddd";
    th.style.padding = "4px 6px";
    th.style.background = "#f3f3f3";
    head.appendChild(th);
  });

  // Rows
  const take = Math.min(rows.length, maxRows);
  for (let i = 0; i < take; i++) {
    const r = rows[i];
    const tr = document.createElement("tr");
    cols.forEach((c) => {
      const td = document.createElement("td");
      td.textContent = (r[c] === null || r[c] === undefined) ? "" : String(r[c]);
      td.style.border = "1px solid #ddd";
      td.style.padding = "4px 6px";
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
}

function renderKpis(data) {
  const box = qs("kpiBox");
  if (!box) return;

  const he = data.heTxtTotals || {};
  const ben = data.benefitsTotals || {};
  const filters = data.filters || {};

  box.innerHTML = `
    <div><b>Empleado:</b> ${filters.employee || ""}</div>
    <div><b>Rango:</b> ${filters.from || "—"} a ${filters.to || "—"}</div>
    <div style="margin-top:8px;">
      <b>Total eventos:</b> ${data.totalEvents ?? 0} |
      <b>Días asistencia:</b> ${(data.asistenciaTotals && data.asistenciaTotals.total) ? data.asistenciaTotals.total : (data.asistenciaRows ? data.asistenciaRows.length : 0)}
    </div>
    <div style="margin-top:6px;">
      <b>HE calc:</b> ${he.total_he_calc_hours_hhmm || "00:00"} (${he.total_he_calc_hours || 0}) |
      <b>HE pagable:</b> ${he.total_he_payable_hours_hhmm || "00:00"} (${he.total_he_payable_hours || 0}) |
      <b>TXT:</b> ${he.total_txt_hours_hhmm || "00:00"} (${he.total_txt_hours || 0})
    </div>
    <div style="margin-top:6px;">
      <b>Beneficios:</b> ${ben.total_beneficios || 0} |
      <b>Alimentación:</b> ${ben.total_alimentacion || 0} |
      <b>Transporte:</b> ${ben.total_transporte || 0}
    </div>
  `;
}

/******** INIT ********/
document.addEventListener("DOMContentLoaded", () => {
  ensureContainers();
  loadEmployees();

  const btnBuscar = qs("btnBuscar");
  const btnPDF = qs("btnPDF");

  if (btnBuscar) btnBuscar.onclick = queryAnalytics;
  if (btnPDF) btnPDF.onclick = exportPDF;
});

/******** META ********/
async function loadEmployees() {
  try {
    setStatus("Cargando empleados...");

    const res = await fetch(`${API_URL}?action=meta&token=${encodeURIComponent(API_TOKEN)}`);
    const data = await res.json();

    if (!data.ok) {
      setStatus(data.error || "Error en meta");
      return;
    }

    const sel = qs("employee");
    if (!sel) return;

    // limpiar (dejando la primera opción si existe)
    const keepFirst = sel.options.length ? sel.options[0] : null;
    sel.innerHTML = "";
    if (keepFirst) sel.appendChild(keepFirst);

    data.employees.forEach((e) => {
      const opt = document.createElement("option");
      opt.value = e;
      opt.textContent = e;
      sel.appendChild(opt);
    });

    // opcional: set placeholders fecha si existen inputs
    if (qs("from") && data.minDate && !qs("from").value) qs("from").value = data.minDate;
    if (qs("to") && data.maxDate && !qs("to").value) qs("to").value = data.maxDate;

    setStatus("Listo.");
  } catch (err) {
    setStatus(err.message || String(err));
  }
}

/******** ANALYTICS ********/
async function queryAnalytics() {
  try {
    setStatus("Calculando analítica...");

    // limpiar tablas
    ["tblAsistencia", "tblHeTxt", "tblBenefits"].forEach(clearTable);
    if (qs("kpiBox")) qs("kpiBox").innerHTML = "";

    const params = new URLSearchParams({
      action: "analytics",
      token: API_TOKEN,
      employee: valOrEmpty("employee") || "TODOS",
      from: valOrEmpty("from"),
      to: valOrEmpty("to")
    });

    const res = await fetch(`${API_URL}?${params.toString()}`);
    const data = await res.json();

    if (!data.ok) {
      setStatus(data.error || "Error en analytics");
      return;
    }

    // KPIs
    renderKpis(data);

    // Tablas
    renderTable("tblAsistencia", data.asistenciaRows || [], [
      "user_id","full_name","date","weekday","day_type","holiday_name",
      "marks_count","first_in","last_out","work_span_hhmm","mark_type","audit_flag","issues"
    ]);

    renderTable("tblHeTxt", data.heTxtRows || [], [
      "user_id","full_name","date","weekday","day_type","first_in","last_out","work_span_hhmm",
      "he_calc_hhmm","he_payable_hhmm","txt_hhmm","applies_he_paid","applies_txt","rule_applied","catalog_match","audit_flag"
    ]);

    renderTable("tblBenefits", data.benefitsRows || [], [
      "user_id","full_name","date","weekday","day_type",
      "he_payable_hhmm","txt_hhmm",
      "alim_b","transp_b","benefits_b","benefits_rule","catalog_match_benef","audit_flag"
    ]);

    setStatus(`Listo. Eventos: ${data.totalEvents}. Días: ${(data.asistenciaRows || []).length}.`);

  } catch (err) {
    setStatus(err.message || String(err));
  }
}

/******** PDF ********/
async function exportPDF() {
  try {
    setStatus("Generando PDF...");

    const params = new URLSearchParams({
      action: "pdf",
      token: API_TOKEN,
      employee: valOrEmpty("employee") || "TODOS",
      from: valOrEmpty("from"),
      to: valOrEmpty("to")
    });

    const res = await fetch(`${API_URL}?${params.toString()}`);
    const data = await res.json();

    if (!data.ok) {
      setStatus(data.error || "Error generando PDF");
      return;
    }

    if (!data.pdfUrl) {
      setStatus("PDF generado, pero no se recibió pdfUrl.");
      return;
    }

    setStatus("PDF listo.");
    window.open(data.pdfUrl, "_blank");

  } catch (err) {
    setStatus(err.message || String(err));
  }
}
