const fs = require("fs");
const target = "App.jsx";

// Backup
const backup = target + ".bak-" + Date.now();
fs.copyFileSync(target, backup);
console.log("[OK] Backup: " + backup);

let content = fs.readFileSync(target, "utf8");
let patches = 0;

// Patch 1: Fix the lowercase import path (Linux compatibility)
const oldImport = "import Login      from './pages/login';";
const newImport = "import Login      from './pages/Login';\nimport SignupPage from './pages/SignupPage';";

if (content.indexOf("SignupPage") >= 0) {
  console.log("[SKIP] SignupPage import already present");
} else if (content.indexOf(oldImport) >= 0) {
  content = content.replace(oldImport, newImport);
  console.log("[OK] Patch 1: Added SignupPage import + fixed Login filename case");
  patches++;
} else {
  console.error("[ERROR] Could not find Login import line");
  process.exit(1);
}

// Patch 2: Add /signup route after /login
const oldRouteRe = /(<Route path="\/login"\s+element=\{<Login \/>\} \/>)/;
const routeMatch = content.match(oldRouteRe);

if (content.indexOf('path="/signup"') >= 0) {
  console.log("[SKIP] /signup route already present");
} else if (routeMatch) {
  content = content.replace(oldRouteRe, routeMatch[1] + '\n        <Route path="/signup"     element={<SignupPage />} />');
  console.log("[OK] Patch 2: Added /signup route");
  patches++;
} else {
  console.error("[ERROR] Could not find /login Route line");
  process.exit(1);
}

fs.writeFileSync(target, content, "utf8");
console.log("");
console.log("Summary: " + patches + " patches applied");
console.log("");
console.log("Verification:");
const final = fs.readFileSync(target, "utf8");
console.log("  Has SignupPage import:   " + (final.indexOf("import SignupPage") >= 0 ? "YES" : "NO"));
console.log("  Has /signup route:       " + (final.indexOf('path="/signup"') >= 0 ? "YES" : "NO"));
console.log("  Login import uses capital L: " + (final.indexOf("from './pages/Login'") >= 0 ? "YES (good)" : "NO (still lowercase)"));
