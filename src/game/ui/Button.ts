import { GameObjects } from 'phaser';
import type { Scene } from 'phaser';
import { COLORS, FONT_UI } from '../theme';

export class TextButton extends GameObjects.Container {
  private readonly background: GameObjects.Rectangle;
  private readonly text: GameObjects.Text;
  private enabled = true;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    fontSize = 8,
    fontFamily = FONT_UI,
  ) {
    super(scene, x, y);
    this.background = scene.add
      .rectangle(0, 0, width, height, COLORS.panel)
      .setStrokeStyle(1, COLORS.panelBorder);
    this.text = scene.add
      .text(0, 0, label, { fontFamily, fontSize: `${fontSize}px`, color: COLORS.text, align: 'center', wordWrap: { width: width - 6 } })
      .setOrigin(0.5);
    this.add([this.background, this.text]);
    this.setSize(width, height);

    this.background.setInteractive({ useHandCursor: true });
    this.background.on('pointerover', () => {
      if (this.enabled) this.background.setStrokeStyle(1, COLORS.goldHex);
    });
    this.background.on('pointerout', () => this.background.setStrokeStyle(1, COLORS.panelBorder));
    this.background.on('pointerup', () => {
      if (this.enabled) onClick();
    });
    scene.add.existing(this);
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.4);
    return this;
  }

  setLabel(text: string): this {
    this.text.setText(text);
    return this;
  }
}
