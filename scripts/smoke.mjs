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
const seq = () => page.evaluate(() => Number(document.body.dataset.sceneSeq ?? '0'));
async function clickAt(x, y) {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + x * box.width / 640, box.y + y * box.height / 360);
}
async function run() {
  await page.goto('http://localhost:4173/?seed=1');
  if (mode !== 'flow') { await waitScene(mode); await page.waitForTimeout(3000); return; }
  await waitScene('Title');
  let n = await seq(); await clickAt(320, 250);
  await waitScene('Narrative', n); await page.waitForTimeout(2500);
  n = await seq(); await clickAt(560, 320);
  await waitScene('Narrative', n); await page.waitForTimeout(2500);
  n = await seq(); await clickAt(560, 320);
  await waitScene('Combat', n); await page.waitForTimeout(3000);
}
let ok = false;
try { await run(); ok = errors.length === 0 && (await page.locator('canvas').count()) === 1; }
catch (e) { errors.push(String(e)); }
await browser.close();
await new Promise((r) => server.httpServer.close(r));
if (!ok) { console.error('SMOKE FAIL\n' + errors.join('\n')); process.exit(1); }
console.log(`SMOKE OK (${mode}): sin errores de página`);
