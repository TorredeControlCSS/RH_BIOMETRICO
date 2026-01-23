# Sample Excel File Template for RH Biométrico

This document describes the structure of the Excel file needed for the RH Biométrico system.

## Required Sheet: EVENTS_RAW

This sheet contains the biometric attendance events.

### Columns:

| Column Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| full_name | Text | Yes | Employee full name | Juan Perez |
| date | Date | Yes | Event date (YYYY-MM-DD) | 2025-01-20 |
| time | Text | Yes | Event time (HH:MM) | 08:30 |
| event_type | Text | No | Event type (IN/OUT) | IN |

### Alternative Column Names:
- `full_name` can also be `nombre` or `name`
- `date` can also be `fecha`
- `time` can also be `hora`
- `event_type` can also be `tipo`

### Sample Data:

```
full_name     | date       | time  | event_type
JUAN PEREZ    | 2025-01-20 | 08:00 | IN
JUAN PEREZ    | 2025-01-20 | 12:00 | OUT
JUAN PEREZ    | 2025-01-20 | 13:00 | IN
JUAN PEREZ    | 2025-01-20 | 17:30 | OUT
MARIA GARCIA  | 2025-01-20 | 08:15 | IN
MARIA GARCIA  | 2025-01-20 | 16:45 | OUT
CARLOS LOPEZ  | 2025-01-21 | 09:00 | IN
CARLOS LOPEZ  | 2025-01-21 | 18:00 | OUT
```

## Optional Sheet: NOMBRES_ALIAS

This sheet maps alternative names/aliases to standardized full names.

### Columns:

| Column Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| alias | Text | Yes | Name as it appears in biometric system | juan |
| full_name | Text | Yes | Standardized full name | JUAN PEREZ |

### Sample Data:

```
alias      | full_name
juan       | JUAN PEREZ
j.perez    | JUAN PEREZ
jperez     | JUAN PEREZ
maria      | MARIA GARCIA
m.garcia   | MARIA GARCIA
carlos     | CARLOS LOPEZ
```

## Optional Sheet: CALC_HE_TXT_BEN

This sheet defines calculation rules for each employee.

### Columns:

| Column Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| full_name | Text | Yes | Employee full name (must match EVENTS_RAW) | JUAN PEREZ |
| calc_he | Boolean | Yes | Calculate overtime hours (true/false, Sí/No, Yes/No) | true |
| calc_txt | Boolean | Yes | Calculate TXT hours (true/false, Sí/No, Yes/No) | true |
| calc_benefits | Boolean | Yes | Calculate benefits (true/false, Sí/No, Yes/No) | true |

### Sample Data:

```
full_name    | calc_he | calc_txt | calc_benefits
JUAN PEREZ   | true    | true     | true
MARIA GARCIA | true    | true     | true
CARLOS LOPEZ | true    | true     | false
```

### Notes:
- If this sheet is missing, all employees will have all calculations enabled by default
- Boolean values can be: `true`/`false`, `Yes`/`No`, `Sí`/`No`, `1`/`0`
- Setting `false` or `No` disables that calculation for the employee

## Creating the Template

### Using Excel:
1. Create a new Excel workbook
2. Rename Sheet1 to "EVENTS_RAW"
3. Add column headers: `full_name`, `date`, `time`, `event_type`
4. Create a new sheet called "NOMBRES_ALIAS" (optional)
5. Add column headers: `alias`, `full_name`
6. Create a new sheet called "CALC_HE_TXT_BEN" (optional)
7. Add column headers: `full_name`, `calc_he`, `calc_txt`, `calc_benefits`
8. Save as `.xlsx` format

### Using Google Sheets:
1. Create a new spreadsheet
2. Follow the same sheet and column structure as above
3. Download as "Microsoft Excel (.xlsx)"

## Tips

- Keep employee names consistent across all sheets
- Use UPPERCASE for standardized names
- Dates must be in YYYY-MM-DD format or valid Excel date format
- Times must be in 24-hour format (HH:MM)
- Make sure each employee has an even number of IN/OUT events per day
- Sheet names are case-sensitive: use exactly "EVENTS_RAW", "NOMBRES_ALIAS", "CALC_HE_TXT_BEN"

## Common Issues

**"No se encontró hoja 'EVENTS_RAW'"**
- Check sheet name spelling (case-sensitive)
- The system will use the first sheet if EVENTS_RAW is not found

**"Marcas impares" warning**
- Employee has odd number of events on a day
- Check for missing IN or OUT events

**No data appears after upload**
- Check that date and time columns have valid values
- Ensure full_name column is not empty
- Verify Excel file is not corrupted

## Example File

You can download a sample Excel file with all three sheets properly configured:
- Generate sample data using `test_calculations.js`
- Or create your own following the structure above
