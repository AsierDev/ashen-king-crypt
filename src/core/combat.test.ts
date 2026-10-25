import { describe, expect, it } from 'vitest';
import { chooseEnemyIntent, runEnemyTurn } from './ai';
import {
  createCombat,
  createCombatant,
  declineFate,
  effectiveAc,
  getActive,
  getAvailableAbilities,
  getCombatant,
  getValidTargets,
  performAction,
  spendFateDie,
} from './combat';
import { createSequenceRng } from './sequenceRng';
import type {
  AbilityDef,
  CombatEvent,
  CombatState,
  EnemyDef,
  FatePool,
  HeroDef,
} from './types';

const ability = (a: Partial<AbilityDef> & Pick<AbilityDef, 'id' | 'target' | 'roll'>): AbilityDef => ({
  name: a.id,
  description: a.id,
  ...a,
});

const ABILITIES: Record<string, AbilityDef> = Object.fromEntries(
  [
    ability({ id: 'strike', target: 'singleEnemy', roll: 'attack', damage: { count: 1, sides: 8, bonus: 3 } }),
    ability({
      id: 'bless',
      target: 'singleAlly',
      roll: 'none',
      usesPerCombat: 2,
      applyStatus: { status: 'blessed', duration: 2 },
    }),
    ability({
      id: 'heal',
      target: 'singleAlly',
      roll: 'none',
      usesPerCombat: 3,
      canRevive: true,
      heal: { count: 1, sides: 8, bonus: 3 },
    }),
    ability({ id: 'boom', target: 'allEnemies', roll: 'none', usesPerCombat: 1, damage: { count: 2, sides: 6, bonus: 0 } }),
    ability({ id: 'guard', target: 'singleAlly', roll: 'none', applyStatus: { status: 'shielded', duration: 2 } }),
    ability({ id: 'claw', target: 'singleEnemy', roll: 'attack', damage: { count: 1, sides: 6, bonus: 2 } }),
    ability({
      id: 'rot',
      target: 'singleEnemy',
      roll: 'attack',
      damage: { count: 1, sides: 6, bonus: 2 },
      applyStatus: { status: 'weakened', duration: 2 },
    }),
    ability({
      id: 'raise',
      target: 'self',
      roll: 'none',
      usesPerCombat: 1,
      summon: { enemyId: 'skeleton', count: 1 },
    }),
    ability({ id: 'wave', target: 'allEnemies', roll: 'none', usesPerCombat: 2, damage: { count: 1, sides: 6, bonus: 1 } }),
    ability({
      id: 'call',
      target: 'self',
      roll: 'none',
      usesPerCombat: 1,
      summon: { enemyId: 'skeleton', count: 2 },
    }),
    ability({ id: 'zap', target: 'singleEnemy', roll: 'none', damage: { count: 2, sides: 4, bonus: 2 } }),
  ].map((a) => [a.id, a]),
);

const HERO_ABILITIES = ['strike', 'bless', 'heal', 'boom', 'guard', 'zap'];
const hero = (id: string, maxHp: number, ac: number, initiativeBonus: number): HeroDef => ({
  id,
  name: id,
  className: 'Test',
  maxHp,
  ac,
  attackBonus: 5,
  initiativeBonus,
  abilityIds: HERO_ABILITIES,
});
const HERO_A = hero('A', 28, 16, 1);
const HERO_B = hero('B', 16, 12, 2);
const HERO_C = hero('C', 20, 14, 0);

const enemy = (
  id: string,
  name: string,
  aiProfile: EnemyDef['aiProfile'],
  abilityIds: string[],
  maxHp = 13,
): EnemyDef => ({ id, name, maxHp, ac: 13, attackBonus: 4, initiativeBonus: 2, abilityIds, aiProfile });

const ENEMY_DEFS: Record<string, EnemyDef> = Object.fromEntries(
  [
    enemy('skeleton', 'Esqueleto', 'lowestHp', ['claw']),
    enemy('ghoul', 'Necrófago', 'lowestHp', ['rot']),
    enemy('rat', 'Rata', 'random', ['claw']),
    enemy('cultist', 'Sectario', 'summoner', ['claw', 'raise']),
    enemy('king', 'Rey Ceniza', 'ashenKing', ['strike', 'wave', 'call'], 60),
  ].map((e) => [e.id, e]),
);

function setup(params: { heroes?: HeroDef[]; enemyIds?: string[]; init?: number[]; fate?: FatePool }): {
  state: CombatState;
  events: CombatEvent[];
} {
  const heroes = params.heroes ?? [HERO_A, HERO_B];
  const enemyIds = params.enemyIds ?? ['skeleton'];
  const init = params.init ?? [...heroes.map((_, i) => (i === 0 ? 20 : 10)), ...enemyIds.map(() => 1)];
  return createCombat(
    {
      heroes: heroes.map((h) => createCombatant(h, 'hero', h.id, h.name, ABILITIES)),
      enemyIds,
      fate: params.fate ?? { current: 0, max: 3, sides: 4 },
      abilities: ABILITIES,
      enemyDefs: ENEMY_DEFS,
    },
    createSequenceRng(init),
  );
}

const seq = createSequenceRng;
const fate3 = (): FatePool => ({ current: 3, max: 3, sides: 4 });
const last = (events: CombatEvent[]): CombatEvent => events[events.length - 1];
const ofType = <T extends CombatEvent['type']>(events: CombatEvent[], type: T) =>
  events.filter((e): e is Extract<CombatEvent, { type: T }> => e.type === type);
const strike = (state: CombatState, values: number[], targetId = 'skeleton-1') =>
  performAction(state, { actorId: 'A', abilityId: 'strike', targetId }, seq(values));
const zap = (state: CombatState, actorId: string, values: number[]) =>
  performAction(state, { actorId, abilityId: 'zap', targetId: 'skeleton-1' }, seq(values));
const claw = (state: CombatState, values: number[]) =>
  performAction(state, { actorId: 'skeleton-1', abilityId: 'claw', targetId: 'A' }, seq(values));

describe('iniciativa', () => {
  it('desempata por bono de iniciativa', () => {
    const { events } = setup({ heroes: [HERO_A], init: [10, 9] });
    expect(events[0].type).toBe('initiativeRolled');
    expect(events[1]).toEqual({ type: 'turnStarted', actorId: 'skeleton-1', round: 1 });
  });
});

describe('ataques', () => {
  it('impacto', () => {
    const { state } = setup({});
    const events = strike(state, [12, 5]);
    expect(ofType(events, 'attackRolled')[0]).toMatchObject({ total: 17, outcome: 'hit' });
    expect(ofType(events, 'damageDealt')[0].amount).toBe(8);
    expect(getCombatant(state, 'skeleton-1').hp).toBe(5);
    expect(last(events).type).toBe('turnStarted');
  });

  it('crítico', () => {
    const { state } = setup({});
    const events = strike(state, [20, 3, 4]);
    expect(ofType(events, 'attackRolled')[0].outcome).toBe('crit');
    expect(ofType(events, 'damageDealt')[0]).toMatchObject({ amount: 10, crit: true });
  });

  it('pifia: sin daño ni Destino', () => {
    const { state } = setup({ fate: fate3() });
    getCombatant(state, 'A').attackBonus = 30;
    const events = strike(state, [1]);
    expect(ofType(events, 'attackRolled')[0].outcome).toBe('fumble');
    expect(ofType(events, 'damageDealt')).toHaveLength(0);
    expect(state.pending).toBeNull();
    expect(getActive(state).id).not.toBe('A');
  });

  it('bono de daño', () => {
    const { state } = setup({});
    getCombatant(state, 'A').damageBonus = 2;
    expect(ofType(strike(state, [12, 5]), 'damageDealt')[0].amount).toBe(10);
  });

  it('ventaja y desventaja', () => {
    const adv = setup({});
    getCombatant(adv.state, 'A').statuses = [{ status: 'blessed', remaining: 2 }];
    const advRoll = ofType(strike(adv.state, [4, 16, 5]), 'attackRolled')[0];
    expect(advRoll).toMatchObject({ mode: 'advantage', kept: 16 });

    const dis = setup({});
    getCombatant(dis.state, 'A').statuses = [{ status: 'weakened', remaining: 2 }];
    expect(ofType(strike(dis.state, [4, 16, 5]), 'attackRolled')[0]).toMatchObject({ mode: 'disadvantage', kept: 4 });

    const both = setup({});
    getCombatant(both.state, 'A').statuses = [
      { status: 'blessed', remaining: 2 },
      { status: 'weakened', remaining: 2 },
    ];
    const roll = ofType(strike(both.state, [10, 5]), 'attackRolled')[0];
    expect(roll.mode).toBe('normal');
    expect(roll.rolls).toHaveLength(1);
  });

  it('protección sube la CA', () => {
    const { state } = setup({});
    const skeleton = getCombatant(state, 'skeleton-1');
    skeleton.statuses = [{ status: 'shielded', remaining: 2 }];
    expect(effectiveAc(skeleton)).toBe(17);
    expect(ofType(strike(state, [10]), 'attackRolled')[0]).toMatchObject({ targetAc: 17, outcome: 'miss' });
  });
});

describe('Dados de Destino', () => {
  it('un fallo alcanzable deja pendiente el ataque', () => {
    const { state } = setup({ fate: fate3() });
    const events = strike(state, [5]);
    expect(state.pending?.stage).toBe('attack');
    expect(last(events)).toMatchObject({ type: 'attackRolled', outcome: 'miss' });
    expect(getActive(state).id).toBe('A');
  });

  it('el Destino convierte el fallo y encadena la pausa de daño', () => {
    const { state } = setup({ fate: fate3() });
    strike(state, [5]);
    const events = spendFateDie(state, seq([3, 6]));
    expect(events[0]).toEqual({
      type: 'fateDieSpent',
      stage: 'attack',
      value: 3,
      total: 13,
      targetAc: 13,
      outcome: 'hit',
      remaining: 2,
    });
    expect(state.pending).toMatchObject({ stage: 'damage', total: 9 });
    expect(ofType(events, 'damageDealt')).toHaveLength(0);
    const declined = declineFate(state);
    expect(ofType(declined, 'damageDealt')[0].amount).toBe(9);
    expect(state.pending).toBeNull();
    expect(getActive(state).id).not.toBe('A');
  });

  it('un dado insuficiente deja el ataque pendiente y se puede rechazar', () => {
    const { state } = setup({ fate: fate3() });
    strike(state, [5]);
    const events = spendFateDie(state, seq([1]));
    expect(events[0]).toMatchObject({ outcome: 'miss', total: 11, remaining: 2 });
    expect(state.pending?.stage).toBe('attack');
    const declined = declineFate(state);
    expect(ofType(declined, 'damageDealt')).toHaveLength(0);
    expect(last(declined).type).toBe('turnStarted');
  });

  it('se agota el Destino y el turno avanza solo', () => {
    const { state } = setup({ fate: { current: 1, max: 3, sides: 4 } });
    strike(state, [5]);
    const events = spendFateDie(state, seq([1]));
    expect(events[0]).toMatchObject({ remaining: 0 });
    expect(state.pending).toBeNull();
    expect(getActive(state).id).not.toBe('A');
  });

  it('un fallo inalcanzable no ofrece Destino', () => {
    const { state } = setup({ fate: { current: 1, max: 3, sides: 4 } });
    getCombatant(state, 'A').attackBonus = 3;
    strike(state, [2]);
    expect(state.pending).toBeNull();
    expect(getActive(state).id).not.toBe('A');
  });

  it('los enemigos nunca usan Destino', () => {
    const missed = setup({ heroes: [HERO_A], init: [1, 20], fate: fate3() });
    claw(missed.state, [3]);
    expect(missed.state.pending).toBeNull();

    const hit = setup({ heroes: [HERO_A], init: [1, 20], fate: fate3() });
    const events = claw(hit.state, [15, 1]);
    expect(ofType(events, 'damageDealt')).toHaveLength(1);
    expect(hit.state.pending).toBeNull();
  });

  it('pausa de daño', () => {
    const { state } = setup({ fate: fate3() });
    strike(state, [12, 5]);
    expect(state.pending).toMatchObject({ stage: 'damage', total: 8 });
    const events = spendFateDie(state, seq([3]));
    expect(events[0]).toEqual({ type: 'fateDieSpent', stage: 'damage', value: 3, total: 11, remaining: 2 });
    expect(state.pending).not.toBeNull();
    const declined = declineFate(state);
    expect(ofType(declined, 'damageDealt')[0].amount).toBe(11);
    expect(getCombatant(state, 'skeleton-1').hp).toBe(2);
    expect(getActive(state).id).not.toBe('A');
  });

  it('sin pausa si el daño ya mata', () => {
    const { state } = setup({ fate: fate3() });
    getCombatant(state, 'skeleton-1').hp = 5;
    const events = strike(state, [12, 5]);
    expect(ofType(events, 'damageDealt')).toHaveLength(1);
    expect(ofType(events, 'combatantDowned')).toHaveLength(1);
    expect(state.pending).toBeNull();
  });

  it('el Destino vuelve letal el daño y se resuelve solo', () => {
    const { state } = setup({ fate: fate3() });
    getCombatant(state, 'skeleton-1').hp = 10;
    strike(state, [12, 5]);
    expect(state.pending?.total).toBe(8);
    const events = spendFateDie(state, seq([2]));
    expect(ofType(events, 'damageDealt')[0].amount).toBe(10);
    expect(ofType(events, 'combatantDowned')).toHaveLength(1);
    expect(state.pending).toBeNull();
    expect(state.fate.current).toBe(2);
  });

  it('el crítico se conserva en la pausa', () => {
    const { state } = setup({ fate: fate3() });
    strike(state, [20, 3, 4]);
    expect(state.pending).toMatchObject({ stage: 'damage', total: 10, crit: true });
    expect(ofType(declineFate(state), 'damageDealt')[0]).toMatchObject({ amount: 10, crit: true });
  });

  it('daño automático de objetivo único también pausa', () => {
    const { state } = setup({ fate: fate3() });
    const events = zap(state, 'A', [1, 1]);
    expect(state.pending).toMatchObject({ stage: 'damage', total: 4 });
    expect(ofType(events, 'attackRolled')).toHaveLength(0);
  });

  it('el área no pausa', () => {
    const { state } = setup({ enemyIds: ['skeleton', 'skeleton'], fate: fate3() });
    const events = performAction(state, { actorId: 'A', abilityId: 'boom' }, seq([1, 2, 3, 4]));
    expect(ofType(events, 'damageDealt').map((e) => e.amount)).toEqual([3, 7]);
    expect(state.pending).toBeNull();
  });

  it('pausa de curación', () => {
    const { state } = setup({ fate: fate3() });
    getCombatant(state, 'B').hp = 4;
    performAction(state, { actorId: 'A', abilityId: 'heal', targetId: 'B' }, seq([5]));
    expect(state.pending).toMatchObject({ stage: 'heal', total: 8 });
    spendFateDie(state, seq([3]));
    expect(state.pending?.total).toBe(11);
    const events = spendFateDie(state, seq([4]));
    expect(ofType(events, 'healed')[0]).toMatchObject({ amount: 15, hpAfter: 16 });
    expect(state.pending).toBeNull();
    expect(state.fate.current).toBe(1);
  });

  it('sin pausa si la curación ya llena', () => {
    const { state } = setup({ fate: fate3() });
    getCombatant(state, 'B').hp = 10;
    const events = performAction(state, { actorId: 'A', abilityId: 'heal', targetId: 'B' }, seq([5]));
    expect(ofType(events, 'healed')[0].hpAfter).toBe(16);
    expect(state.pending).toBeNull();
  });

  it('revivir con pausa', () => {
    const { state } = setup({ fate: fate3() });
    const b = getCombatant(state, 'B');
    b.hp = 0;
    b.downed = true;
    performAction(state, { actorId: 'A', abilityId: 'heal', targetId: 'B' }, seq([5]));
    expect(state.pending?.stage).toBe('heal');
    const events = declineFate(state);
    expect(ofType(events, 'healed')[0]).toMatchObject({ amount: 8, revived: true });
    expect(b.downed).toBe(false);
  });
});

describe('curación y revivir', () => {
  it('revive a un caído', () => {
    const { state } = setup({});
    const b = getCombatant(state, 'B');
    b.hp = 0;
    b.downed = true;
    expect(getValidTargets(state, 'A', 'heal')).toContain('B');
    expect(getValidTargets(state, 'A', 'bless')).not.toContain('B');
    const events = performAction(state, { actorId: 'A', abilityId: 'heal', targetId: 'B' }, seq([5]));
    expect(ofType(events, 'healed')[0]).toMatchObject({ amount: 8, revived: true });
    expect(b.downed).toBe(false);
  });

  it('no pasa del máximo pero informa de la cantidad tirada', () => {
    const { state } = setup({});
    const a = getCombatant(state, 'A');
    a.hp = 26;
    const events = performAction(state, { actorId: 'A', abilityId: 'heal', targetId: 'A' }, seq([8]));
    expect(a.hp).toBe(28);
    expect(ofType(events, 'healed')[0].amount).toBe(11);
  });
});

describe('fin del combate', () => {
  it('victoria', () => {
    const { state } = setup({});
    getCombatant(state, 'skeleton-1').hp = 5;
    const events = strike(state, [12, 5]);
    expect(ofType(events, 'combatantDowned')).toHaveLength(1);
    expect(last(events)).toEqual({ type: 'combatEnded', result: 'victory' });
    expect(state.result).toBe('victory');
    expect(ofType(events, 'turnStarted')).toHaveLength(0);
  });

  it('derrota', () => {
    const { state } = setup({ heroes: [HERO_A], init: [1, 20] });
    getCombatant(state, 'A').hp = 3;
    const events = claw(state, [15, 6]);
    expect(last(events)).toEqual({ type: 'combatEnded', result: 'defeat' });
    expect(state.result).toBe('defeat');
  });
});

describe('habilidades', () => {
  it('usos por combate', () => {
    const { state } = setup({});
    performAction(state, { actorId: 'A', abilityId: 'boom' }, seq([1, 1]));
    state.turnIndex = state.order.indexOf('A');
    expect(getAvailableAbilities(state, 'A').map((a) => a.id)).not.toContain('boom');
    expect(() => performAction(state, { actorId: 'A', abilityId: 'boom' }, seq([1, 1]))).toThrow();
  });

  it('área sin tirada de ataque', () => {
    const { state } = setup({ enemyIds: ['skeleton', 'skeleton'] });
    const events = performAction(state, { actorId: 'A', abilityId: 'boom' }, seq([1, 2, 3, 4]));
    expect(ofType(events, 'damageDealt').map((e) => e.amount)).toEqual([3, 7]);
    expect(ofType(events, 'attackRolled')).toHaveLength(0);
  });

  it('bono de daño en el área', () => {
    const { state } = setup({ enemyIds: ['skeleton', 'skeleton'] });
    getCombatant(state, 'A').damageBonus = 2;
    const events = performAction(state, { actorId: 'A', abilityId: 'boom' }, seq([1, 2, 3, 4]));
    expect(ofType(events, 'damageDealt').map((e) => e.amount)).toEqual([5, 9]);
  });

  it('el refresco de un estado toma la mayor duración', () => {
    const { state } = setup({ heroes: [HERO_A], enemyIds: ['ghoul'], init: [1, 20] });
    const a = getCombatant(state, 'A');
    a.statuses = [{ status: 'weakened', remaining: 1 }];
    performAction(state, { actorId: 'ghoul-1', abilityId: 'rot', targetId: 'A' }, seq([15, 1]));
    expect(a.statuses).toEqual([{ status: 'weakened', remaining: 2 }]);
  });
});

describe('duración de estados', () => {
  it('bendición lanzada por un aliado caduca al final del 2.º turno del portador', () => {
    const { state } = setup({ init: [10, 20, 1] });
    getCombatant(state, 'skeleton-1').hp = 100;
    getCombatant(state, 'skeleton-1').maxHp = 100;
    performAction(state, { actorId: 'B', abilityId: 'bless', targetId: 'A' }, seq([]));
    const first = zap(state, 'A', [1, 1]);
    expect(ofType(first, 'statusExpired')).toHaveLength(0);
    expect(getCombatant(state, 'A').statuses[0].remaining).toBe(1);
    claw(state, [1]);
    zap(state, 'B', [1, 1]);
    const second = zap(state, 'A', [1, 1]);
    expect(ofType(second, 'statusExpired')).toEqual([{ type: 'statusExpired', targetId: 'A', status: 'blessed' }]);
  });

  it('un estado sobre uno mismo pierde 1 en ese mismo turno', () => {
    const { state } = setup({});
    getCombatant(state, 'skeleton-1').hp = 100;
    const first = performAction(state, { actorId: 'A', abilityId: 'guard', targetId: 'A' }, seq([]));
    expect(ofType(first, 'statusExpired')).toHaveLength(0);
    expect(getCombatant(state, 'A').statuses[0].remaining).toBe(1);
    zap(state, 'B', [1, 1]);
    claw(state, [1]);
    const second = zap(state, 'A', [1, 1]);
    expect(ofType(second, 'statusExpired')).toEqual([{ type: 'statusExpired', targetId: 'A', status: 'shielded' }]);
  });
});

describe('orden de turnos', () => {
  it('salta a los caídos y cuenta las rondas', () => {
    const { state, events } = setup({});
    expect(events[1]).toMatchObject({ actorId: 'A', round: 1 });
    const b = getCombatant(state, 'B');
    b.hp = 0;
    b.downed = true;
    getCombatant(state, 'skeleton-1').hp = 100;
    const afterA = zap(state, 'A', [1, 1]);
    expect(last(afterA)).toEqual({ type: 'turnStarted', actorId: 'skeleton-1', round: 1 });
    const afterEnemy = claw(state, [1]);
    expect(last(afterEnemy)).toEqual({ type: 'turnStarted', actorId: 'A', round: 2 });
  });
});

describe('invocación', () => {
  it('asigna ids y nombres y añade al final del orden', () => {
    const { state } = setup({ heroes: [HERO_A], enemyIds: ['cultist', 'skeleton'], init: [10, 20, 1] });
    expect(state.combatants.map((c) => c.id)).toEqual(['A', 'cultist-1', 'skeleton-2']);
    const events = performAction(state, { actorId: 'cultist-1', abilityId: 'raise' }, seq([]));
    expect(ofType(events, 'summoned')[0]).toMatchObject({ combatantId: 'skeleton-3', defId: 'skeleton' });
    expect(getCombatant(state, 'skeleton-3').name).toBe('Esqueleto B');
    expect(state.order[state.order.length - 1]).toBe('skeleton-3');
  });

  it('falla con 4 enemigos vivos', () => {
    const { state } = setup({
      heroes: [HERO_A],
      enemyIds: ['cultist', 'skeleton', 'skeleton', 'skeleton'],
      init: [10, 20, 1, 1, 1],
    });
    const events = performAction(state, { actorId: 'cultist-1', abilityId: 'raise' }, seq([]));
    expect(ofType(events, 'summonFailed')).toHaveLength(1);
    expect(state.combatants).toHaveLength(5);
  });
});

describe('intenciones inválidas', () => {
  it('lanzan un error', () => {
    const { state } = setup({ fate: fate3() });
    expect(() => claw(state, [1])).toThrow();
    expect(() => performAction(state, { actorId: 'A', abilityId: 'strike', targetId: 'B' }, seq([1]))).toThrow();
    expect(() => performAction(state, { actorId: 'A', abilityId: 'strike' }, seq([1]))).toThrow();
    expect(() => spendFateDie(state, seq([1]))).toThrow();
    expect(() => declineFate(state)).toThrow();
    strike(state, [5]);
    expect(state.pending).not.toBeNull();
    expect(() => strike(state, [12, 5])).toThrow();
  });
});

describe('IA enemiga', () => {
  it('lowestHp elige al primero en caso de empate', () => {
    const { state } = setup({ init: [10, 10, 20] });
    getCombatant(state, 'A').hp = 10;
    getCombatant(state, 'B').hp = 10;
    expect(chooseEnemyIntent(state, seq([]))).toEqual({
      actorId: 'skeleton-1',
      abilityId: 'claw',
      targetId: 'A',
    });
  });

  it('random elige según el RNG', () => {
    const { state } = setup({ enemyIds: ['rat'], init: [10, 10, 20] });
    expect(chooseEnemyIntent(state, seq([1])).targetId).toBe('B');
  });

  it('summoner invoca y luego ataca al más débil', () => {
    const { state } = setup({ enemyIds: ['cultist'], init: [10, 10, 20] });
    getCombatant(state, 'B').hp = 5;
    expect(chooseEnemyIntent(state, seq([]))).toEqual({ actorId: 'cultist-1', abilityId: 'raise' });
    runEnemyTurn(state, seq([]));
    state.turnIndex = state.order.indexOf('cultist-1');
    expect(chooseEnemyIntent(state, seq([]))).toEqual({
      actorId: 'cultist-1',
      abilityId: 'claw',
      targetId: 'B',
    });
  });

  it('ashenKing alterna ataque, área e invocación', () => {
    const { state } = setup({ heroes: [HERO_A, HERO_B, HERO_C], enemyIds: ['king'], init: [10, 10, 10, 20] });
    getCombatant(state, 'C').hp = 5;
    const king = getCombatant(state, 'king-1');
    expect(chooseEnemyIntent(state, seq([]))).toEqual({ actorId: 'king-1', abilityId: 'strike', targetId: 'C' });
    king.turnsTaken = 1;
    expect(chooseEnemyIntent(state, seq([]))).toEqual({ actorId: 'king-1', abilityId: 'wave' });
    king.hp = 30;
    expect(chooseEnemyIntent(state, seq([]))).toEqual({ actorId: 'king-1', abilityId: 'call' });
  });

  it('runEnemyTurn lanza si el activo es un héroe', () => {
    const { state } = setup({});
    expect(() => runEnemyTurn(state, seq([]))).toThrow();
  });
});
