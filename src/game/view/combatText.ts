import { STATUS_LABELS, TEXTS, fill } from '../../content/texts';
import { getCombatant } from '../../core/combat';
import type { AbilityDef, AttackOutcome, CombatEvent, CombatState } from '../../core/types';

const OUTCOME_TEXT: Record<AttackOutcome, string> = {
  hit: '¡Impacto!',
  crit: '¡CRÍTICO!',
  miss: 'Fallo.',
  fumble: '¡Pifia!',
};

function nameOf(state: CombatState, id: string): string {
  return getCombatant(state, id).name;
}

function abilityName(state: CombatState, id: string): string {
  return state.abilities[id]?.name ?? id;
}

export function formatEvent(e: CombatEvent, state: CombatState): string | null {
  switch (e.type) {
    case 'initiativeRolled':
      return `Iniciativa: ${e.entries.map((entry) => `${nameOf(state, entry.id)} ${entry.total}`).join(', ')}.`;
    case 'turnStarted':
      return null;
    case 'abilityUsed': {
      const actor = nameOf(state, e.actorId);
      const ability = abilityName(state, e.abilityId);
      if (e.targetIds.length === 1 && e.targetIds[0] !== e.actorId) {
        return `${actor} usa ${ability} sobre ${nameOf(state, e.targetIds[0])}.`;
      }
      return `${actor} usa ${ability}.`;
    }
    case 'sneakAttack':
      return `¡Golpe furtivo de ${nameOf(state, e.actorId)} contra ${nameOf(state, e.targetId)}!`;
    case 'attackRolled': {
      const prefix =
        e.mode === 'normal'
          ? 'd20'
          : `d20 (${e.mode === 'advantage' ? 'ventaja' : 'desventaja'} ${e.rolls[0]}/${e.rolls[1]})`;
      return `${prefix}: ${e.kept} + ${e.bonus} = ${e.total} contra CA ${e.targetAc}: ${OUTCOME_TEXT[e.outcome]}`;
    }
    case 'fateDieSpent':
      if (e.stage === 'attack') {
        return `Dado de Destino: +${e.value} = ${e.total} contra CA ${e.targetAc}: ${OUTCOME_TEXT[e.outcome]} (quedan ${e.remaining})`;
      }
      return `Dado de Destino: +${e.value} = ${e.total} (quedan ${e.remaining})`;
    case 'damageDealt':
      return `${nameOf(state, e.targetId)} recibe ${e.amount} de daño${e.crit ? ' crítico' : ''}.`;
    case 'healed':
      return e.revived
        ? `${nameOf(state, e.targetId)} se levanta y recupera ${e.amount} PG.`
        : `${nameOf(state, e.targetId)} recupera ${e.amount} PG.`;
    case 'statusApplied': {
      const label = STATUS_LABELS[e.status];
      const verb = label.positive ? 'gana' : 'sufre';
      const turns = e.duration === 1 ? 'turno' : 'turnos';
      return `${nameOf(state, e.targetId)} ${verb} ${label.name} (${e.duration} ${turns}): ${label.effect}.`;
    }
    case 'statusExpired':
      return `${nameOf(state, e.targetId)} pierde ${STATUS_LABELS[e.status].name}.`;
    case 'combatantDowned':
      return `${nameOf(state, e.targetId)} cae.`;
    case 'summoned':
      return `${nameOf(state, e.actorId)} alza a ${nameOf(state, e.combatantId)}.`;
    case 'summonFailed':
      return `${nameOf(state, e.actorId)} intenta invocar, pero no hay sitio.`;
    case 'combatEnded':
      return e.result === 'victory' ? TEXTS.labels.victoryTitle : 'El grupo ha caído.';
  }
}

export function formatAbilityButton(ability: AbilityDef, usesLeft?: number): string {
  const area = ability.target === 'allEnemies' ? ` ${TEXTS.labels.areaTag}` : '';
  return usesLeft !== undefined ? `${ability.name}${area} (${usesLeft})` : `${ability.name}${area}`;
}

export function formatAbilityPrompt(ability: AbilityDef): string {
  const base = `${ability.name}: ${ability.description}`;
  return ability.target === 'singleEnemy' || ability.target === 'singleAlly'
    ? `${base} ${TEXTS.labels.chooseTarget}`
    : base;
}

export function formatFatePrompt(state: CombatState): string {
  const pending = state.pending;
  if (!pending) throw new Error('no pending roll');
  const target = getCombatant(state, pending.targetId);
  const vars = { sides: state.fate.sides, current: state.fate.current };
  switch (pending.stage) {
    case 'attack':
      return fill('Fallo por {miss}. ¿Gastar un Dado de Destino (d{sides})? Quedan {current}.', {
        ...vars,
        miss: pending.targetAc - pending.total,
      });
    case 'damage':
      return fill(
        'Daño: {total} ({name} tiene {hp} PG). ¿Sumar un Dado de Destino (d{sides})? Quedan {current}.',
        { ...vars, total: pending.total, name: target.name, hp: target.hp },
      );
    case 'heal':
      return fill(
        'Curación: {total} ({name} {hp}/{maxHp} PG). ¿Sumar un Dado de Destino (d{sides})? Quedan {current}.',
        { ...vars, total: pending.total, name: target.name, hp: target.hp, maxHp: target.maxHp },
      );
  }
}

export function formatTurnOrder(state: CombatState): string {
  const active = state.order[state.turnIndex];
  const names = state.order
    .filter((id) => !getCombatant(state, id).downed)
    .map((id) => (id === active ? `[${nameOf(state, id)}]` : nameOf(state, id)));
  return `Ronda ${state.round}: ${names.join(' > ')}`;
}

export function formatHeroStatus(c: { name: string; hp: number; maxHp: number }): string {
  return `${c.name} ${TEXTS.labels.hp} ${c.hp}/${c.maxHp}`;
}
