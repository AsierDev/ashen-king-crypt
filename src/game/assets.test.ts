import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../content/campaign';
import { UNIT_ASSETS, unitTextureKey } from './assets';

describe('UNIT_ASSETS', () => {
  it('tiene entrada para cada héroe y enemigo de la campaña', () => {
    for (const def of [...CAMPAIGN.heroes, ...CAMPAIGN.enemies]) {
      expect(UNIT_ASSETS[def.id], def.id).toBeDefined();
      expect(UNIT_ASSETS[def.id].folder).toBe(def.id);
    }
  });

  it('todos los héroes tienen hoja de sprites', () => {
    for (const def of CAMPAIGN.heroes) {
      expect(UNIT_ASSETS[def.id].sheet, def.id).toBeDefined();
      expect(UNIT_ASSETS[def.id].art, def.id).toBeDefined();
    }
  });

  it('define placeholders válidos y desplazamiento de barra', () => {
    for (const asset of Object.values(UNIT_ASSETS)) {
      expect(asset.placeholder.width).toBeGreaterThan(0);
      expect(asset.placeholder.height).toBeGreaterThan(0);
      const body = asset.art ? Math.round(asset.art.bodyHeight * asset.art.scale) : asset.placeholder.height;
      expect(asset.barOffsetY).toBe(body + 10);
    }
  });
});

describe('unitTextureKey', () => {
  it('usa el placeholder cuando la textura no ha cargado', () => {
    expect(unitTextureKey('warrior', () => false)).toEqual({ key: 'placeholder-warrior', isPlaceholder: true });
  });

  it('usa la textura real solo si hay sheet y la textura existe', () => {
    const id = 'testUnit';
    UNIT_ASSETS[id] = {
      defId: id,
      folder: id,
      placeholder: { width: 10, height: 10, color: 0 },
      barOffsetY: 20,
      sheet: { frameWidth: 8, frameHeight: 8 },
    };
    try {
      expect(unitTextureKey(id, () => true)).toEqual({ key: `${id}-idle`, isPlaceholder: false });
      expect(unitTextureKey(id, () => false)).toEqual({ key: `placeholder-${id}`, isPlaceholder: true });
    } finally {
      delete UNIT_ASSETS[id];
    }
  });
});
