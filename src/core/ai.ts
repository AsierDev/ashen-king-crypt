import { MAX_ENEMIES, getActive, performAction } from './combat';
import type { Rng } from './rng';
import type { AbilityDef, ActionIntent, CombatEvent, CombatState, CombatantState } from './types';

export function chooseEnemyIntent(state: CombatState, rng: Rng): ActionIntent {
  const actor = getActive(state);
  const primary = actor.abilityIds[0];
  const aliveHeroes = state.combatants.filter((c) => c.side === 'hero' && !c.downed);
  const aliveEnemies = state.combatants.filter((c) => c.side === 'enemy' && !c.downed).length;
  const lowest = aliveHeroes.reduce((best, c) => (c.hp < best.hp ? c : best), aliveHeroes[0]);
  const attackLowest: ActionIntent = { actorId: actor.id, abilityId: primary, targetId: lowest.id };

  const usable = (ability: AbilityDef): boolean => (actor.usesLeft[ability.id] ?? 1) > 0;
  const findAbility = (predicate: (a: AbilityDef) => boolean): AbilityDef | undefined =>
    actor.abilityIds.map((id) => state.abilities[id]).find((a) => predicate(a) && usable(a));
  const summonAbility = (): AbilityDef | undefined => findAbility((a) => a.summon !== undefined);

  switch (actor.aiProfile) {
    case 'random':
      return { ...attackLowest, targetId: aliveHeroes[rng.int(0, aliveHeroes.length - 1)].id };
    case 'summoner': {
      const summon = summonAbility();
      if (summon && aliveEnemies < MAX_ENEMIES) return selfIntent(actor, summon);
      return attackLowest;
    }
    case 'ashenKing': {
      const summon = summonAbility();
      if (summon && actor.hp <= Math.floor(actor.maxHp / 2) && aliveEnemies < MAX_ENEMIES) {
        return selfIntent(actor, summon);
      }
      const area = findAbility((a) => a.target === 'allEnemies');
      if (area && aliveHeroes.length >= 2 && actor.turnsTaken % 2 === 1) {
        return { actorId: actor.id, abilityId: area.id };
      }
      return attackLowest;
    }
    default:
      return attackLowest;
  }
}

function selfIntent(actor: CombatantState, ability: AbilityDef): ActionIntent {
  return { actorId: actor.id, abilityId: ability.id };
}

export function runEnemyTurn(state: CombatState, rng: Rng): CombatEvent[] {
  if (getActive(state).side !== 'enemy') throw new Error('active combatant is not an enemy');
  return performAction(state, chooseEnemyIntent(state, rng), rng);
}
