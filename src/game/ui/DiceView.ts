import { GameObjects } from 'phaser';
import type { Scene } from 'phaser';
import type { AttackOutcome } from '../../core/types';
import { COLORS, FONT_UI, LAYOUT } from '../theme';

const OUTCOME_BORDER: Record<AttackOutcome, number> = {
  crit: COLORS.goldHex,
  fumble: COLORS.damageHex,
  hit: COLORS.healHex,
  miss: COLORS.textDimHex,
};

const D20_RADIUS = 16;
const CYCLE_MS = 50;
const CYCLE_TOTAL_MS = 300;

export class DiceView {
  private readonly container: GameObjects.Container;
  private cycleTimer: ReturnType<typeof setInterval> | null = null;
  private d4Objects: GameObjects.GameObject[] = [];

  constructor(private readonly scene: Scene) {
    this.container = scene.add.container(LAYOUT.diceX, LAYOUT.diceY).setVisible(false);
  }

  showD20(rolls: number[], kept: number, outcome: AttackOutcome): void {
    this.clear();
    this.container.setVisible(true);
    const border = OUTCOME_BORDER[outcome];
    const labels: GameObjects.Text[] = [];
    const finals: number[] = [];
    rolls.forEach((roll, i) => {
      const x = i * 40;
      const discarded = rolls.length > 1 && i !== rolls.indexOf(kept);
      const gfx = this.scene.add.graphics({ x, y: 0 });
      gfx.fillStyle(COLORS.panel);
      gfx.lineStyle(2, border);
      const points = Array.from({ length: 6 }, (_, k) => {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        return { x: Math.cos(a) * D20_RADIUS, y: Math.sin(a) * D20_RADIUS };
      });
      gfx.beginPath();
      points.forEach((pt, k) => (k === 0 ? gfx.moveTo(pt.x, pt.y) : gfx.lineTo(pt.x, pt.y)));
      gfx.closePath();
      gfx.fillPath();
      gfx.strokePath();
      const label = this.scene.add
        .text(x, 0, String(Math.floor(Math.random() * 20) + 1), { fontFamily: FONT_UI, fontSize: '16px', color: COLORS.text })
        .setOrigin(0.5);
      if (discarded) {
        gfx.setAlpha(0.4);
        label.setAlpha(0.4);
      }
      this.container.add([gfx, label]);
      labels.push(label);
      finals.push(roll);
    });
    let elapsed = 0;
    this.cycleTimer = setInterval(() => {
      elapsed += CYCLE_MS;
      const done = elapsed >= CYCLE_TOTAL_MS;
      labels.forEach((label, i) => {
        label.setText(String(done ? finals[i] : Math.floor(Math.random() * 20) + 1));
      });
      if (done) this.stopCycle();
    }, CYCLE_MS);
  }

  showD4(value: number): void {
    this.container.setVisible(true);
    this.d4Objects.forEach((o) => o.destroy());
    const r = 12;
    const x = 84;
    const tri = this.scene.add.triangle(x, 2, 0, r * 2, r, 0, r * 2, r * 2, COLORS.fate);
    const label = this.scene.add
      .text(x, 8, String(value), { fontFamily: FONT_UI, fontSize: '8px', color: '#0b0a10' })
      .setOrigin(0.5);
    this.container.add([tri, label]);
    this.d4Objects = [tri, label];
  }

  hide(): void {
    this.clear();
    this.container.setVisible(false);
  }

  private clear(): void {
    this.stopCycle();
    this.d4Objects = [];
    this.container.removeAll(true);
  }

  destroy(): void {
    this.stopCycle();
    this.container.destroy();
  }

  private stopCycle(): void {
    if (this.cycleTimer !== null) clearInterval(this.cycleTimer);
    this.cycleTimer = null;
  }
}
