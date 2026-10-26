// Simulación de equilibrio: no corre en `npm test`. Uso: npm run balance
// Referencia (2000 partidas, 2026-10-26; descanso 50 % + 1d6, IA con foco 60 %, 1 Dado de Destino por acción):
//   smart/mixed 69.7 %, naive/mixed 1.2 % (antes del cambio: 70.1 % / 2.6 %). Rey Ceniza maxHp 130.
import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../content/campaign';
import { runEnemyTurn } from './ai';
import {
  declineFate,
  getActive,
  getAvailableAbilities,
  getCombatant,
  getValidTargets,
  performAction,
  spendFateDie,
} from './combat';
import { createRng } from './rng';
import type { Rng } from './rng';
import { applyReward, applyRest, createRun, finishEncounter, rollRewardOffer, startEncounter } from './run';
import type { RewardDef, RunState } from './run';
import type { ActionIntent, CombatState, CombatantState } from './types';

// Solo se ejecuta bajo Vitest (Node); el proyecto no incluye @types/node.
declare const process: { env: Record<string, string | undefined>; stdout: { write(text: string): void } };

type HeroPolicy = 'naive' | 'smart';
type InterludePolicy = 'alwaysRest' | 'neverRest' | 'mixed';

const RUNS = Number(process.env.BALANCE_RUNS ?? 2000);

const alive = (s: CombatState, side: 'hero' | 'enemy') => s.combatants.filter((c) => c.side === side && !c.downed);
const hpRatio = (c: CombatantState) => c.hp / c.maxHp;
const has = (s: CombatState, actor: CombatantState, id: string) =>
  getAvailableAbilities(s, actor.id).some((a) => a.id === id);
const lowest = (cs: CombatantState[]) => [...cs].sort((a, b) => a.hp - b.hp)[0];

export function smartIntent(s: CombatState, actor: CombatantState): ActionIntent {
  const enemies = alive(s, 'enemy');
  const allies = s.combatants.filter((c) => c.side === 'hero');
  const act = (abilityId: string, target?: CombatantState): ActionIntent => ({
    actorId: actor.id,
    abilityId,
    targetId: target?.id,
  });
  const valid = (abilityId: string, t: CombatantState) => getValidTargets(s, actor.id, abilityId).includes(t.id);

  if (actor.defId === 'rogue') {
    const weakened = enemies.filter((c) => c.statuses.some((st) => st.status === 'weakened'));
    if (weakened.length > 0) return act('dagger', lowest(weakened));
    if (enemies.length >= 3 && has(s, actor, 'blindingPowder')) return act('blindingPowder');
    if (has(s, actor, 'hamstring')) {
      const healthiest = enemies.reduce((best, c) => (c.hp > best.hp ? c : best));
      return act('hamstring', healthiest);
    }
    return act('dagger', lowest(enemies));
  }
  if (actor.defId === 'cleric') {
    const downed = allies.find((c) => c.downed);
    if (downed && has(s, actor, 'cureWounds') && valid('cureWounds', downed)) return act('cureWounds', downed);
    const hurt = lowest(allies.filter((c) => !c.downed && hpRatio(c) < 0.45));
    if (hurt && has(s, actor, 'cureWounds')) return act('cureWounds', hurt);
    const warrior = allies.find((c) => c.defId === 'warrior' && !c.downed);
    if (warrior && has(s, actor, 'blessing') && !warrior.statuses.some((st) => st.status === 'blessed'))
      return act('blessing', warrior);
    return act('sacredMace', lowest(enemies));
  }
  if (actor.defId === 'mage') {
    if (enemies.length >= 2 && has(s, actor, 'fireball')) return act('fireball');
    const target = lowest(enemies);
    if (target.hp <= 8 && has(s, actor, 'magicMissile')) return act('magicMissile', target);
    return act('fireBolt', target);
  }
  if (actor.defId === 'warrior') {
    const fragile = lowest(allies.filter((c) => !c.downed && c.id !== actor.id && hpRatio(c) < 0.5));
    if (fragile && enemies.length >= 2 && has(s, actor, 'protect') && !fragile.statuses.some((st) => st.status === 'shielded'))
      return act('protect', fragile);
    const target = lowest(enemies);
    if (has(s, actor, 'brutalStrike') && (target.hp > 9 || enemies.length === 1)) return act('brutalStrike', target);
    return act('slash', target);
  }
  throw new Error(`smartIntent: sin política para ${actor.defId}`);
}

function naiveIntent(s: CombatState, actor: CombatantState): ActionIntent {
  const ability = getAvailableAbilities(s, actor.id)[0];
  return { actorId: actor.id, abilityId: ability.id, targetId: getValidTargets(s, actor.id, ability.id)[0] };
}

function pickReward(run: RunState, offer: [RewardDef, RewardDef]): RewardDef {
  const hurt = run.heroes.some((h) => h.hp / h.maxHp < 0.6);
  const score = (r: RewardDef) =>
    r.id === 'holyWater' ? (hurt ? 5 : 2) : r.id === 'fateMax' ? 4 : r.effects.some((e) => e.kind === 'maxHp') ? 3 : 2;
  return score(offer[0]) >= score(offer[1]) ? offer[0] : offer[1];
}

function interlude(run: RunState, policy: InterludePolicy, rng: Rng): void {
  const offer = rollRewardOffer(run, CAMPAIGN, rng);
  if (policy === 'alwaysRest') return applyRest(run, rng);
  if (policy === 'neverRest') return applyReward(run, pickReward(run, offer));
  const party = run.heroes.reduce((a, h) => a + h.hp, 0) / run.heroes.reduce((a, h) => a + h.maxHp, 0);
  const anyCritical = run.heroes.some((h) => h.hp <= 1 || h.hp / h.maxHp < 0.3);
  if (party < 0.6 || anyCritical || run.fate.current === 0) applyRest(run, rng);
  else applyReward(run, pickReward(run, offer));
}

function playRun(seed: number, hero: HeroPolicy, inter: InterludePolicy) {
  const rng = createRng(seed);
  const run = createRun(CAMPAIGN);
  let reached = 0;
  while (run.status === 'inProgress') {
    reached = run.encounterIndex;
    const { combat } = startEncounter(run, CAMPAIGN, rng);
    let guard = 0;
    while (combat.result === null) {
      if (++guard > 3000) throw new Error(`seed ${seed}: combate sin fin`);
      if (combat.pending) {
        if (hero === 'smart') spendFateDie(combat, rng);
        else declineFate(combat, rng);
        continue;
      }
      const active = getActive(combat);
      if (active.side === 'enemy') runEnemyTurn(combat, rng);
      else performAction(combat, hero === 'smart' ? smartIntent(combat, active) : naiveIntent(combat, active), rng);
    }
    finishEncounter(run, combat, CAMPAIGN);
    if (run.status === 'inProgress') interlude(run, inter, rng);
  }
  return { won: run.status === 'won', diedAt: run.status === 'won' ? -1 : reached };
}

describe.skipIf(!process.env.BALANCE)('balance', () => {
  it('tabla de victorias por política', () => {
    const rows: string[] = [];
    for (const hero of ['naive', 'smart'] as HeroPolicy[]) {
      for (const inter of ['alwaysRest', 'neverRest', 'mixed'] as InterludePolicy[]) {
        let wins = 0;
        const deaths = new Array(CAMPAIGN.encounters.length).fill(0);
        for (let seed = 1; seed <= RUNS; seed++) {
          const r = playRun(seed, hero, inter);
          if (r.won) wins++;
          else deaths[r.diedAt]++;
        }
        rows.push(
          `${hero.padEnd(6)} ${inter.padEnd(10)} victoria ${((100 * wins) / RUNS).toFixed(1).padStart(5)}%  ` +
            `derrotas por combate: ${deaths.map((d, i) => `${CAMPAIGN.encounters[i].id}=${((100 * d) / RUNS).toFixed(1)}%`).join(' ')}`,
        );
      }
    }
    process.stdout.write(`\n${RUNS} partidas por fila\n${rows.join("\n")}\n`);
  });
});

describe('smartIntent', () => {
  it('tiene política para cada héroe de la campaña', () => {
    const { combat } = startEncounter(createRun(CAMPAIGN), CAMPAIGN, createRng(1));
    for (const def of CAMPAIGN.heroes) {
      const intent = smartIntent(combat, getCombatant(combat, def.id));
      expect(def.abilityIds).toContain(intent.abilityId);
    }
  });
});
