import { rollD20, rollDice, rollDie } from './dice';
import type { Rng } from './rng';
import type {
  AbilityDef,
  ActionIntent,
  CombatEvent,
  CombatState,
  CombatantState,
  EnemyDef,
  FatePool,
  FateStage,
  HeroDef,
  RollMode,
  Side,
} from './types';

export const MAX_ENEMIES = 4;
export const SHIELD_AC_BONUS = 4;

const NAME_SUFFIXES = 'ABCDEFGH';

interface ActionContext {
  actorId: string;
  abilityId: string;
  targetId: string;
  crit: boolean;
}

type ResolveStage = 'attack' | 'damage' | 'heal' | 'effects';

const missingRng: Rng = {
  next: () => {
    throw new Error('rng not provided');
  },
  int: () => {
    throw new Error('rng not provided');
  },
};

export function createCombatant(
  def: HeroDef | EnemyDef,
  side: Side,
  id: string,
  name: string,
  abilities: Record<string, AbilityDef>,
): CombatantState {
  const usesLeft: Record<string, number> = {};
  for (const abilityId of def.abilityIds) {
    const uses = abilities[abilityId]?.usesPerCombat;
    if (uses !== undefined) usesLeft[abilityId] = uses;
  }
  const combatant: CombatantState = {
    id,
    defId: def.id,
    side,
    name,
    hp: def.maxHp,
    maxHp: def.maxHp,
    ac: def.ac,
    attackBonus: def.attackBonus,
    damageBonus: 0,
    initiativeBonus: def.initiativeBonus,
    abilityIds: [...def.abilityIds],
    usesLeft,
    statuses: [],
    downed: false,
    turnsTaken: 0,
  };
  if ('aiProfile' in def) combatant.aiProfile = def.aiProfile;
  return combatant;
}

export function spawnEnemy(state: CombatState, defId: string): CombatantState {
  const def = state.enemyDefs[defId];
  if (!def) throw new Error(`unknown enemy def: ${defId}`);
  const id = `${defId}-${state.nextEnemySerial++}`;
  const existing = state.combatants.filter((c) => c.defId === defId).length;
  const name = def.unique ? def.name : `${def.name} ${NAME_SUFFIXES[existing]}`;
  const enemy = createCombatant(def, 'enemy', id, name, state.abilities);
  state.combatants.push(enemy);
  return enemy;
}

export function createCombat(
  params: {
    heroes: CombatantState[];
    enemyIds: string[];
    fate: FatePool;
    abilities: Record<string, AbilityDef>;
    enemyDefs: Record<string, EnemyDef>;
  },
  rng: Rng,
): { state: CombatState; events: CombatEvent[] } {
  const state: CombatState = {
    combatants: [...params.heroes],
    order: [],
    turnIndex: 0,
    round: 1,
    fate: params.fate,
    pending: null,
    result: null,
    abilities: params.abilities,
    enemyDefs: params.enemyDefs,
    nextEnemySerial: 1,
  };
  for (const enemyId of params.enemyIds) spawnEnemy(state, enemyId);

  const entries = state.combatants.map((c, index) => {
    const roll = rollDie(rng, 20);
    return { c, index, roll, total: roll + c.initiativeBonus };
  });
  entries.sort(
    (a, b) =>
      b.total - a.total ||
      b.c.initiativeBonus - a.c.initiativeBonus ||
      (a.c.side === b.c.side ? 0 : a.c.side === 'hero' ? -1 : 1) ||
      a.index - b.index,
  );
  state.order = entries.map((e) => e.c.id);
  state.turnIndex = state.order.findIndex((id) => !getCombatant(state, id).downed);

  const events: CombatEvent[] = [
    {
      type: 'initiativeRolled',
      entries: entries.map((e) => ({ id: e.c.id, roll: e.roll, total: e.total })),
    },
    { type: 'turnStarted', actorId: state.order[state.turnIndex], round: 1 },
  ];
  return { state, events };
}

export function getActive(state: CombatState): CombatantState {
  return getCombatant(state, state.order[state.turnIndex]);
}

export function getCombatant(state: CombatState, id: string): CombatantState {
  const combatant = state.combatants.find((c) => c.id === id);
  if (!combatant) throw new Error(`unknown combatant: ${id}`);
  return combatant;
}

function hasStatus(c: CombatantState, status: 'blessed' | 'weakened' | 'shielded'): boolean {
  return c.statuses.some((s) => s.status === status);
}

export function rollModeFor(c: CombatantState): RollMode {
  const blessed = hasStatus(c, 'blessed');
  const weakened = hasStatus(c, 'weakened');
  if (blessed === weakened) return 'normal';
  return blessed ? 'advantage' : 'disadvantage';
}

export function effectiveAc(c: CombatantState): number {
  return c.ac + (hasStatus(c, 'shielded') ? SHIELD_AC_BONUS : 0);
}

export function getValidTargets(state: CombatState, actorId: string, abilityId: string): string[] {
  const actor = getCombatant(state, actorId);
  const ability = state.abilities[abilityId];
  if (!ability) throw new Error(`unknown ability: ${abilityId}`);
  switch (ability.target) {
    case 'self':
      return [actorId];
    case 'singleEnemy':
    case 'allEnemies':
      return state.combatants.filter((c) => c.side !== actor.side && !c.downed).map((c) => c.id);
    case 'singleAlly':
      return state.combatants
        .filter((c) => c.side === actor.side && (!c.downed || ability.canRevive === true))
        .map((c) => c.id);
  }
}

export function getAvailableAbilities(state: CombatState, actorId: string): AbilityDef[] {
  const actor = getCombatant(state, actorId);
  return actor.abilityIds
    .filter((id) => actor.usesLeft[id] === undefined || actor.usesLeft[id] > 0)
    .map((id) => state.abilities[id])
    .filter((ability) => ability !== undefined && getValidTargets(state, actorId, ability.id).length > 0);
}

export function canOfferFate(
  state: CombatState,
  actor: CombatantState,
  stage: FateStage,
  total: number,
  target: CombatantState,
): boolean {
  if (actor.side !== 'hero' || state.fate.current <= 0) return false;
  switch (stage) {
    case 'attack':
      return effectiveAc(target) - total <= state.fate.current * state.fate.sides;
    case 'damage':
      return total < target.hp;
    case 'heal':
      return target.hp + total < target.maxHp;
  }
}

export function performAction(state: CombatState, intent: ActionIntent, rng: Rng): CombatEvent[] {
  if (state.result !== null) throw new Error('combat already ended');
  if (state.pending !== null) throw new Error('a fate decision is pending');
  const actor = getActive(state);
  if (actor.id !== intent.actorId) throw new Error(`not the active combatant: ${intent.actorId}`);
  const ability = getAvailableAbilities(state, actor.id).find((a) => a.id === intent.abilityId);
  if (!ability) throw new Error(`ability not available: ${intent.abilityId}`);
  const validTargets = getValidTargets(state, actor.id, ability.id);
  const isSingle = ability.target === 'singleEnemy' || ability.target === 'singleAlly';
  if (isSingle && (intent.targetId === undefined || !validTargets.includes(intent.targetId))) {
    throw new Error(`invalid target: ${intent.targetId}`);
  }
  if (ability.roll === 'attack' && ability.target !== 'singleEnemy') {
    throw new Error(`attack ability must target a single enemy: ${ability.id}`);
  }

  if (actor.usesLeft[ability.id] !== undefined) actor.usesLeft[ability.id]--;

  const targetIds = isSingle ? [intent.targetId as string] : ability.target === 'self' ? [actor.id] : validTargets;
  const events: CombatEvent[] = [
    { type: 'abilityUsed', actorId: actor.id, abilityId: ability.id, targetIds },
  ];

  if (isSingle) {
    const ctx: ActionContext = {
      actorId: actor.id,
      abilityId: ability.id,
      targetId: targetIds[0],
      crit: false,
    };
    resolveSingle(state, ctx, ability.roll === 'attack' ? 'attack' : 'damage', rng, events);
    return events;
  }

  for (const targetId of targetIds) {
    const target = getCombatant(state, targetId);
    if (ability.damage) {
      applyDamage(target, rollDice(rng, ability.damage).total + actor.damageBonus, false, events);
    }
    if (ability.heal) applyHeal(target, rollDice(rng, ability.heal).total, events);
    applyStatus(target, ability, events);
    if (ability.summon) applySummon(state, actor, ability, events);
  }
  endTurn(state, events);
  return events;
}

function resolveSingle(
  state: CombatState,
  ctx: ActionContext,
  startStage: ResolveStage,
  rng: Rng,
  events: CombatEvent[],
): void {
  const actor = getCombatant(state, ctx.actorId);
  const target = getCombatant(state, ctx.targetId);
  const ability = state.abilities[ctx.abilityId];
  let stage = startStage;

  if (stage === 'attack') {
    const mode = rollModeFor(actor);
    const { rolls, kept } = rollD20(rng, mode);
    const total = kept + actor.attackBonus;
    const targetAc = effectiveAc(target);
    const outcome = kept === 20 ? 'crit' : kept === 1 ? 'fumble' : total >= targetAc ? 'hit' : 'miss';
    events.push({
      type: 'attackRolled',
      actorId: actor.id,
      targetId: target.id,
      mode,
      rolls,
      kept,
      bonus: actor.attackBonus,
      total,
      targetAc,
      outcome,
    });
    if (outcome === 'miss' && canOfferFate(state, actor, 'attack', total, target)) {
      state.pending = {
        stage: 'attack',
        actorId: actor.id,
        abilityId: ability.id,
        targetId: target.id,
        total,
        targetAc,
        crit: false,
      };
      return;
    }
    if (outcome === 'miss' || outcome === 'fumble') {
      endTurn(state, events);
      return;
    }
    ctx.crit = outcome === 'crit';
    stage = 'damage';
  }

  if (stage === 'damage') {
    if (ability.damage) {
      const total = rollDice(rng, ability.damage, ctx.crit).total + actor.damageBonus;
      if (canOfferFate(state, actor, 'damage', total, target)) {
        state.pending = {
          stage: 'damage',
          actorId: actor.id,
          abilityId: ability.id,
          targetId: target.id,
          total,
          targetAc: 0,
          crit: ctx.crit,
        };
        return;
      }
      applyDamage(target, total, ctx.crit, events);
    }
    stage = 'heal';
  }

  if (stage === 'heal') {
    if (ability.heal) {
      const total = rollDice(rng, ability.heal).total;
      if (canOfferFate(state, actor, 'heal', total, target)) {
        state.pending = {
          stage: 'heal',
          actorId: actor.id,
          abilityId: ability.id,
          targetId: target.id,
          total,
          targetAc: 0,
          crit: false,
        };
        return;
      }
      applyHeal(target, total, events);
    }
  }

  if (!target.downed) applyStatus(target, ability, events);
  endTurn(state, events);
}

function contextOf(pending: NonNullable<CombatState['pending']>): ActionContext {
  return {
    actorId: pending.actorId,
    abilityId: pending.abilityId,
    targetId: pending.targetId,
    crit: pending.crit,
  };
}

export function spendFateDie(state: CombatState, rng: Rng): CombatEvent[] {
  const pending = state.pending;
  if (pending === null) throw new Error('no pending fate decision');
  if (state.fate.current === 0) throw new Error('no fate dice left');
  const actor = getCombatant(state, pending.actorId);
  const target = getCombatant(state, pending.targetId);
  const events: CombatEvent[] = [];

  const value = rollDie(rng, state.fate.sides);
  state.fate.current--;
  pending.total += value;
  const { total, crit } = pending;
  const remaining = state.fate.current;

  if (pending.stage === 'attack') {
    const outcome = total >= pending.targetAc ? 'hit' : 'miss';
    events.push({
      type: 'fateDieSpent',
      stage: 'attack',
      value,
      total,
      targetAc: pending.targetAc,
      outcome,
      remaining,
    });
    if (outcome === 'miss' && canOfferFate(state, actor, 'attack', total, target)) return events;
    state.pending = null;
    if (outcome === 'hit') resolveSingle(state, { ...contextOf(pending), crit: false }, 'damage', rng, events);
    else endTurn(state, events);
    return events;
  }

  events.push({ type: 'fateDieSpent', stage: pending.stage, value, total, remaining });
  if (canOfferFate(state, actor, pending.stage, total, target)) return events;
  state.pending = null;
  if (pending.stage === 'damage') {
    applyDamage(target, total, crit, events);
    resolveSingle(state, contextOf(pending), 'heal', rng, events);
  } else {
    applyHeal(target, total, events);
    resolveSingle(state, contextOf(pending), 'effects', rng, events);
  }
  return events;
}

export function declineFate(state: CombatState, rng: Rng = missingRng): CombatEvent[] {
  const pending = state.pending;
  if (pending === null) throw new Error('no pending fate decision');
  const target = getCombatant(state, pending.targetId);
  const events: CombatEvent[] = [];
  state.pending = null;
  if (pending.stage === 'attack') {
    endTurn(state, events);
  } else if (pending.stage === 'damage') {
    applyDamage(target, pending.total, pending.crit, events);
    resolveSingle(state, contextOf(pending), 'heal', rng, events);
  } else {
    applyHeal(target, pending.total, events);
    resolveSingle(state, contextOf(pending), 'effects', rng, events);
  }
  return events;
}

function applyDamage(
  target: CombatantState,
  amount: number,
  crit: boolean,
  events: CombatEvent[],
): void {
  target.hp = Math.max(0, target.hp - amount);
  events.push({ type: 'damageDealt', targetId: target.id, amount, hpAfter: target.hp, crit });
  if (target.hp === 0) {
    target.downed = true;
    target.statuses = [];
    events.push({ type: 'combatantDowned', targetId: target.id });
  }
}

function applyHeal(target: CombatantState, amount: number, events: CombatEvent[]): void {
  const revived = target.downed;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  target.downed = false;
  events.push({ type: 'healed', targetId: target.id, amount, hpAfter: target.hp, revived });
}

function applyStatus(target: CombatantState, ability: AbilityDef, events: CombatEvent[]): void {
  if (!ability.applyStatus || target.downed) return;
  const { status, duration } = ability.applyStatus;
  const existing = target.statuses.find((s) => s.status === status);
  if (existing) existing.remaining = Math.max(existing.remaining, duration);
  else target.statuses.push({ status, remaining: duration });
  events.push({ type: 'statusApplied', targetId: target.id, status, duration });
}

function applySummon(state: CombatState, actor: CombatantState, ability: AbilityDef, events: CombatEvent[]): void {
  const summon = ability.summon;
  if (!summon) return;
  for (let i = 0; i < summon.count; i++) {
    const alive = state.combatants.filter((c) => c.side === 'enemy' && !c.downed).length;
    if (alive < MAX_ENEMIES) {
      const spawned = spawnEnemy(state, summon.enemyId);
      state.order.push(spawned.id);
      events.push({ type: 'summoned', actorId: actor.id, combatantId: spawned.id, defId: spawned.defId });
    } else {
      events.push({ type: 'summonFailed', actorId: actor.id });
    }
  }
}

function endTurn(state: CombatState, events: CombatEvent[]): void {
  const actor = getActive(state);
  actor.turnsTaken++;
  if (!actor.downed) {
    for (const instance of actor.statuses) instance.remaining--;
    for (const instance of actor.statuses.filter((s) => s.remaining <= 0)) {
      events.push({ type: 'statusExpired', targetId: actor.id, status: instance.status });
    }
    actor.statuses = actor.statuses.filter((s) => s.remaining > 0);
  }

  const alive = (side: Side): boolean => state.combatants.some((c) => c.side === side && !c.downed);
  if (!alive('enemy')) {
    state.result = 'victory';
    events.push({ type: 'combatEnded', result: 'victory' });
    return;
  }
  if (!alive('hero')) {
    state.result = 'defeat';
    events.push({ type: 'combatEnded', result: 'defeat' });
    return;
  }

  let index = state.turnIndex;
  do {
    index++;
    if (index >= state.order.length) {
      index = 0;
      state.round++;
    }
  } while (getCombatant(state, state.order[index]).downed);
  state.turnIndex = index;
  events.push({ type: 'turnStarted', actorId: state.order[index], round: state.round });
}
