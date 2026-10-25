import { TintModes } from 'phaser';
import type { GameObjects, Scene, Types, Tweens } from 'phaser';
import { STATUS_LABELS } from '../../content/texts';
import type { CombatantState, StatusInstance } from '../../core/types';
import { UNIT_ASSETS, unitTextureKey } from '../assets';
import { COLORS, FONT_BODY, FONT_UI, TIMING } from '../theme';

const BAR_WIDTH = 36;
const BAR_HEIGHT = 4;

export class UnitView {
  readonly sprite: GameObjects.Sprite;
  private readonly hpBg: GameObjects.Rectangle;
  private readonly hpFill: GameObjects.Rectangle;
  private readonly nameText: GameObjects.Text;
  private readonly statusText: GameObjects.Text;
  private readonly marker: GameObjects.Triangle;
  private readonly baseTint: number;
  private readonly isHero: boolean;
  private readonly isPlaceholder: boolean;
  private readonly defId: string;
  private highlight: GameObjects.Rectangle | null = null;
  private highlightTween: Tweens.Tween | null = null;

  constructor(
    private readonly scene: Scene,
    combatant: CombatantState,
    private readonly x: number,
    private readonly y: number,
  ) {
    this.defId = combatant.defId;
    this.isHero = combatant.side === 'hero';
    const asset = UNIT_ASSETS[this.defId];
    const { key, isPlaceholder } = unitTextureKey(this.defId, (k) => scene.textures.exists(k));
    this.isPlaceholder = isPlaceholder;
    this.baseTint = isPlaceholder ? 0xffffff : (asset.tint ?? 0xffffff);
    this.sprite = scene.add.sprite(x, y, key).setOrigin(0.5, 1);
    if (!isPlaceholder) {
      this.sprite.setTint(this.baseTint);
      this.sprite.flipX = combatant.side === 'enemy';
      this.sprite.play(`${this.defId}-idle`);
    }

    const barY = y - asset.barOffsetY;
    this.hpBg = scene.add.rectangle(x, barY, BAR_WIDTH, BAR_HEIGHT, COLORS.hpBg).setOrigin(0.5);
    this.hpFill = scene.add
      .rectangle(x - BAR_WIDTH / 2, barY, BAR_WIDTH, BAR_HEIGHT, COLORS.hpFill)
      .setOrigin(0, 0.5);
    this.nameText = scene.add
      .text(x, barY - 10, combatant.name, { fontFamily: FONT_UI, fontSize: '8px', color: COLORS.text })
      .setOrigin(0.5);
    this.statusText = scene.add
      .text(x + BAR_WIDTH / 2 + 3, barY, '', { fontFamily: FONT_UI, fontSize: '8px', color: COLORS.gold })
      .setOrigin(0, 0.5);
    this.marker = scene.add
      .triangle(x, barY - 22, 0, 0, 8, 0, 4, 6, COLORS.goldHex)
      .setVisible(false);

    this.setHp(combatant.hp, combatant.maxHp);
    this.setStatuses(combatant.statuses);
    if (combatant.downed) this.sprite.setAlpha(0.4);
  }

  setHp(hp: number, maxHp: number): void {
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    this.hpFill.width = BAR_WIDTH * ratio;
    this.hpFill.setFillStyle(ratio <= 0.3 ? COLORS.hpLow : COLORS.hpFill);
  }

  setStatuses(statuses: StatusInstance[]): void {
    this.statusText.setText(statuses.map((s) => STATUS_LABELS[s.status].short).join(' '));
  }

  setActive(on: boolean): void {
    this.marker.setVisible(on);
  }

  setTargetable(on: boolean, onPick?: () => void): void {
    this.highlightTween?.remove();
    this.highlightTween = null;
    this.highlight?.destroy();
    this.highlight = null;
    this.sprite.off('pointerup');
    if (!on) {
      this.sprite.disableInteractive();
      return;
    }
    const w = this.sprite.width + 6;
    const h = this.sprite.height + 6;
    this.highlight = this.scene.add
      .rectangle(this.x, this.y + 3, w, h)
      .setOrigin(0.5, 1)
      .setStrokeStyle(2, COLORS.goldHex);
    this.highlightTween = this.scene.tweens.add({
      targets: this.highlight,
      alpha: 0.3,
      duration: 350,
      yoyo: true,
      repeat: -1,
    });
    if (onPick) {
      this.sprite.setInteractive({ useHandCursor: true });
      this.sprite.on('pointerup', onPick);
    }
  }

  playLunge(dir: 1 | -1): Promise<void> {
    const attackKey = `${this.defId}-attack`;
    if (this.scene.anims.exists(attackKey)) this.sprite.play(attackKey).chain(`${this.defId}-idle`);
    return this.tween({ targets: this.sprite, x: this.x + 12 * dir, duration: TIMING.lunge, yoyo: true });
  }

  playHop(): Promise<void> {
    return this.tween({ targets: this.sprite, y: this.y - 6, duration: TIMING.lunge, yoyo: true });
  }

  flash(): Promise<void> {
    this.sprite.setTint(0xffffff).setTintMode(TintModes.FILL);
    return new Promise((resolve) => {
      this.scene.time.delayedCall(TIMING.flash, () => {
        this.sprite.setTint(this.baseTint).setTintMode(TintModes.MULTIPLY);
        resolve();
      });
    });
  }

  floatText(text: string, color: string, big = false): void {
    const label = this.scene.add
      .text(this.x, this.y - this.sprite.height - 14, text, {
        fontFamily: big ? FONT_UI : FONT_BODY,
        fontSize: '16px',
        color,
      })
      .setOrigin(0.5);
    this.scene.tweens.add({
      targets: label,
      y: label.y - 20,
      alpha: 0,
      duration: TIMING.float,
      onComplete: () => label.destroy(),
    });
  }

  playDowned(): Promise<void> {
    if (this.isHero) {
      this.sprite.setAlpha(0.4).setTint(0x777777).setTintMode(TintModes.MULTIPLY);
      return Promise.resolve();
    }
    const deathKey = `${this.defId}-death`;
    if (!this.isPlaceholder && this.scene.anims.exists(deathKey)) this.sprite.play(deathKey);
    return this.tween({ targets: [this.sprite, this.hpBg, this.hpFill, this.nameText, this.statusText, this.marker], alpha: 0, duration: 300 });
  }

  revive(): void {
    this.sprite.setAlpha(1).setTint(this.baseTint).setTintMode(TintModes.MULTIPLY);
  }

  destroy(): void {
    this.setTargetable(false);
    this.sprite.destroy();
    this.hpBg.destroy();
    this.hpFill.destroy();
    this.nameText.destroy();
    this.statusText.destroy();
    this.marker.destroy();
  }

  fadeIn(): Promise<void> {
    const targets = [this.sprite, this.hpBg, this.hpFill, this.nameText, this.statusText];
    targets.forEach((t) => t.setAlpha(0));
    return this.tween({ targets, alpha: 1, duration: 300 });
  }

  private tween(config: Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }
}
