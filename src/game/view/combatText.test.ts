import { beforeEach, describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../../content/campaign';
import { TEXTS } from '../../content/texts';
import { createRng } from '../../core/rng';
import { createRun, startEncounter } from '../../core/run';
import type { CombatEvent, CombatState } from '../../core/types';
import {
  formatAbilityButton,
  formatAbilityPrompt,
  formatEvent,
  formatFatePrompt,
  formatHeroStatus,
  formatTurnOrder,
} from './combatText';

let state: CombatState;

beforeEach(() => {
  state = startEncounter(createRun(CAMPAIGN), CAMPAIGN, createRng(1)).combat;
});

const fmt = (e: CombatEvent) => formatEvent(e, state);

describe('formatEvent', () => {
  it('formats sneak attacks', () => {
    expect(fmt({ type: 'sneakAttack', actorId: 'warrior', targetId: 'skeleton-1' })).toBe(
      '¡Golpe furtivo de Bran contra Esqueleto A!',
    );
  });

  it('formats ability usage', () => {
    expect(fmt({ type: 'abilityUsed', actorId: 'warrior', abilityId: 'slash', targetIds: ['skeleton-1'] })).toBe(
      'Bran usa Tajo sobre Esqueleto A.',
    );
    expect(
      fmt({ type: 'abilityUsed', actorId: 'mage', abilityId: 'fireball', targetIds: ['skeleton-1', 'skeleton-2'] }),
    ).toBe('Teodric usa Bola de Fuego.');
    expect(fmt({ type: 'abilityUsed', actorId: 'warrior', abilityId: 'protect', targetIds: ['warrior'] })).toBe(
      'Bran usa Proteger.',
    );
  });

  it('formats attack rolls', () => {
    const base = { type: 'attackRolled', actorId: 'warrior', targetId: 'skeleton-1' } as const;
    expect(fmt({ ...base, mode: 'normal', rolls: [12], kept: 12, bonus: 5, total: 17, targetAc: 13, outcome: 'hit' })).toBe(
      'd20: 12 + 5 = 17 contra CA 13: ¡Impacto!',
    );
    expect(
      fmt({ ...base, mode: 'advantage', rolls: [4, 16], kept: 16, bonus: 5, total: 21, targetAc: 13, outcome: 'hit' }),
    ).toBe('d20 (ventaja 4/16): 16 + 5 = 21 contra CA 13: ¡Impacto!');
    expect(
      fmt({ ...base, mode: 'disadvantage', rolls: [4, 16], kept: 4, bonus: 4, total: 8, targetAc: 16, outcome: 'miss' }),
    ).toBe('d20 (desventaja 4/16): 4 + 4 = 8 contra CA 16: Fallo.');
    expect(
      fmt({ ...base, mode: 'normal', rolls: [20], kept: 20, bonus: 5, total: 25, targetAc: 13, outcome: 'crit' }),
    ).toMatch(/¡CRÍTICO!$/);
    expect(
      fmt({ ...base, mode: 'normal', rolls: [1], kept: 1, bonus: 5, total: 6, targetAc: 13, outcome: 'fumble' }),
    ).toBe('d20: 1 + 5 = 6 contra CA 13: ¡Pifia!');
  });

  it('formats fate dice', () => {
    expect(
      fmt({ type: 'fateDieSpent', stage: 'attack', value: 3, total: 13, targetAc: 13, outcome: 'hit', remaining: 2 }),
    ).toBe('Dado de Destino: +3 = 13 contra CA 13: ¡Impacto! (quedan 2)');
    expect(
      fmt({ type: 'fateDieSpent', stage: 'attack', value: 1, total: 11, targetAc: 13, outcome: 'miss', remaining: 1 }),
    ).toBe('Dado de Destino: +1 = 11 contra CA 13: Fallo. (quedan 1)');
    expect(fmt({ type: 'fateDieSpent', stage: 'damage', value: 3, total: 11, remaining: 1 })).toBe(
      'Dado de Destino: +3 = 11 (quedan 1)',
    );
    expect(fmt({ type: 'fateDieSpent', stage: 'heal', value: 3, total: 11, remaining: 1 })).toBe(
      'Dado de Destino: +3 = 11 (quedan 1)',
    );
  });

  it('formats damage and healing', () => {
    expect(fmt({ type: 'damageDealt', targetId: 'skeleton-1', amount: 8, hpAfter: 5, crit: false })).toBe(
      'Esqueleto A recibe 8 de daño.',
    );
    expect(fmt({ type: 'damageDealt', targetId: 'skeleton-1', amount: 10, hpAfter: 3, crit: true })).toBe(
      'Esqueleto A recibe 10 de daño crítico.',
    );
    expect(fmt({ type: 'healed', targetId: 'warrior', amount: 8, hpAfter: 9, revived: true })).toBe(
      'Bran se levanta y recupera 8 PG.',
    );
    expect(fmt({ type: 'healed', targetId: 'warrior', amount: 8, hpAfter: 9, revived: false })).toBe(
      'Bran recupera 8 PG.',
    );
  });

  it('formats statuses', () => {
    expect(fmt({ type: 'statusApplied', targetId: 'warrior', status: 'blessed', duration: 2 })).toBe(
      'Bran gana Bendición (2 turnos): ataca con ventaja.',
    );
    expect(fmt({ type: 'statusApplied', targetId: 'warrior', status: 'weakened', duration: 2 })).toBe(
      'Bran sufre Debilidad (2 turnos): ataca con desventaja.',
    );
    expect(fmt({ type: 'statusApplied', targetId: 'skeleton-1', status: 'weakened', duration: 1 })).toBe(
      'Esqueleto A sufre Debilidad (1 turno): ataca con desventaja.',
    );
    expect(fmt({ type: 'statusApplied', targetId: 'warrior', status: 'shielded', duration: 2 })).toBe(
      'Bran gana Protección (2 turnos): +4 CA.',
    );
    expect(fmt({ type: 'savingThrow', targetId: 'warrior', roll: 12, bonus: 1, total: 13, dc: 13, success: true })).toBe(
      'Bran tira salvación: 12 + 1 = 13 contra CD 13: ¡Salvado!',
    );
    expect(fmt({ type: 'savingThrow', targetId: 'warrior', roll: 3, bonus: 1, total: 4, dc: 13, success: false })).toBe(
      'Bran tira salvación: 3 + 1 = 4 contra CD 13: Falla.',
    );
    expect(fmt({ type: 'statusExpired', targetId: 'warrior', status: 'blessed' })).toBe('Bran pierde Bendición.');
  });

  it('formats downing, summoning and combat end', () => {
    expect(fmt({ type: 'combatantDowned', targetId: 'skeleton-1' })).toBe('Esqueleto A cae.');
    expect(fmt({ type: 'summoned', actorId: 'skeleton-1', combatantId: 'skeleton-2', defId: 'skeleton' })).toBe(
      'Esqueleto A alza a Esqueleto B.',
    );
    expect(fmt({ type: 'summonFailed', actorId: 'skeleton-1' })).toBe(
      'Esqueleto A intenta invocar, pero no hay sitio.',
    );
    expect(fmt({ type: 'combatEnded', result: 'victory' })).toBe('¡Victoria!');
    expect(fmt({ type: 'combatEnded', result: 'defeat' })).toBe('El grupo ha caído.');
    expect(fmt({ type: 'turnStarted', actorId: 'warrior', round: 1 })).toBeNull();
  });

  it('formats initiative', () => {
    expect(
      fmt({
        type: 'initiativeRolled',
        entries: [
          { id: 'warrior', roll: 15, total: 16 },
          { id: 'skeleton-1', roll: 10, total: 12 },
        ],
      }),
    ).toBe('Iniciativa: Bran 16, Esqueleto A 12.');
  });
});

describe('formatAbilityButton', () => {
  it('shows remaining uses only when given', () => {
    const brutal = CAMPAIGN.abilities.find((a) => a.id === 'brutalStrike')!;
    const slash = CAMPAIGN.abilities.find((a) => a.id === 'slash')!;
    expect(formatAbilityButton(brutal, 2)).toBe('Golpe Brutal (2)');
    expect(formatAbilityButton(slash)).toBe('Tajo');
  });

  it('marks area abilities', () => {
    const fireball = CAMPAIGN.abilities.find((a) => a.id === 'fireball')!;
    const powder = CAMPAIGN.abilities.find((a) => a.id === 'blindingPowder')!;
    expect(formatAbilityButton(fireball, 1)).toBe('Bola de Fuego (área) (1)');
    expect(formatAbilityButton(powder)).toBe('Polvo Cegador (área)');
  });
});

describe('formatAbilityPrompt', () => {
  const find = (id: string) => CAMPAIGN.abilities.find((a) => a.id === id)!;

  it('asks for a target on single-target abilities', () => {
    expect(formatAbilityPrompt(find('protect'))).toBe(
      'Proteger: Un aliado gana Protección 2 turnos: +4 CA, los enemigos le aciertan menos. Elige un objetivo.',
    );
  });

  it('omits the target request on area abilities', () => {
    expect(formatAbilityPrompt(find('fireball'))).toBe(
      'Bola de Fuego: Daña a todos los enemigos. Quien supere la salvación (CD 13) recibe la mitad.',
    );
  });

  it('fits in two prompt lines', () => {
    for (const id of CAMPAIGN.heroes.flatMap((h) => h.abilityIds)) {
      expect(formatAbilityPrompt(find(id)).length).toBeLessThanOrEqual(110);
    }
  });

  it('keeps the rest description on one line', () => {
    expect(TEXTS.labels.restDesc.length).toBeLessThanOrEqual(70);
  });
});

describe('formatFatePrompt', () => {
  const pending = { actorId: 'warrior', abilityId: 'slash', crit: false } as const;

  it('formats each stage', () => {
    state.fate.current = 2;
    state.pending = { ...pending, stage: 'attack', targetId: 'skeleton-1', total: 10, targetAc: 13 };
    expect(formatFatePrompt(state)).toBe('Fallo por 3. ¿Gastar un Dado de Destino (d4)? Quedan 2.');
    state.pending = { ...pending, stage: 'damage', targetId: 'skeleton-1', total: 8, targetAc: 13 };
    expect(formatFatePrompt(state)).toBe(
      'Daño: 8 (Esqueleto A tiene 13 PG). ¿Sumar un Dado de Destino (d4)? Quedan 2.',
    );
    state.combatants.find((c) => c.id === 'mage')!.hp = 5;
    state.pending = { ...pending, stage: 'heal', targetId: 'mage', total: 6, targetAc: 0 };
    expect(formatFatePrompt(state)).toBe(
      'Curación: 6 (Teodric 5/16 PG). ¿Sumar un Dado de Destino (d4)? Quedan 2.',
    );
  });

  it('throws without a pending roll', () => {
    expect(() => formatFatePrompt(state)).toThrow();
  });
});

describe('formatTurnOrder', () => {
  it('marks the active combatant and skips the downed', () => {
    state.order = ['warrior', 'skeleton-1', 'cleric'];
    state.turnIndex = 0;
    state.round = 1;
    expect(formatTurnOrder(state)).toBe('Ronda 1: [Bran] > Esqueleto A > Isolda');
    state.combatants.find((c) => c.id === 'skeleton-1')!.downed = true;
    expect(formatTurnOrder(state)).toBe('Ronda 1: [Bran] > Isolda');
  });
});

describe('formatHeroStatus', () => {
  it('formats combatants and plain objects', () => {
    expect(formatHeroStatus(state.combatants.find((c) => c.id === 'warrior')!)).toBe('Bran PG 28/28');
    expect(formatHeroStatus({ name: 'Teodric', hp: 5, maxHp: 16 })).toBe('Teodric PG 5/16');
  });
});
