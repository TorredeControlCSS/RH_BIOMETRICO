#!/usr/bin/env node
/**
 * Test script to verify calculation logic
 * Run with: node test_calculations.js
 */

// Import helper functions from app.js logic
function toHMS(minutes) {
  if (!minutes || minutes <= 0) return "00:00";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function getDayType(dateStr) {
  const HOLIDAYS = ["2025-01-01", "2025-01-06"]; // Sample holidays (New Year, Epiphany)
  if (HOLIDAYS.includes(dateStr)) return "Festivo";
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return "Fin de semana";
  return "Laboral";
}

const PAY_RULES = {
  WEEKDAY_THRESHOLD_MINUTES: 990, // 16:30
};

const BENEFITS_RULES = {
  MIN_HOURS_FOR_FOOD: 4,
  MIN_HOURS_FOR_TRANSPORT: 4,
  FOOD_BENEFIT_AMOUNT: 15000,
  TRANSPORT_BENEFIT_AMOUNT: 8000
};

// Test cases
const testCases = [
  {
    name: "Normal weekday - no overtime",
    date: "2025-01-20", // Monday
    firstIn: "08:00",
    lastOut: "16:00",
    expected: {
      dayType: "Laboral",
      workMinutes: 480,
      heMinutes: 0,
      txtMinutes: 0,
      foodBenefit: 15000,
      transpBenefit: 8000
    }
  },
  {
    name: "Weekday with overtime",
    date: "2025-01-20", // Monday
    firstIn: "08:00",
    lastOut: "18:00", // 6pm
    expected: {
      dayType: "Laboral",
      workMinutes: 600,
      heMinutes: 90, // 18:00 - 16:30 = 1.5 hours
      txtMinutes: 0,
      foodBenefit: 15000,
      transpBenefit: 8000
    }
  },
  {
    name: "Weekend work",
    date: "2025-01-25", // Saturday
    firstIn: "09:00",
    lastOut: "15:00",
    expected: {
      dayType: "Fin de semana",
      workMinutes: 360,
      heMinutes: 360, // All hours are overtime
      txtMinutes: 0,
      foodBenefit: 0, // No benefits on weekends
      transpBenefit: 0
    }
  },
  {
    name: "Holiday work",
    date: "2025-01-01", // New Year
    firstIn: "10:00",
    lastOut: "16:00",
    expected: {
      dayType: "Festivo",
      workMinutes: 360,
      heMinutes: 360, // All hours are overtime
      txtMinutes: 360, // TXT also applies on holidays
      foodBenefit: 0, // No benefits on holidays
      transpBenefit: 0
    }
  },
  {
    name: "Short shift - no benefits",
    date: "2025-01-20",
    firstIn: "14:00",
    lastOut: "16:00",
    expected: {
      dayType: "Laboral",
      workMinutes: 120,
      heMinutes: 0,
      txtMinutes: 0,
      foodBenefit: 0, // < 4 hours
      transpBenefit: 0
    }
  }
];

console.log("🧪 Testing RH Biométrico Calculation Logic\n");
console.log("=" .repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  console.log(`\nTest ${index + 1}: ${test.name}`);
  console.log("-".repeat(80));
  
  const dayType = getDayType(test.date);
  const firstInMinutes = timeToMinutes(test.firstIn);
  const lastOutMinutes = timeToMinutes(test.lastOut);
  const workMinutes = lastOutMinutes - firstInMinutes;
  
  let heMinutes = 0;
  let txtMinutes = 0;
  
  if (dayType === "Laboral") {
    if (lastOutMinutes > PAY_RULES.WEEKDAY_THRESHOLD_MINUTES) {
      heMinutes = lastOutMinutes - PAY_RULES.WEEKDAY_THRESHOLD_MINUTES;
    }
  } else if (dayType === "Fin de semana") {
    heMinutes = workMinutes;
  } else if (dayType === "Festivo") {
    heMinutes = workMinutes;
    txtMinutes = workMinutes;
  }
  
  const workHours = workMinutes / 60;
  let foodBenefit = 0;
  let transpBenefit = 0;
  
  if (dayType === "Laboral") {
    if (workHours >= BENEFITS_RULES.MIN_HOURS_FOR_FOOD) {
      foodBenefit = BENEFITS_RULES.FOOD_BENEFIT_AMOUNT;
    }
    if (workHours >= BENEFITS_RULES.MIN_HOURS_FOR_TRANSPORT) {
      transpBenefit = BENEFITS_RULES.TRANSPORT_BENEFIT_AMOUNT;
    }
  }
  
  // Verify results
  const results = {
    dayType,
    workMinutes,
    heMinutes,
    txtMinutes,
    foodBenefit,
    transpBenefit
  };
  
  console.log(`  Date: ${test.date} (${dayType})`);
  console.log(`  Work hours: ${test.firstIn} - ${test.lastOut} = ${toHMS(workMinutes)}`);
  console.log(`  Overtime (HE): ${toHMS(heMinutes)}`);
  console.log(`  TXT: ${toHMS(txtMinutes)}`);
  console.log(`  Benefits: Food=$${foodBenefit}, Transport=$${transpBenefit}`);
  
  // Check if test passed
  const testPassed = 
    results.dayType === test.expected.dayType &&
    results.workMinutes === test.expected.workMinutes &&
    results.heMinutes === test.expected.heMinutes &&
    results.txtMinutes === test.expected.txtMinutes &&
    results.foodBenefit === test.expected.foodBenefit &&
    results.transpBenefit === test.expected.transpBenefit;
  
  if (testPassed) {
    console.log(`  ✅ PASSED`);
    passed++;
  } else {
    console.log(`  ❌ FAILED`);
    console.log(`  Expected:`, test.expected);
    console.log(`  Got:`, results);
    failed++;
  }
});

console.log("\n" + "=".repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log("✅ All tests passed!\n");
  process.exit(0);
} else {
  console.log("❌ Some tests failed\n");
  process.exit(1);
}
