const fs = require("fs");
const c = fs.readFileSync("Login.jsx", "utf8");
const patterns = [
  { name: "e-dagger (apostrophe/em-dash mojibake)", regex: /\u00e2\u20ac/g },
  { name: "A-tilde-a (capital A tilde)",            regex: /\u00c3\u00a2/g },
  { name: "arrow mojibake",                         regex: /\u00e2\u2020/g },
];
let total = 0;
patterns.forEach(p => {
  const m = c.match(p.regex);
  if (m) {
    console.log("Found " + m.length + " instances of " + p.name);
    total += m.length;
  }
});
console.log("Total mojibake instances: " + total);
