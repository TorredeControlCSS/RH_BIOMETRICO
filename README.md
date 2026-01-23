# RH Biométrico - Dashboard Histórico

Sistema de análisis de asistencia y control biométrico completamente offline. Procesa archivos Excel localmente sin necesidad de conexión a servidor.

## 🚀 Características

- **100% Offline**: Toda la lógica de procesamiento se ejecuta en el navegador
- **Sin Backend**: No requiere servidor ni Google Apps Script
- **Análisis Completo**: Calcula asistencia diaria, horas extra, TXT y beneficios
- **Exportación PDF**: Genera reportes en formato PDF directamente desde el navegador
- **Flexible**: Soporta múltiples hojas de Excel con configuración opcional

## 📋 Requisitos

- Navegador web moderno (Chrome, Firefox, Edge, Safari)
- Archivo Excel (.xlsx o .xls) con los datos de eventos biométricos

## 🗂️ Formato del Archivo Excel

El sistema busca las siguientes hojas en el archivo Excel:

### 1. EVENTS_RAW (Obligatoria)

Contiene los eventos de entrada/salida del sistema biométrico.

**Columnas requeridas:**
- `full_name` o `nombre` o `name`: Nombre del empleado
- `date` o `fecha`: Fecha del evento (formato YYYY-MM-DD o fecha de Excel)
- `time` o `hora`: Hora del evento (formato HH:MM)
- `event_type` o `tipo`: Tipo de evento (opcional, ej: "IN", "OUT")

**Ejemplo:**
```
full_name     | date       | time  | event_type
Juan Perez    | 2025-01-20 | 08:00 | IN
Juan Perez    | 2025-01-20 | 17:30 | OUT
Maria Garcia  | 2025-01-20 | 08:15 | IN
Maria Garcia  | 2025-01-20 | 16:45 | OUT
```

### 2. NOMBRES_ALIAS (Opcional)

Mapea alias a nombres completos para normalización.

**Columnas:**
- `alias`: Nombre como aparece en el sistema biométrico
- `full_name`: Nombre normalizado

**Ejemplo:**
```
alias    | full_name
juan     | JUAN PEREZ
j.perez  | JUAN PEREZ
maria    | MARIA GARCIA
```

### 3. CALC_HE_TXT_BEN (Opcional)

Define reglas específicas por empleado.

**Columnas:**
- `full_name`: Nombre del empleado
- `calc_he`: Calcular horas extra (true/false o Sí/No)
- `calc_txt`: Calcular tiempo extra trabajado (true/false o Sí/No)
- `calc_benefits`: Calcular beneficios (true/false o Sí/No)

**Ejemplo:**
```
full_name    | calc_he | calc_txt | calc_benefits
JUAN PEREZ   | true    | true     | true
MARIA GARCIA | true    | true     | false
CARLOS LOPEZ | false   | false    | false
```

## 🎯 Cómo Usar

1. **Abrir la aplicación**: Abre `index.html` en tu navegador web
2. **Cargar archivo**: Haz clic en "Archivo Excel" y selecciona tu archivo .xlsx o .xls
3. **Esperar procesamiento**: El sistema procesará automáticamente los datos
4. **Filtrar** (opcional):
   - Selecciona un empleado específico o "TODOS"
   - Establece rango de fechas (Desde/Hasta)
   - Haz clic en "Buscar" para aplicar filtros
5. **Exportar**: Haz clic en "Exportar PDF" para generar un reporte

## 📊 Salidas del Sistema

### Asistencia Diaria
- Nombre completo
- Fecha y día de la semana
- Tipo de día (Laboral, Fin de semana, Festivo)
- Número de marcas
- Primera entrada y última salida
- Tiempo trabajado
- Banderas de auditoría

### Horas Extra + TXT
- Cálculo de horas extra según reglas:
  - **Días laborales**: Horas después de 16:30
  - **Fines de semana**: Todas las horas trabajadas
  - **Festivos**: Todas las horas trabajadas + TXT
- Horas calculadas vs. horas pagables
- Regla aplicada

### Beneficios
- Alimentación: $15,000 COP si trabaja ≥4 horas
- Transporte: $8,000 COP si trabaja ≥4 horas
- Solo aplica en días laborales

## ⚙️ Configuración

### Constantes en `app.js`

Puedes modificar las siguientes constantes según tus necesidades:

```javascript
// Reglas de pago
const PAY_RULES = {
  WEEKDAY_THRESHOLD_TIME: "16:30",  // Hora límite para HE en días laborales
  WEEKDAY_THRESHOLD_MINUTES: 990,   // 16:30 en minutos
  WEEKEND_ALL_OVERTIME: true,       // Fin de semana todo es HE
  HOLIDAY_ALL_OVERTIME: true        // Festivos todo es HE
};

// Reglas de beneficios
const BENEFITS_RULES = {
  MIN_HOURS_FOR_FOOD: 4,            // Horas mínimas para alimentación
  MIN_HOURS_FOR_TRANSPORT: 4,       // Horas mínimas para transporte
  FOOD_BENEFIT_AMOUNT: 15000,       // Monto alimentación (COP)
  TRANSPORT_BENEFIT_AMOUNT: 8000    // Monto transporte (COP)
};

// Festivos (actualizar anualmente)
const HOLIDAYS = [
  "2025-01-01", // Año Nuevo
  "2025-01-06", // Reyes Magos
  // ... agregar más fechas
];
```

## 🔧 Tecnologías Utilizadas

- **SheetJS (xlsx)**: Lectura de archivos Excel en el navegador
- **html2pdf.js**: Generación de PDFs del lado del cliente
- **JavaScript Vanilla**: Sin frameworks, máxima compatibilidad

## 🐛 Solución de Problemas

### "La librería SheetJS no está cargada"
- Asegúrate de tener conexión a Internet la primera vez que abres la aplicación
- Los CDNs necesitan descargarse inicialmente
- Una vez cargados, el navegador los cachea para uso offline

### "No se encontró hoja 'EVENTS_RAW'"
- Verifica que tu archivo Excel tenga una hoja llamada exactamente `EVENTS_RAW`
- Si no existe, el sistema usará la primera hoja del archivo

### "Marcas impares"
- Indica que un empleado tiene un número impar de entradas/salidas
- Revisa los datos del empleado para ese día específico

### No se calculan beneficios/HE
- Verifica que la hoja `CALC_HE_TXT_BEN` tenga configurado el empleado
- Si falta la hoja, todos los empleados tendrán cálculo habilitado por defecto

## 📝 Notas Importantes

1. **Privacidad**: Todos los datos se procesan localmente en tu navegador. Ningún dato se envía a servidores externos.
2. **Rendimiento**: El sistema puede procesar miles de eventos eficientemente en navegadores modernos.
3. **Compatibilidad**: Funciona en todos los navegadores modernos (Chrome, Firefox, Edge, Safari).
4. **Actualización de Festivos**: Recuerda actualizar la lista de festivos anualmente en `app.js`.

## 🤝 Contribuciones

Para reportar problemas o sugerir mejoras:
1. Abre un Issue en el repositorio
2. Describe claramente el problema o mejora
3. Si es posible, incluye un archivo Excel de ejemplo (sin datos sensibles)

## 📄 Licencia

© 2025 Torre de Control CSS / DINALOG

---

**Versión**: 2.0 (Cliente-side)  
**Última actualización**: Enero 2025
