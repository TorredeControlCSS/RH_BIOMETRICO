/******** CONFIG ********/
const API_URL = "https://script.google.com/macros/s/AKfycbxHZg8vPJ9ECi45nIdr4L3CMN3UTupgCr06ho9AQ5iLUx2e-m0RRc2Mfg020IQorIFv/exec";
const API_TOKEN = "RH_CSS_BIOMETRICO_2025_DINALOG_PRIVATE_TOKEN";

/******** HELPERS ********/
const qs = (id) => document.getElementById(id);

function setStatus(msg) {
  qs("status").textContent = msg || "";
}

function setSummary(t) {
  const s = t || {};
  qs("summary").textContent =
    `Eventos: ${s.events_count || 0} | ` +
    `Días: ${s.days_count || 0} | ` +
    `HE Calc: ${s.he_calc_hhmm || "00:00"} | ` +
    `HE Pag: ${s.he_pay_hhmm || "00:00"} | ` +
    `TXT: ${s.txt_hhmm || "00:00"} | ` +
    `Beneficios Total: ${s.benefits_total || 0}`;
}

function clearTables() {
  qs("asistHead").innerHTML = "";
  qs("asistBody").innerHTML = "";
  qs("heHead").innerHTML = "";
  qs("heBody").innerHTML = "";
  qs("benHead").innerHTML = "";
  qs("benBody").innerHTML = "";
}

function renderTable(headId, bodyId, columns, rows) {
  const head = qs(headId);
  const body = qs(bodyId);

  head.innerHTML = "";
  body.innerHTML = "";

  // headers
  columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col.label;
    head.appendChild(th);
  });

  // rows
  if (!rows || rows.length === 0) return;

  rows.forEach(r => {
    const tr = document.createElement("tr");
    columns.forEach(col => {
      const td = document.createElement("td");
      const v = (r && r[col.key] != null) ? r[col.key] : "";
      td.textContent = v;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

/******** INIT ********/
document.addEventListener("DOMContentLoaded", () => {
  loadEmployees();

  // Default: rango último mes si quieres (si no, lo dejas vacío)
  // const today = new Date();
  // const prior = new Date(today.getTime() - 30*24*3600*1000);
  // qs("from").value = prior.toISOString().slice(0,10);
  // qs("to").value = today.toISOString().slice(0,10);

  qs("btnBuscar").onclick = queryData;
  qs("btnPDF").onclick = exportPDF;
});

/******** META ********/
async function loadEmployees() {
  try {
    setStatus("Cargando empleados...");
    const res = await fetch(`${API_URL}?action=meta&token=${encodeURIComponent(API_TOKEN)}`);
    const data = await res.json();

    if (!data.ok) {
      setStatus(data.error || "Error meta");
      return;
    }

    const sel = qs("employee");
    // dejar "TODOS" y agregar el resto
    data.employees.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e;
      opt.textContent = e;
      sel.appendChild(opt);
    });

    setStatus("");
  } catch (e) {
    setStatus("Error cargando empleados: " + (e.message || e));
  }
}

/******** QUERY ********/
async function queryData() {
  try {
    setStatus("Consultando...");
    setSummary(null);
    clearTables();

    const params = new URLSearchParams({
      action: "query",
      token: API_TOKEN,
      employee: qs("employee").value || "TODOS",
      from: qs("from").value || "",
      to: qs("to").value || ""
    });

    const res = await fetch(`${API_URL}?${params.toString()}`);
    const data = await res.json();

    if (!data.ok) {
      setStatus(data.error || "Error query");
      return;
    }

    setStatus("");
    setSummary(data.totals);

    // Asistencia
    renderTable(
      "asistHead",
      "asistBody",
      [
        { key: "full_name", label: "Empleado" },
        { key: "date", label: "Fecha" },
        { key: "weekday", label: "Día" },
        { key: "day_type", label: "Tipo" },
        { key: "marks_count", label: "Marcas" },
        { key: "first_in", label: "Entrada" },
        { key: "last_out", label: "Salida" },
        { key: "work_span_hhmm", label: "Rango" },
        { key: "audit_flag", label: "Auditoría" },
        { key: "issues", label: "Observación" }
      ],
      data.asistencia || []
    );

    // HE/TXT
    renderTable(
      "heHead",
      "heBody",
      [
        { key: "full_name", label: "Empleado" },
        { key: "date", label: "Fecha" },
        { key: "day_type", label: "Tipo" },
        { key: "first_in", label: "Entrada" },
        { key: "last_out", label: "Salida" },
        { key: "he_calc_hhmm", label: "HE Calc" },
        { key: "he_payable_hhmm", label: "HE Pag" },
        { key: "txt_hhmm", label: "TXT" },
        { key: "rule_applied", label: "Regla" },
        { key: "catalog_match", label: "Catálogo" }
      ],
      data.he_txt || []
    );

    // Beneficios
    renderTable(
      "benHead",
      "benBody",
      [
        { key: "full_name", label: "Empleado" },
        { key: "date", label: "Fecha" },
        { key: "alim_b", label: "Alimentación" },
        { key: "transp_b", label: "Transporte" },
        { key: "benefits_b", label: "Total" },
        { key: "benefits_rule", label: "Regla" }
      ],
      data.beneficios || []
    );

  } catch (e) {
    setStatus("Error query: " + (e.message || e));
  }
}

/******** PDF ********/
async function exportPDF() {
  try {
    setStatus("Generando PDF...");
    const params = new URLSearchParams({
      action: "pdf",
      token: API_TOKEN,
      employee: qs("employee").value || "TODOS",
      from: qs("from").value || "",
      to: qs("to").value || ""
    });

    const res = await fetch(`${API_URL}?${params.toString()}`);
    const data = await res.json();

    if (!data.ok) {
      setStatus(data.error || "Error PDF");
      return;
    }

    setStatus("");
    // Abrir link del PDF en Drive
    window.open(data.url, "_blank");

  } catch (e) {
    setStatus("Error PDF: " + (e.message || e));
  }
}
