import type { Loader, Scene } from 'phaser';

export type UnitAnim = 'idle' | 'attack' | 'hit' | 'death';

export interface SheetConfig {
  frameWidth: number;
  frameHeight: number;
}

/** Caja visible del personaje dentro del frame (px del PNG), medida sobre la tira idle. */
export interface ArtConfig {
  sheet: SheetConfig;
  bodyHeight: number;
  footPad: number;
  centerX: number;
  scale: number;
}

export interface UnitAsset {
  defId: string;
  folder: string;
  placeholder: { width: number; height: number; color: number };
  barOffsetY: number;
  tint?: number;
  sheet?: SheetConfig;
  art?: ArtConfig;
}

const UNIT_ANIMS: UnitAnim[] = ['idle', 'attack', 'hit', 'death'];

function entry(defId: string, width: number, height: number, color: number, tint?: number, art?: ArtConfig): UnitAsset {
  const barOffsetY = (art ? Math.round(art.bodyHeight * art.scale) : height) + 10;
  return { defId, folder: defId, placeholder: { width, height, color }, barOffsetY, tint, sheet: art?.sheet, art };
}

function art(frameWidth: number, frameHeight: number, bodyHeight: number, footPad: number, centerX: number, scale = 1): ArtConfig {
  return { sheet: { frameWidth, frameHeight }, bodyHeight, footPad, centerX, scale };
}

// Packs CC0 de LuizMelo (ver CREDITS.md). Clériga = Wizard Pack recoloreado (PNG propios); Necrófago = Goblin teñido. Pícara: placeholder hasta integrar Huntress.
export const UNIT_ASSETS: Record<string, UnitAsset> = {
  warrior: entry('warrior', 32, 56, 0x8a8f99, undefined, art(180, 180, 51, 66, 96, 1.1)),
  cleric: entry('cleric', 28, 52, 0xe6d27a, undefined, art(231, 190, 86, 49, 110, 0.75)),
  mage: entry('mage', 28, 52, 0x4a6fc2, undefined, art(231, 190, 86, 49, 110, 0.75)),
  rogue: entry('rogue', 26, 50, 0x3f6b4a),
  skeleton: entry('skeleton', 28, 52, 0xd8d2c0, undefined, art(150, 150, 51, 49, 82)),
  ghoul: entry('ghoul', 32, 44, 0x6f8a5a, 0x9fb39a, art(150, 150, 36, 49, 74, 1.25)),
  cultist: entry('cultist', 28, 54, 0x7a2e3a, undefined, art(150, 150, 58, 48, 71)),
  ashenKing: entry('ashenKing', 48, 80, 0x5a5550, 0x8c8580, art(160, 111, 54, 6, 80.5, 1.5)),
};

export function queueUnitAssets(load: Loader.LoaderPlugin): void {
  for (const asset of Object.values(UNIT_ASSETS)) {
    if (!asset.sheet) continue;
    for (const anim of UNIT_ANIMS) {
      load.spritesheet(`${asset.defId}-${anim}`, `sprites/${asset.folder}/${anim}.png`, asset.sheet);
    }
  }
}

export function createUnitAnimations(scene: Scene): void {
  for (const asset of Object.values(UNIT_ASSETS)) {
    for (const anim of UNIT_ANIMS) {
      const key = `${asset.defId}-${anim}`;
      if (!scene.textures.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(key),
        frameRate: 10,
        repeat: anim === 'idle' ? -1 : 0,
      });
    }
  }
}

export function ensurePlaceholders(scene: Scene): void {
  for (const asset of Object.values(UNIT_ASSETS)) {
    const { width, height, color } = asset.placeholder;
    const gfx = scene.add.graphics();
    gfx.fillStyle(color);
    gfx.fillRect(0, 0, width, height);
    gfx.lineStyle(2, 0x000000, 0.6);
    gfx.strokeRect(1, 1, width - 2, height - 2);
    gfx.generateTexture(`placeholder-${asset.defId}`, width, height);
    gfx.destroy();
  }
}

export function unitTextureKey(
  defId: string,
  hasTexture: (key: string) => boolean,
): { key: string; isPlaceholder: boolean } {
  const idleKey = `${defId}-idle`;
  if (UNIT_ASSETS[defId]?.sheet && hasTexture(idleKey)) return { key: idleKey, isPlaceholder: false };
  return { key: `placeholder-${defId}`, isPlaceholder: true };
}
