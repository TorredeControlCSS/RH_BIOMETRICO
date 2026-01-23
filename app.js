/******** CONSTANTS - Ported from code.gs ********/

// Pay rules for overtime calculation
const PAY_RULES = {
  WEEKDAY_THRESHOLD_TIME: "16:30",  // After this time on weekdays = overtime
  WEEKDAY_THRESHOLD_MINUTES: 990,   // 16:30 in minutes (16*60 + 30)
  WEEKEND_ALL_OVERTIME: true,        // All hours on weekends = overtime
  HOLIDAY_ALL_OVERTIME: true         // All hours on holidays = overtime
};

// Benefits rules
const BENEFITS_RULES = {
  MIN_HOURS_FOR_FOOD: 4,             // Minimum hours worked to get food benefit
  MIN_HOURS_FOR_TRANSPORT: 4,        // Minimum hours worked to get transport benefit
  FOOD_BENEFIT_AMOUNT: 15000,        // COP
  TRANSPORT_BENEFIT_AMOUNT: 8000     // COP
};

// Colombian holidays (2025 example - should be updated yearly)
const HOLIDAYS = [
  "2025-01-01", // Año Nuevo
  "2025-01-06", // Reyes Magos
  "2025-03-24", // San José
  "2025-04-17", // Jueves Santo
  "2025-04-18", // Viernes Santo
  "2025-05-01", // Día del Trabajo
  "2025-06-02", // Ascensión
  "2025-06-23", // Corpus Christi
  "2025-06-30", // Sagrado Corazón
  "2025-07-07", // San Pedro y San Pablo
  "2025-07-20", // Día de la Independencia
  "2025-08-07", // Batalla de Boyacá
  "2025-08-18", // Asunción
  "2025-10-13", // Día de la Raza
  "2025-11-03", // Todos los Santos
  "2025-11-17", // Independencia de Cartagena
  "2025-12-08", // Inmaculada Concepción
  "2025-12-25", // Navidad
  // 2026
  "2026-01-01",
  "2026-01-12",
  "2026-03-23",
  "2026-04-02",
  "2026-04-03",
  "2026-05-01",
  "2026-05-18",
  "2026-06-08",
  "2026-06-15",
  "2026-06-29",
  "2026-07-20",
  "2026-08-07",
  "2026-08-17",
  "2026-10-12",
  "2026-11-02",
  "2026-11-16",
  "2026-12-08",
  "2026-12-25"
];

/******** GLOBAL DATA ********/
let rawEventsData = [];
let aliasMap = {};
let employeeRulesMap = {};
let processedData = {
  asistencia: [],
  he_txt: [],
  beneficios: [],
  totals: {}
};

/******** HELPER FUNCTIONS - Ported from code.gs ********/

// Convert minutes to HH:MM format
function toHMS(minutes) {
  if (!minutes || minutes <= 0) return "00:00";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Convert HH:MM to minutes
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

// Get short weekday name (Lun, Mar, etc.)
function weekdayShort(dateStr) {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const d = new Date(dateStr + 'T12:00:00');
  return days[d.getDay()];
}

// Check if date is a holiday
function isHoliday(dateStr) {
  return HOLIDAYS.includes(dateStr);
}

// Get day type: "Festivo", "Fin de semana", or "Laboral"
function getDayType(dateStr) {
  if (isHoliday(dateStr)) return "Festivo";
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return "Fin de semana";
  return "Laboral";
}

// Normalize name (remove extra spaces, uppercase)
function normalizeName(name) {
  if (!name) return "";
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
}

// Round to N decimals
function roundN(value, decimals = 2) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Convert decimal hours to HH:MM
function hoursToHHMM(hours) {
  if (!hours || hours <= 0) return "00:00";
  const totalMinutes = Math.round(hours * 60);
  return toHMS(totalMinutes);
}

/******** FILE UPLOAD HANDLER ********/
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Check if XLSX library is loaded
  if (typeof XLSX === 'undefined') {
    setStatus("Error: La librería SheetJS no está cargada. Por favor, recargue la página con conexión a Internet.");
    return;
  }

  setStatus("Cargando archivo...");

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      // Try to find specific sheets, or use defaults
      let eventsSheet, aliasSheet, rulesSheet;

      // Find EVENTS_RAW sheet or use first sheet
      if (workbook.SheetNames.includes('EVENTS_RAW')) {
        eventsSheet = workbook.Sheets['EVENTS_RAW'];
      } else {
        setStatus("Advertencia: No se encontró hoja 'EVENTS_RAW', usando primera hoja");
        eventsSheet = workbook.Sheets[workbook.SheetNames[0]];
      }

      // Find NOMBRES_ALIAS sheet (optional)
      if (workbook.SheetNames.includes('NOMBRES_ALIAS')) {
        aliasSheet = workbook.Sheets['NOMBRES_ALIAS'];
      } else {
        console.warn("No se encontró hoja 'NOMBRES_ALIAS'");
      }

      // Find CALC_HE_TXT_BEN sheet (optional)
      if (workbook.SheetNames.includes('CALC_HE_TXT_BEN')) {
        rulesSheet = workbook.Sheets['CALC_HE_TXT_BEN'];
      } else {
        console.warn("No se encontró hoja 'CALC_HE_TXT_BEN'");
      }

      // Parse sheets
      rawEventsData = XLSX.utils.sheet_to_json(eventsSheet);
      
      if (aliasSheet) {
        const aliasData = XLSX.utils.sheet_to_json(aliasSheet);
        aliasMap = {};
        aliasData.forEach(row => {
          if (row.alias && row.full_name) {
            aliasMap[normalizeName(row.alias)] = normalizeName(row.full_name);
          }
        });
      }

      if (rulesSheet) {
        const rulesData = XLSX.utils.sheet_to_json(rulesSheet);
        employeeRulesMap = {};
        rulesData.forEach(row => {
          if (row.full_name) {
            employeeRulesMap[normalizeName(row.full_name)] = {
              calc_he: row.calc_he !== false && row.calc_he !== 'No',
              calc_txt: row.calc_txt !== false && row.calc_txt !== 'No',
              calc_benefits: row.calc_benefits !== false && row.calc_benefits !== 'No'
            };
          }
        });
      }

      setStatus(`Archivo cargado: ${rawEventsData.length} eventos encontrados`);
      
      // Process the data
      processAllData();
      
      // Populate employee dropdown
      populateEmployeeDropdown();

    } catch (err) {
      setStatus("Error al leer archivo: " + err.message);
      console.error(err);
    }
  };

  reader.onerror = function() {
    setStatus("Error al leer archivo");
  };

  reader.readAsArrayBuffer(file);
}

/******** CORE DATA PROCESSING ********/

function processAllData() {
  if (!rawEventsData || rawEventsData.length === 0) {
    setStatus("No hay datos para procesar");
    return;
  }

  setStatus("Procesando datos...");

  // Normalize and enrich raw events
  const events = rawEventsData.map(e => {
    let fullName = e.full_name || e.nombre || e.name || "";
    
    // Apply alias mapping
    const normalized = normalizeName(fullName);
    if (aliasMap[normalized]) {
      fullName = aliasMap[normalized];
    } else {
      fullName = normalized;
    }

    // Parse date and time
    let eventDate = e.date || e.fecha || "";
    let eventTime = e.time || e.hora || "";
    
    // Handle Excel date serial numbers
    if (typeof eventDate === 'number') {
      eventDate = XLSX.SSF.format('yyyy-mm-dd', eventDate);
    } else if (eventDate) {
      // Try to parse and format
      const d = new Date(eventDate);
      if (!isNaN(d)) {
        eventDate = d.toISOString().split('T')[0];
      }
    }

    return {
      full_name: fullName,
      date: eventDate,
      time: eventTime,
      event_type: e.event_type || e.tipo || "IN/OUT"
    };
  }).filter(e => e.full_name && e.date && e.time);

  // Build asistencia diaria
  const asistencia = buildAsistenciaDiaria(events);
  
  // Build HE/TXT
  const heTxt = buildHorasExtraTxt(asistencia);
  
  // Build Benefits
  const beneficios = buildBenefits(asistencia);

  // Calculate totals
  const totals = calculateTotals(asistencia, heTxt, beneficios);

  processedData = {
    asistencia,
    he_txt: heTxt,
    beneficios,
    totals
  };

  setStatus("Datos procesados correctamente");
}

function buildAsistenciaDiaria(events) {
  // Group events by employee and date
  const grouped = {};
  
  events.forEach(e => {
    const key = `${e.full_name}|${e.date}`;
    if (!grouped[key]) {
      grouped[key] = {
        full_name: e.full_name,
        date: e.date,
        weekday: weekdayShort(e.date),
        day_type: getDayType(e.date),
        events: []
      };
    }
    grouped[key].events.push(e);
  });

  // Calculate first in, last out, work span for each day
  const result = [];
  
  Object.values(grouped).forEach(day => {
    const times = day.events.map(e => e.time).filter(t => t).sort();
    
    const firstIn = times[0] || "";
    const lastOut = times[times.length - 1] || "";
    
    let workSpanMinutes = 0;
    if (firstIn && lastOut) {
      const firstMinutes = timeToMinutes(firstIn);
      const lastMinutes = timeToMinutes(lastOut);
      workSpanMinutes = lastMinutes - firstMinutes;
    }
    
    const marksCount = times.length;
    let auditFlag = "";
    let issues = "";
    
    // Audit: check for odd number of marks
    if (marksCount % 2 !== 0) {
      auditFlag = "⚠";
      issues = "Marcas impares";
    }
    
    result.push({
      full_name: day.full_name,
      date: day.date,
      weekday: day.weekday,
      day_type: day.day_type,
      marks_count: marksCount,
      first_in: firstIn,
      last_out: lastOut,
      work_span_hhmm: toHMS(workSpanMinutes),
      work_span_minutes: workSpanMinutes,
      audit_flag: auditFlag,
      issues: issues
    });
  });

  // Sort by date and name
  result.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.full_name.localeCompare(b.full_name);
  });

  return result;
}

function buildHorasExtraTxt(asistencia) {
  const result = [];

  asistencia.forEach(day => {
    const rules = employeeRulesMap[day.full_name] || {
      calc_he: true,
      calc_txt: true,
      calc_benefits: true
    };

    let heCalcMinutes = 0;
    let hePayableMinutes = 0;
    let txtMinutes = 0;
    let ruleApplied = "";
    let catalogMatch = rules.calc_he || rules.calc_txt ? "Sí" : "No";

    // Only calculate if employee has calc_he or calc_txt enabled
    if (rules.calc_he || rules.calc_txt) {
      const dayType = day.day_type;
      
      if (dayType === "Laboral") {
        // Weekday: overtime after 16:30
        const lastOutMinutes = timeToMinutes(day.last_out);
        
        if (lastOutMinutes > PAY_RULES.WEEKDAY_THRESHOLD_MINUTES) {
          heCalcMinutes = lastOutMinutes - PAY_RULES.WEEKDAY_THRESHOLD_MINUTES;
          hePayableMinutes = heCalcMinutes;
          ruleApplied = "Laboral > 16:30";
        } else {
          ruleApplied = "Laboral ≤ 16:30";
        }
      } else if (dayType === "Fin de semana" || dayType === "Festivo") {
        // Weekend/Holiday: all hours are overtime
        heCalcMinutes = day.work_span_minutes;
        
        if (dayType === "Festivo") {
          hePayableMinutes = heCalcMinutes;
          txtMinutes = heCalcMinutes; // TXT also applies on holidays
          ruleApplied = "Festivo (HE + TXT)";
        } else {
          hePayableMinutes = heCalcMinutes;
          ruleApplied = "Fin de semana (HE)";
        }
      }
    } else {
      ruleApplied = "Sin cálculo";
      catalogMatch = "No";
    }

    result.push({
      full_name: day.full_name,
      date: day.date,
      day_type: day.day_type,
      first_in: day.first_in,
      last_out: day.last_out,
      he_calc_hhmm: toHMS(heCalcMinutes),
      he_calc_minutes: heCalcMinutes,
      he_payable_hhmm: toHMS(hePayableMinutes),
      he_payable_minutes: hePayableMinutes,
      txt_hhmm: toHMS(txtMinutes),
      txt_minutes: txtMinutes,
      rule_applied: ruleApplied,
      catalog_match: catalogMatch
    });
  });

  return result;
}

function buildBenefits(asistencia) {
  const result = [];

  asistencia.forEach(day => {
    const rules = employeeRulesMap[day.full_name] || {
      calc_he: true,
      calc_txt: true,
      calc_benefits: true
    };

    let alimB = 0;
    let transpB = 0;
    let benefitsRule = "";
    let catalogMatch = rules.calc_benefits ? "Sí" : "No";

    if (rules.calc_benefits) {
      const workHours = day.work_span_minutes / 60;
      
      if (day.day_type === "Laboral") {
        // Only on working days
        if (workHours >= BENEFITS_RULES.MIN_HOURS_FOR_FOOD) {
          alimB = BENEFITS_RULES.FOOD_BENEFIT_AMOUNT;
        }
        if (workHours >= BENEFITS_RULES.MIN_HOURS_FOR_TRANSPORT) {
          transpB = BENEFITS_RULES.TRANSPORT_BENEFIT_AMOUNT;
        }
        
        if (alimB > 0 || transpB > 0) {
          benefitsRule = `≥${BENEFITS_RULES.MIN_HOURS_FOR_FOOD}h trabajadas`;
        } else {
          benefitsRule = `<${BENEFITS_RULES.MIN_HOURS_FOR_FOOD}h trabajadas`;
        }
      } else {
        benefitsRule = "No aplica (no laboral)";
      }
    } else {
      benefitsRule = "Sin beneficios";
      catalogMatch = "No";
    }

    result.push({
      full_name: day.full_name,
      date: day.date,
      day_type: day.day_type,
      alim_b: alimB,
      transp_b: transpB,
      benefits_b: alimB + transpB,
      benefits_rule: benefitsRule,
      catalog_match_benef: catalogMatch
    });
  });

  return result;
}

function calculateTotals(asistencia, heTxt, beneficios) {
  const totalEvents = rawEventsData.length;
  const totalDays = asistencia.length;
  
  let heCalcMinutes = 0;
  let hePayMinutes = 0;
  let txtMinutes = 0;
  
  heTxt.forEach(row => {
    heCalcMinutes += row.he_calc_minutes || 0;
    hePayMinutes += row.he_payable_minutes || 0;
    txtMinutes += row.txt_minutes || 0;
  });
  
  let totalBeneficios = 0;
  beneficios.forEach(row => {
    totalBeneficios += row.benefits_b || 0;
  });

  return {
    total_events: totalEvents,
    total_days: totalDays,
    he_calc_hhmm: toHMS(heCalcMinutes),
    he_pay_hhmm: toHMS(hePayMinutes),
    txt_hhmm: toHMS(txtMinutes),
    total_beneficios: totalBeneficios
  };
}

/******** UI HELPERS ********/
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

function populateEmployeeDropdown() {
  // Get unique employee names from processed data
  const employees = new Set();
  processedData.asistencia.forEach(row => {
    if (row.full_name) employees.add(row.full_name);
  });

  const sel = qs("employee");
  sel.innerHTML = '<option value="TODOS">TODOS</option>';
  
  Array.from(employees).sort().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

/******** QUERY (FILTER) ********/
function queryData() {
  if (!processedData.asistencia || processedData.asistencia.length === 0) {
    setStatus("No hay datos cargados. Por favor, cargue un archivo Excel primero.");
    return;
  }

  setStatus("Filtrando datos...");
  setKpis({});

  clearTable("headAsistencia", "bodyAsistencia");
  clearTable("headHE", "bodyHE");
  clearTable("headBEN", "bodyBEN");

  const employee = qs("employee").value;
  const fromDate = qs("from").value;
  const toDate = qs("to").value;

  // Filter function
  const filterRow = (row) => {
    if (employee !== "TODOS" && row.full_name !== employee) return false;
    if (fromDate && row.date < fromDate) return false;
    if (toDate && row.date > toDate) return false;
    return true;
  };

  // Filter all datasets
  const filteredAsistencia = processedData.asistencia.filter(filterRow);
  const filteredHE = processedData.he_txt.filter(filterRow);
  const filteredBen = processedData.beneficios.filter(filterRow);

  // Recalculate totals for filtered data
  const filteredTotals = calculateTotals(filteredAsistencia, filteredHE, filteredBen);
  filteredTotals.total_events = filteredAsistencia.reduce((sum, row) => sum + (row.marks_count || 0), 0);

  setStatus("");
  setKpis(filteredTotals);

  // Asistencia
  const asistenciaCols = ["full_name","date","weekday","day_type","marks_count","first_in","last_out","work_span_hhmm","audit_flag","issues"];
  renderTable("headAsistencia", "bodyAsistencia", filteredAsistencia, asistenciaCols);

  // HE/TXT
  const heCols = ["full_name","date","day_type","first_in","last_out","he_calc_hhmm","he_payable_hhmm","txt_hhmm","rule_applied","catalog_match"];
  renderTable("headHE", "bodyHE", filteredHE, heCols);

  // Beneficios
  const benCols = ["full_name","date","day_type","alim_b","transp_b","benefits_b","benefits_rule","catalog_match_benef"];
  renderTable("headBEN", "bodyBEN", filteredBen, benCols);
}

/******** PDF EXPORT ********/
async function exportPDF() {
  // Check if html2pdf library is loaded
  if (typeof html2pdf === 'undefined') {
    setStatus("Error: La librería html2pdf no está cargada. Por favor, recargue la página con conexión a Internet.");
    return;
  }

  setStatus("Generando PDF...");

  const element = document.body;
  const opt = {
    margin: 10,
    filename: 'RH_Biometrico_Report.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  try {
    await html2pdf().set(opt).from(element).save();
    setStatus("PDF generado correctamente");
  } catch (err) {
    setStatus("Error generando PDF: " + err.message);
    console.error(err);
  }
}

/******** INITIALIZATION ********/
document.addEventListener("DOMContentLoaded", () => {
  // Set up event listeners
  qs("fileUpload").addEventListener("change", handleFileUpload);
  qs("btnBuscar").onclick = queryData;
  qs("btnPDF").onclick = exportPDF;

  setStatus("Listo. Por favor, cargue un archivo Excel para comenzar.");
});
