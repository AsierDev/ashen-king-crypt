import { describe, expect, it, vi } from 'vitest';
import type { Scene } from 'phaser';
import { CAMPAIGN } from '../../content/campaign';
import { TEXTS } from '../../content/texts';
import { createRun } from '../../core/run';
import { afterCombatTarget, afterInterludeTarget, introTarget, startTarget } from './flow';

describe('flow', () => {
  it('introTarget encadena introducción, Antesala y combate', () => {
    const t = introTarget(createRun(CAMPAIGN), CAMPAIGN);
    expect(t.key).toBe('Narrative');
    if (t.key !== 'Narrative') return;
    expect(t.data.lines).toBe(TEXTS.intro);
    const next = t.data.next;
    expect(next.key).toBe('Narrative');
    if (next.key !== 'Narrative') return;
    expect(next.data.lines).toBe(TEXTS.encounterIntro.antechamber);
    expect(next.data.next).toEqual({ key: 'Combat' });
  });

  it('afterCombatTarget según el estado de la partida', () => {
    const run = createRun(CAMPAIGN);
    expect(afterCombatTarget({ ...run, status: 'lost' })).toEqual({ key: 'End', data: { result: 'lost' } });
    expect(afterCombatTarget({ ...run, status: 'won' })).toEqual({ key: 'End', data: { result: 'won' } });
    expect(afterCombatTarget({ ...run, status: 'inProgress' })).toEqual({ key: 'Interlude' });
  });

  it('afterInterludeTarget lleva al Trono en el encuentro 4', () => {
    const run = { ...createRun(CAMPAIGN), encounterIndex: CAMPAIGN.encounters.length - 1 };
    const t = afterInterludeTarget(run, CAMPAIGN);
    expect(t.key).toBe('Narrative');
    if (t.key !== 'Narrative') return;
    expect(t.data.lines).toBe(TEXTS.encounterIntro.throne);
    expect(t.data.next).toEqual({ key: 'Combat' });
  });

  it('startTarget pasa los datos a scene.start', () => {
    const start = vi.fn();
    const scene = { scene: { start } } as unknown as Scene;
    startTarget(scene, { key: 'Combat' });
    expect(start).toHaveBeenCalledWith('Combat', undefined);
    startTarget(scene, { key: 'End', data: { result: 'lost' } });
    expect(start).toHaveBeenCalledWith('End', { result: 'lost' });
  });
});
