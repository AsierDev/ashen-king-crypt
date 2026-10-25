// Partida automática de punta a punta contra el servidor de desarrollo, con capturas por escena.
// Uso: npm run dev (en otra terminal) && node scripts/playthrough.mjs <url> <carpeta-capturas> [fate|nofate]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:8080/?seed=1';
const outDir = process.argv[3] ?? 'playthrough';
const useFate = (process.argv[4] ?? 'fate') === 'fate';
mkdirSync(outDir, { recursive: true });

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
catch { browser = await chromium.launch({ headless: true }); }
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

const scene = () => page.evaluate(() => document.body.dataset.scene ?? '');
const seq = () => page.evaluate(() => Number(document.body.dataset.sceneSeq ?? '0'));
async function clickAt(x, y) {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + x * box.width / 640, box.y + y * box.height / 360);
}
let shot = 0;
const snap = async (name) => page.locator('canvas').screenshot({ path: `${outDir}/${String(++shot).padStart(3, '0')}-${name}.png` });

await page.goto(url);
await page.waitForFunction(() => document.body.dataset.scene === 'Title', null, { timeout: 15000 });
const log = [];
const started = Date.now();
let lastSeq = -1;
let combatTicks = 0;
while (Date.now() - started < 15 * 60 * 1000) {
  const s = await scene();
  const n = await seq();
  if (n !== lastSeq) {
    lastSeq = n;
    combatTicks = 0;
    await page.waitForTimeout(s === 'Narrative' ? 3500 : 800);
    await snap(s);
    log.push(s);
  }
  if (s === 'Title') await clickAt(320, 250);
  else if (s === 'Narrative') await clickAt(560, 320);
  else if (s === 'Interlude') await clickAt(320, 190);
  else if (s === 'End') break;
  else if (s === 'Combat') {
    combatTicks++;
    if (combatTicks % 25 === 0) await snap('Combat-turn');
    // Prompt de Destino (botón 1 = gastar, 2 = no), habilidad 1 y luego cualquier objetivo válido.
    if (!useFate) { await clickAt(472, 302); await page.waitForTimeout(150); }
    await clickAt(364, 302);
    await page.waitForTimeout(150);
    for (const x of [390, 460, 530, 600, 250, 180, 110]) await clickAt(x, 190);
  }
  await page.waitForTimeout(400);
}
const final = await scene();
await snap(`final-${final}`);
await browser.close();
console.log(JSON.stringify({ scenes: log, final, errors, seconds: Math.round((Date.now() - started) / 1000) }, null, 1));
