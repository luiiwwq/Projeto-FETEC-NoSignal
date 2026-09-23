const fs = require('fs');
const full = __dirname + '/engine/GameEngine.js';
let s = fs.readFileSync(full, 'utf8');
const old = "from '../entities/Player.js?v=dash-3';";
const nw = "from '../entities/Player.js?v=dash-4';";
if (s.includes(old)) {
  s = s.replace(old, nw);
  fs.writeFileSync(full, s);
  console.log('APLICADO ?v=dash-4 (novo cache-bust)');
} else if (s.includes('?v=dash-4')) {
  console.log('JA tinha ?v=dash-4');
} else {
  const m = s.match(/from \.\.\/entities\/Player\.js[^;]*/g);
  console.log('formato inesperado:', m);
}
console.log('import atual:', s.match(/import \{ Player, PlayerState \}[^;]+;/)[0]);
