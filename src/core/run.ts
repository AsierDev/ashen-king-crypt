import { createCombat, createCombatant } from './combat';
import type { Rng } from './rng';
import type {
  AbilityDef,
  CombatEvent,
  CombatState,
  EnemyDef,
  FatePool,
  HeroDef,
} from './types';

export interface EncounterDef {
  id: string;
  title: string;
  enemyIds: string[];
  isBoss: boolean;
}

export type RewardEffect =
  | { kind: 'attackBonus'; heroId: string; amount: number }
  | { kind: 'damageBonus'; heroId: string; amount: number }
  | { kind: 'ac'; heroId: string; amount: number }
  | { kind: 'maxHp'; heroId: string; amount: number }
  | { kind: 'fateMax'; amount: number }
  | { kind: 'healAll'; amount: number };

export interface RewardDef {
  id: string;
  name: string;
  description: string;
  effects: RewardEffect[];
}

export interface LevelDef {
  level: number;
  xp: number;
  summary: string;
  effects: RewardEffect[];
}

export interface Campaign {
  heroes: HeroDef[];
  enemies: EnemyDef[];
  abilities: AbilityDef[];
  encounters: EncounterDef[];
  rewards: RewardDef[];
  fateStart: { max: number; sides: number };
  xpPerEncounter: number;
  levels: LevelDef[];
}

export interface HeroProgress {
  heroId: string;
  hp: number;
  maxHp: number;
  attackBonus: number;
  damageBonus: number;
  ac: number;
}

export interface RunState {
  heroes: HeroProgress[];
  fate: FatePool;
  encounterIndex: number;
  xp: number;
  level: number;
  lastLevelUp: LevelDef | null;
  status: 'inProgress' | 'won' | 'lost';
}

export function createRun(campaign: Campaign): RunState {
  return {
    heroes: campaign.heroes.map((def) => ({
      heroId: def.id,
      hp: def.maxHp,
      maxHp: def.maxHp,
      attackBonus: def.attackBonus,
      damageBonus: 0,
      ac: def.ac,
    })),
    fate: {
      current: campaign.fateStart.max,
      max: campaign.fateStart.max,
      sides: campaign.fateStart.sides,
    },
    encounterIndex: 0,
    xp: 0,
    level: 1,
    lastLevelUp: null,
    status: 'inProgress',
  };
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export function startEncounter(
  run: RunState,
  campaign: Campaign,
  rng: Rng,
): { combat: CombatState; events: CombatEvent[] } {
  const abilities = indexById(campaign.abilities);
  const heroes = campaign.heroes.map((def) => {
    const combatant = createCombatant(def, 'hero', def.id, def.name, abilities);
    const progress = run.heroes.find((p) => p.heroId === def.id);
    if (!progress) throw new Error(`no progress for hero: ${def.id}`);
    combatant.hp = progress.hp;
    combatant.maxHp = progress.maxHp;
    combatant.attackBonus = progress.attackBonus;
    combatant.damageBonus = progress.damageBonus;
    combatant.ac = progress.ac;
    return combatant;
  });
  const { state, events } = createCombat(
    {
      heroes,
      enemyIds: campaign.encounters[run.encounterIndex].enemyIds,
      fate: run.fate,
      abilities,
      enemyDefs: indexById(campaign.enemies),
    },
    rng,
  );
  return { combat: state, events };
}

export function finishEncounter(run: RunState, combat: CombatState, campaign: Campaign): void {
  if (combat.result === null) throw new Error('combat has not ended');
  if (combat.result === 'defeat') {
    run.status = 'lost';
    return;
  }
  for (const progress of run.heroes) {
    const combatant = combat.combatants.find((c) => c.id === progress.heroId);
    if (!combatant) throw new Error(`hero not in combat: ${progress.heroId}`);
    progress.hp = combatant.downed || combatant.hp <= 0 ? 1 : combatant.hp;
  }
  if (campaign.encounters[run.encounterIndex].isBoss) {
    run.status = 'won';
  } else {
    gainXp(run, campaign);
    run.encounterIndex++;
  }
}

export function gainXp(run: RunState, campaign: Campaign): void {
  run.xp += campaign.xpPerEncounter;
  run.lastLevelUp = null;
  for (const def of campaign.levels) {
    if (def.level > run.level && run.xp >= def.xp) {
      applyEffects(run, def.effects);
      run.level = def.level;
      run.lastLevelUp = def;
    }
  }
}

export function nextLevelXp(run: RunState, campaign: Campaign): number | null {
  const next = campaign.levels.find((def) => def.level > run.level);
  return next ? next.xp : null;
}

export function applyRest(run: RunState): void {
  for (const hero of run.heroes) hero.hp = hero.maxHp;
  run.fate.current = run.fate.max;
}

export function rollRewardOffer(_run: RunState, campaign: Campaign, rng: Rng): [RewardDef, RewardDef] {
  const n = campaign.rewards.length;
  const i = rng.int(0, n - 1);
  let j = rng.int(0, n - 2);
  if (j >= i) j++;
  return [campaign.rewards[i], campaign.rewards[j]];
}

function heroProgress(run: RunState, heroId: string): HeroProgress {
  const hero = run.heroes.find((h) => h.heroId === heroId);
  if (!hero) throw new Error(`unknown hero: ${heroId}`);
  return hero;
}

export function applyReward(run: RunState, reward: RewardDef): void {
  applyEffects(run, reward.effects);
}

function applyEffects(run: RunState, effects: RewardEffect[]): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'attackBonus':
        heroProgress(run, effect.heroId).attackBonus += effect.amount;
        break;
      case 'damageBonus':
        heroProgress(run, effect.heroId).damageBonus += effect.amount;
        break;
      case 'ac':
        heroProgress(run, effect.heroId).ac += effect.amount;
        break;
      case 'maxHp': {
        const hero = heroProgress(run, effect.heroId);
        hero.maxHp += effect.amount;
        hero.hp += effect.amount;
        break;
      }
      case 'fateMax':
        run.fate.max += effect.amount;
        run.fate.current += effect.amount;
        break;
      case 'healAll':
        for (const hero of run.heroes) hero.hp = Math.min(hero.maxHp, hero.hp + effect.amount);
        break;
    }
  }
}
