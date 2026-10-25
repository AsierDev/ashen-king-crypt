import { BlendModes } from 'phaser';
import type { Scene } from 'phaser';
import { LAYOUT } from './theme';

export const BG_KEY = 'bg-crypt';
const ASH_KEY = 'fx-ash';
const GLOW_KEY = 'fx-glow';

const PILLAR_XS = [40, 320, 600];
const TORCH_Y = 112;

// Ruido determinista para que el fondo sea idéntico en cada partida.
function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function shade(base: number, delta: number): number {
    const c = (shift: number) => Math.max(0, Math.min(255, ((base >> shift) & 0xff) + delta));
    return (c(16) << 16) | (c(8) << 8) | c(0);
}

/** Genera una vez las texturas del fondo de cripta y de los efectos (no hay PNG de fondo). */
export function ensureCryptTextures(scene: Scene): void {
    if (scene.textures.exists(BG_KEY)) return;
    const w = LAYOUT.width;
    const h = LAYOUT.panelY;
    const rand = lcg(7);
    const g = scene.add.graphics();

    // Muro de ladrillo, más oscuro hacia el techo.
    const brickW = 32;
    const brickH = 12;
    for (let row = 0; row * brickH < LAYOUT.groundY; row++) {
        const y = row * brickH;
        const depth = Math.round((1 - y / LAYOUT.groundY) * -10);
        for (let x = -(row % 2) * (brickW / 2); x < w; x += brickW) {
            g.fillStyle(shade(0x231d2b, depth + Math.round(rand() * 8 - 4)));
            g.fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
        }
    }

    // Arcos oscuros entre columnas.
    for (let i = 0; i < PILLAR_XS.length - 1; i++) {
        const cx = (PILLAR_XS[i] + PILLAR_XS[i + 1]) / 2;
        g.fillStyle(0x0e0b13);
        g.fillRect(cx - 70, 70, 140, LAYOUT.groundY - 70);
        g.fillCircle(cx, 70, 70);
        g.fillStyle(0x15111b);
        g.fillRect(cx - 56, 84, 112, LAYOUT.groundY - 84);
        g.fillCircle(cx, 84, 56);
    }

    // Columnas con capitel y basa.
    for (const px of PILLAR_XS) {
        g.fillStyle(0x2e2738);
        g.fillRect(px - 14, 0, 28, LAYOUT.groundY);
        g.fillStyle(0x3a3246);
        g.fillRect(px - 14, 0, 6, LAYOUT.groundY);
        g.fillStyle(0x1f1a27);
        g.fillRect(px + 8, 0, 6, LAYOUT.groundY);
        g.fillStyle(0x3a3246);
        g.fillRect(px - 20, 56, 40, 8);
        g.fillRect(px - 20, LAYOUT.groundY - 10, 40, 10);
        // Soporte de la antorcha.
        g.fillStyle(0x4a3a2a);
        g.fillRect(px - 3, TORCH_Y, 6, 14);
        g.fillRect(px - 6, TORCH_Y - 2, 12, 4);
    }

    // Suelo de losas.
    const floorH = h - LAYOUT.groundY;
    g.fillStyle(0x1b1622);
    g.fillRect(0, LAYOUT.groundY, w, floorH);
    for (let x = 0; x < w; x += 40) {
        g.fillStyle(shade(0x221c2a, Math.round(rand() * 10 - 5)));
        g.fillRect(x + 1, LAYOUT.groundY + 2, 38, floorH - 3);
    }
    g.fillStyle(0x0b0a10);
    g.fillRect(0, LAYOUT.groundY, w, 2);

    g.generateTexture(BG_KEY, w, h);
    g.clear();

    g.fillStyle(0xbfb6a8);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture(ASH_KEY, 2, 2);
    g.clear();

    for (let r = 24; r > 0; r -= 2) {
        g.fillStyle(0xffa040, 0.05);
        g.fillCircle(24, 24, r);
    }
    g.generateTexture(GLOW_KEY, 48, 48);
    g.destroy();
}

/** Fondo de cripta con antorchas que parpadean y ceniza cayendo. */
export function addCryptBackground(scene: Scene, dim = 0): void {
    ensureCryptTextures(scene);
    scene.add.image(0, 0, BG_KEY).setOrigin(0);

    for (const [i, px] of PILLAR_XS.entries()) {
        const glow = scene.add.image(px, TORCH_Y - 6, GLOW_KEY).setBlendMode(BlendModes.ADD).setAlpha(0.8);
        const flame = scene.add.ellipse(px, TORCH_Y - 6, 6, 10, 0xffb347);
        const core = scene.add.ellipse(px, TORCH_Y - 4, 3, 5, 0xfff1c1);
        scene.tweens.add({
            targets: [glow, flame, core],
            alpha: { from: 0.65, to: 1 },
            duration: 180 + i * 40,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        scene.tweens.add({ targets: flame, y: TORCH_Y - 7, duration: 260 + i * 30, yoyo: true, repeat: -1 });
    }

    scene.add.particles(0, 0, ASH_KEY, {
        x: { min: 0, max: LAYOUT.width },
        y: { min: -10, max: LAYOUT.groundY },
        lifespan: 7000,
        speedX: { min: -6, max: 6 },
        speedY: { min: 4, max: 12 },
        alpha: { start: 0.5, end: 0 },
        frequency: 220,
        quantity: 1,
    });

    if (dim > 0) scene.add.rectangle(0, 0, LAYOUT.width, LAYOUT.height, 0x0b0a10, dim).setOrigin(0);
}
