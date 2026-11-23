// Vérification statique : tous les fichiers JavaScript sont analysés comme modules ES (acorn), les JSON sont validés. `npm run check`.
import { parse } from 'acorn';
import { readFileSync, readdirSync } from 'node:fs';
let bad = 0;
for (const f of readdirSync('.').filter(f => /\.(m?js)$/.test(f))) {
  try { parse(readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }); } catch (e) { bad++; console.error(`✗ ${f}:${e.loc?.line}:${e.loc?.column} ${e.message}`); }
}
for (const f of ['manifest.webmanifest', 'package.json']) try { JSON.parse(readFileSync(f, 'utf8')); } catch (e) { bad++; console.error(`✗ ${f}: ${e.message}`); }
if (bad) process.exit(1); console.log('✓ syntaxe valide pour tous les fichiers');
