// Smoke de ejecución: sirve dist/ con vite preview y lo abre en Chrome headless.
// Uso: npm run build && npm run smoke -- <Escena>
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const mode = process.argv[2] ?? 'Combat';
const server = await preview({ configFile: false, root: process.cwd(), preview: { port: 4173, strictPort: true }, build: { outDir: 'dist' } });
let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
catch { browser = await chromium.launch({ headless: true }); }
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

async function waitScene(key, afterSeq = 0) {
  await page.waitForFunction(([k, n]) => document.body.dataset.scene === k && Number(document.body.dataset.sceneSeq ?? '0') > n, [key, afterSeq], { timeout: 10000 });
}
async function run() {
  await page.goto('http://localhost:4173/?seed=1');
  await waitScene(mode);
  await page.waitForTimeout(3000); // deja correr la iniciativa y los primeros turnos
}
let ok = false;
try { await run(); ok = errors.length === 0 && (await page.locator('canvas').count()) === 1; }
catch (e) { errors.push(String(e)); }
await browser.close();
await new Promise((r) => server.httpServer.close(r));
if (!ok) { console.error('SMOKE FAIL\n' + errors.join('\n')); process.exit(1); }
console.log(`SMOKE OK (${mode}): sin errores de página`);
