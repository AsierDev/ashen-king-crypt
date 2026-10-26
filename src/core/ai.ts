import { MAX_ENEMIES, getActive, isHindered, performAction } from './combat';
import type { Rng } from './rng';
import type { AbilityDef, ActionIntent, CombatEvent, CombatState, CombatantState } from './types';

export const FOCUS_CHANCE = 60;

function mostWounded(heroes: CombatantState[]): CombatantState {
  return heroes.reduce((best, c) => (c.hp * best.maxHp < best.hp * c.maxHp ? c : best), heroes[0]);
}

function pickTarget(heroes: CombatantState[], rng: Rng, preferHindered = false): CombatantState {
  if (heroes.length === 1) return heroes[0];
  const hindered = heroes.filter(isHindered);
  if (preferHindered && hindered.length > 0) return mostWounded(hindered);
  if (rng.int(1, 100) <= FOCUS_CHANCE) return mostWounded(heroes);
  return heroes[rng.int(0, heroes.length - 1)];
}

export function chooseEnemyIntent(state: CombatState, rng: Rng): ActionIntent {
  const actor = getActive(state);
  const primary = actor.abilityIds[0];
  const aliveHeroes = state.combatants.filter((c) => c.side === 'hero' && !c.downed);
  const aliveEnemies = state.combatants.filter((c) => c.side === 'enemy' && !c.downed).length;
  const attackTarget = (preferHindered = false): ActionIntent => ({
    actorId: actor.id,
    abilityId: primary,
    targetId: pickTarget(aliveHeroes, rng, preferHindered).id,
  });

  const usable = (ability: AbilityDef): boolean => (actor.usesLeft[ability.id] ?? 1) > 0;
  const findAbility = (predicate: (a: AbilityDef) => boolean): AbilityDef | undefined =>
    actor.abilityIds.map((id) => state.abilities[id]).find((a) => predicate(a) && usable(a));
  const summonAbility = (): AbilityDef | undefined => findAbility((a) => a.summon !== undefined);
  const allies = state.combatants.filter((c) => c.side === actor.side && !c.downed);

  switch (actor.aiProfile) {
    case 'random':
      return {
        actorId: actor.id,
        abilityId: primary,
        targetId: aliveHeroes[rng.int(0, aliveHeroes.length - 1)].id,
      };
    case 'lowestHp':
      return attackTarget(true);
    case 'summoner': {
      const summon = summonAbility();
      if (summon && aliveEnemies < MAX_ENEMIES) return selfIntent(actor, summon);
      const shield = findAbility((a) => a.target === 'singleAlly' && a.applyStatus?.status === 'shielded');
      const unshielded = allies.filter((c) => !c.statuses.some((st) => st.status === 'shielded'));
      if (shield && unshielded.length > 0) {
        const ward = unshielded.reduce((best, c) => (c.maxHp > best.maxHp ? c : best));
        return { actorId: actor.id, abilityId: shield.id, targetId: ward.id };
      }
      return attackTarget();
    }
    case 'knight': {
      const crush = findAbility((a) => a.target === 'singleEnemy' && a.applyStatus?.status === 'weakened');
      const fresh = aliveHeroes.filter((c) => !isHindered(c));
      if (crush && fresh.length > 0) {
        return { actorId: actor.id, abilityId: crush.id, targetId: pickTarget(fresh, rng).id };
      }
      return attackTarget(true);
    }
    case 'ashenKing': {
      const cleanse = findAbility((a) => a.cleansesSelf === true);
      if (cleanse && isHindered(actor)) return { actorId: actor.id, abilityId: cleanse.id };
      const summon = summonAbility();
      if (summon && actor.hp <= Math.floor(actor.maxHp / 2) && aliveEnemies < MAX_ENEMIES) {
        return selfIntent(actor, summon);
      }
      const area = findAbility((a) => a.target === 'allEnemies');
      if (area && aliveHeroes.length >= 2 && actor.turnsTaken % 2 === 1) {
        return { actorId: actor.id, abilityId: area.id };
      }
      return attackTarget();
    }
    default:
      return attackTarget();
  }
}

function selfIntent(actor: CombatantState, ability: AbilityDef): ActionIntent {
  return { actorId: actor.id, abilityId: ability.id };
}

export function runEnemyTurn(state: CombatState, rng: Rng): CombatEvent[] {
  if (getActive(state).side !== 'enemy') throw new Error('active combatant is not an enemy');
  return performAction(state, chooseEnemyIntent(state, rng), rng);
}
