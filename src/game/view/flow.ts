import type { Scene } from 'phaser';
import { TEXTS } from '../../content/texts';
import type { Campaign, RunState } from '../../core/run';

export type SceneTarget =
  | { key: 'Title' }
  | { key: 'Combat' }
  | { key: 'Interlude' }
  | { key: 'Narrative'; data: { lines: string[]; next: SceneTarget } }
  | { key: 'End'; data: { result: 'won' | 'lost' } };

export function introTarget(run: RunState, campaign: Campaign): SceneTarget {
  return { key: 'Narrative', data: { lines: TEXTS.intro, next: encounterTarget(run, campaign) } };
}

export function encounterTarget(run: RunState, campaign: Campaign): SceneTarget {
  return {
    key: 'Narrative',
    data: {
      lines: TEXTS.encounterIntro[campaign.encounters[run.encounterIndex].id],
      next: { key: 'Combat' },
    },
  };
}

export function afterCombatTarget(run: RunState): SceneTarget {
  if (run.status === 'lost') return { key: 'End', data: { result: 'lost' } };
  if (run.status === 'won') return { key: 'End', data: { result: 'won' } };
  return { key: 'Interlude' };
}

export function afterInterludeTarget(run: RunState, campaign: Campaign): SceneTarget {
  return encounterTarget(run, campaign);
}

export function startTarget(scene: Scene, t: SceneTarget): void {
  scene.scene.start(t.key, 'data' in t ? t.data : undefined);
}
