import { describe, expect, it } from 'vitest';
import { CAMPAIGN, LEVELS, REWARDS } from '../content/campaign';
import { TEXTS } from '../content/texts';
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
import {
  applyReward,
  applyRest,
  createRun,
  finishEncounter,
  gainXp,
  nextLevelXp,
  rollRewardOffer,
  startEncounter,
} from './run';
import type { RewardDef } from './run';
import { createSequenceRng } from './sequenceRng';
import type { CombatState } from './types';

const reward = (id: string): RewardDef => {
  const found = REWARDS.find((r) => r.id === id);
  if (!found) throw new Error(`unknown reward ${id}`);
  return found;
};

const hero = (run: ReturnType<typeof createRun>, id: string) => run.heroes.find((h) => h.heroId === id)!;

describe('content integrity', () => {
  const abilityIds = new Set(CAMPAIGN.abilities.map((a) => a.id));
  const enemyIds = new Set(CAMPAIGN.enemies.map((e) => e.id));
  const abilityById = (id: string) => CAMPAIGN.abilities.find((a) => a.id === id)!;

  it('references only existing abilities and enemies', () => {
    for (const unit of [...CAMPAIGN.heroes, ...CAMPAIGN.enemies]) {
      for (const id of unit.abilityIds) expect(abilityIds.has(id)).toBe(true);
    }
    for (const encounter of CAMPAIGN.encounters) {
      for (const id of encounter.enemyIds) expect(enemyIds.has(id)).toBe(true);
    }
    for (const ability of CAMPAIGN.abilities) {
      if (ability.summon) expect(enemyIds.has(ability.summon.enemyId)).toBe(true);
    }
  });

  it('gives every enemy an unlimited single-target first ability', () => {
    for (const enemy of CAMPAIGN.enemies) {
      const first = abilityById(enemy.abilityIds[0]);
      expect(first.target).toBe('singleEnemy');
      expect(first.usesPerCombat).toBeUndefined();
    }
  });

  it('keeps ability roll and target rules consistent', () => {
    for (const ability of CAMPAIGN.abilities) {
      if (ability.target === 'allEnemies' || ability.target === 'self') expect(ability.roll).toBe('none');
      if (ability.roll === 'attack') expect(ability.target).toBe('singleEnemy');
    }
  });

  it('defines heroes, encounters and texts', () => {
    expect(CAMPAIGN.heroes).toHaveLength(4);
    expect(CAMPAIGN.encounters).toHaveLength(6);
    expect(CAMPAIGN.encounters.map((e) => e.isBoss)).toEqual([false, false, false, false, false, true]);
    for (const encounter of CAMPAIGN.encounters) {
      expect(TEXTS.encounterIntro[encounter.id]).toBeDefined();
      expect(encounter.enemyIds.length).toBeLessThanOrEqual(4);
    }
  });

  it('defines valid rewards', () => {
    const ids = CAMPAIGN.rewards.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const heroIds = new Set(CAMPAIGN.heroes.map((h) => h.id));
    for (const r of CAMPAIGN.rewards) {
      expect(r.effects.length).toBeGreaterThan(0);
      for (const effect of r.effects) {
        if ('heroId' in effect) expect(heroIds.has(effect.heroId)).toBe(true);
      }
    }
  });
});

describe('createRun', () => {
  it('starts with full health and the initial fate pool', () => {
    const run = createRun(CAMPAIGN);
    expect(run.heroes.map((h) => h.hp)).toEqual([28, 22, 16, 18]);
    expect(run.fate).toEqual({ current: 3, max: 3, sides: 4 });
    expect(run.encounterIndex).toBe(0);
    expect(run.status).toBe('inProgress');
    expect(run).toMatchObject({ xp: 0, level: 1, lastLevelUp: null });
  });
});

describe('startEncounter', () => {
  it('builds the first combat from the run', () => {
    const run = createRun(CAMPAIGN);
    const { combat } = startEncounter(run, CAMPAIGN, createRng(1));
    expect(combat.combatants).toHaveLength(7);
    const enemies = combat.combatants.filter((c) => c.side === 'enemy');
    expect(enemies.map((c) => c.id)).toEqual(['skeleton-1', 'skeleton-2', 'skeleton-3']);
    expect(enemies.map((c) => c.name)).toEqual(['Esqueleto A', 'Esqueleto B', 'Esqueleto C']);
    expect(combat.fate).toBe(run.fate);
  });

  it('applies level bonuses to the combatants', () => {
    const run = createRun(CAMPAIGN);
    run.xp = 100;
    gainXp(run, CAMPAIGN);
    expect(getCombatant(startEncounter(run, CAMPAIGN, createRng(1)).combat, 'warrior').maxHp).toBe(33);
  });

  it('applies permanent upgrades to the combatants', () => {
    const run = createRun(CAMPAIGN);
    applyReward(run, reward('warriorEdge'));
    let warrior = getCombatant(startEncounter(run, CAMPAIGN, createRng(1)).combat, 'warrior');
    expect(warrior.attackBonus).toBe(6);
    expect(warrior.damageBonus).toBe(2);
    applyReward(run, reward('warriorArmor'));
    warrior = getCombatant(startEncounter(run, CAMPAIGN, createRng(1)).combat, 'warrior');
    expect(warrior.ac).toBe(17);
    expect(warrior.maxHp).toBe(34);
    expect(warrior.hp).toBe(34);
  });
});

describe('finishEncounter', () => {
  const endedCombat = (result: 'victory' | 'defeat' | null, run = createRun(CAMPAIGN)) => {
    const { combat } = startEncounter(run, CAMPAIGN, createRng(1));
    combat.result = result;
    return combat;
  };

  it('revives fallen heroes with 1 HP and advances', () => {
    const run = createRun(CAMPAIGN);
    const combat = endedCombat('victory', run);
    const cleric = getCombatant(combat, 'cleric');
    cleric.hp = 0;
    cleric.downed = true;
    getCombatant(combat, 'warrior').hp = 10;
    finishEncounter(run, combat, CAMPAIGN);
    expect(run.heroes.map((h) => h.hp)).toEqual([10, 1, 16, 18]);
    expect(run.encounterIndex).toBe(1);
    expect(run.status).toBe('inProgress');
  });

  it('marks defeat as lost', () => {
    const run = createRun(CAMPAIGN);
    finishEncounter(run, endedCombat('defeat', run), CAMPAIGN);
    expect(run.status).toBe('lost');
  });

  it('wins after the boss encounter', () => {
    const run = createRun(CAMPAIGN);
    run.encounterIndex = CAMPAIGN.encounters.length - 1;
    finishEncounter(run, endedCombat('victory', run), CAMPAIGN);
    expect(run.status).toBe('won');
  });

  const win = (run: ReturnType<typeof createRun>) => finishEncounter(run, endedCombat('victory', run), CAMPAIGN);

  it('grants xp and levels up the party across victories', () => {
    const run = createRun(CAMPAIGN);
    win(run);
    expect(run).toMatchObject({ xp: 100, level: 1, lastLevelUp: null });
    win(run);
    expect(run).toMatchObject({ xp: 200, level: 2 });
    expect(run.lastLevelUp?.level).toBe(2);
    expect(hero(run, 'warrior').maxHp).toBe(33);
    expect(hero(run, 'rogue').maxHp).toBe(22);
    win(run);
    expect(run.lastLevelUp).toBeNull();
    win(run);
    expect(run).toMatchObject({ xp: 400, level: 3 });
    expect(hero(run, 'warrior').attackBonus).toBe(6);
    expect(hero(run, 'mage').maxHp).toBe(19);
    win(run);
    expect(run).toMatchObject({ xp: 500, level: 4 });
    expect(hero(run, 'mage').maxHp).toBe(22);
  });

  it('keeps a fallen cleric at 1 HP plus the level bonus', () => {
    const run = createRun(CAMPAIGN);
    win(run);
    const combat = endedCombat('victory', run);
    const cleric = getCombatant(combat, 'cleric');
    cleric.hp = 0;
    cleric.downed = true;
    finishEncounter(run, combat, CAMPAIGN);
    expect(hero(run, 'cleric')).toMatchObject({ hp: 5, maxHp: 26 });
  });

  it('gives no xp for the boss or a defeat', () => {
    const boss = createRun(CAMPAIGN);
    boss.encounterIndex = CAMPAIGN.encounters.length - 1;
    win(boss);
    expect(boss).toMatchObject({ status: 'won', xp: 0 });
    const lost = createRun(CAMPAIGN);
    finishEncounter(lost, endedCombat('defeat', lost), CAMPAIGN);
    expect(lost.xp).toBe(0);
  });

  it('throws when the combat has not ended', () => {
    const run = createRun(CAMPAIGN);
    expect(() => finishEncounter(run, endedCombat(null, run), CAMPAIGN)).toThrow();
  });
});

describe('nextLevelXp', () => {
  it('returns the xp of the next level or null', () => {
    const run = createRun(CAMPAIGN);
    expect(nextLevelXp(run, CAMPAIGN)).toBe(200);
    run.level = 2;
    expect(nextLevelXp(run, CAMPAIGN)).toBe(400);
    run.level = 3;
    expect(nextLevelXp(run, CAMPAIGN)).toBe(500);
    run.level = 4;
    expect(nextLevelXp(run, CAMPAIGN)).toBeNull();
  });
});

describe('LEVELS', () => {
  it('has increasing levels and xp and valid effects for every hero', () => {
    const heroIds = CAMPAIGN.heroes.map((h) => h.id);
    LEVELS.forEach((def, i) => {
      if (i > 0) {
        expect(def.level).toBeGreaterThan(LEVELS[i - 1].level);
        expect(def.xp).toBeGreaterThan(LEVELS[i - 1].xp);
      }
      for (const id of heroIds) {
        expect(def.effects.some((e) => 'heroId' in e && e.heroId === id)).toBe(true);
      }
      for (const e of def.effects) if ('heroId' in e) expect(heroIds).toContain(e.heroId);
    });
  });
});

describe('applyRest', () => {
  it('heals 50% + 1d6 without exceeding the max and adds 1 fate', () => {
    const run = createRun(CAMPAIGN);
    hero(run, 'warrior').hp = 10;
    hero(run, 'cleric').hp = 1;
    run.fate.current = 0;
    applyRest(run, createSequenceRng([3, 6, 1, 2]));
    expect(run.heroes.map((h) => h.hp)).toEqual([27, 18, 16, 18]);
    expect(run.fate).toEqual({ current: 1, max: 3, sides: 4 });
  });
  it('does not raise fate above the max', () => {
    const run = createRun(CAMPAIGN);
    run.fate.current = 3;
    applyRest(run, createSequenceRng([1, 1, 1, 1]));
    expect(run.fate.current).toBe(3);
  });
  it('rolls one d6 per hero even at full health', () => {
    const run = createRun(CAMPAIGN);
    expect(() => applyRest(run, createSequenceRng([1, 1, 1, 1]))).not.toThrow();
    expect(() => applyRest(createRun(CAMPAIGN), createSequenceRng([1, 1, 1]))).toThrow();
  });
  it('rounds half of the max HP down', () => {
    const run = createRun(CAMPAIGN);
    const warrior = hero(run, 'warrior');
    warrior.maxHp = 33;
    warrior.hp = 1;
    applyRest(run, createSequenceRng([1, 1, 1, 1]));
    expect(warrior.hp).toBe(18);
  });
  it('only attack abilities carry sneak damage', () => {
    for (const ability of CAMPAIGN.abilities) {
      if (ability.sneakDamage === undefined) continue;
      expect(ability.roll).toBe('attack');
      expect(ability.target).toBe('singleEnemy');
    }
  });
});

describe('rollRewardOffer', () => {
  it('picks two distinct rewards', () => {
    const run = createRun(CAMPAIGN);
    expect(rollRewardOffer(run, CAMPAIGN, createSequenceRng([7, 0])).map((r) => r.id)).toEqual([
      'holyWater',
      'warriorEdge',
    ]);
    expect(rollRewardOffer(run, CAMPAIGN, createSequenceRng([2, 2])).map((r) => r.id)).toEqual([
      'mageFocus',
      'warriorArmor',
    ]);
  });
});

describe('applyReward', () => {
  it('adds attack and damage bonuses', () => {
    const run = createRun(CAMPAIGN);
    applyReward(run, reward('warriorEdge'));
    expect(hero(run, 'warrior')).toMatchObject({ attackBonus: 6, damageBonus: 2 });
  });

  it('raises armor and max HP together', () => {
    const run = createRun(CAMPAIGN);
    applyReward(run, reward('mageCloak'));
    expect(hero(run, 'mage')).toMatchObject({ ac: 13, maxHp: 22, hp: 22 });
  });

  it('raises the fate pool', () => {
    const run = createRun(CAMPAIGN);
    applyReward(run, reward('fateMax'));
    expect(run.fate).toMatchObject({ current: 4, max: 4 });
  });

  it('heals everyone capped at the new max HP', () => {
    const run = createRun(CAMPAIGN);
    hero(run, 'warrior').hp = 20;
    hero(run, 'mage').hp = 5;
    applyReward(run, reward('holyWater'));
    expect(hero(run, 'warrior')).toMatchObject({ hp: 30, maxHp: 30 });
    expect(hero(run, 'mage')).toMatchObject({ hp: 18, maxHp: 18 });
    expect(hero(run, 'cleric')).toMatchObject({ hp: 24, maxHp: 24 });
    expect(hero(run, 'rogue')).toMatchObject({ hp: 20, maxHp: 20 });
  });

  it('holy water raises max HP of every hero', () => {
    const run = createRun(CAMPAIGN);
    const before = run.heroes.map((h) => h.maxHp);
    applyReward(run, reward('holyWater'));
    expect(run.heroes.map((h) => h.maxHp)).toEqual(before.map((m) => m + 2));
  });

  it('rogue rewards', () => {
    const run = createRun(CAMPAIGN);
    applyReward(run, reward('rogueEdge'));
    expect(hero(run, 'rogue')).toMatchObject({ attackBonus: 6, damageBonus: 2 });
    applyReward(run, reward('rogueCloak'));
    expect(hero(run, 'rogue')).toMatchObject({ ac: 15, maxHp: 24, hp: 24 });
  });
});

describe('full run simulation', () => {
  const MAX_ACTIONS = 2000;

  function playRun(seed: number, spendFate: boolean): { status: string; actions: number } {
    const rng = createRng(seed);
    const run = createRun(CAMPAIGN);
    let actions = 0;
    while (run.status === 'inProgress') {
      const { combat } = startEncounter(run, CAMPAIGN, rng);
      playCombat(combat);
      finishEncounter(run, combat, CAMPAIGN);
      if (run.status === 'inProgress') {
        if (spendFate) applyReward(run, rollRewardOffer(run, CAMPAIGN, rng)[0]);
        else applyRest(run, rng);
      }
    }
    return { status: run.status, actions };

    function playCombat(combat: CombatState): void {
      while (combat.result === null) {
        if (++actions > MAX_ACTIONS) throw new Error(`seed ${seed}: too many actions`);
        if (combat.pending) {
          if (spendFate) spendFateDie(combat, rng);
          else declineFate(combat, rng);
          continue;
        }
        const active = getActive(combat);
        if (active.side === 'enemy') {
          runEnemyTurn(combat, rng);
          continue;
        }
        const ability = getAvailableAbilities(combat, active.id)[0];
        const targetId = getValidTargets(combat, active.id, ability.id)[0];
        performAction(combat, { actorId: active.id, abilityId: ability.id, targetId }, rng);
      }
    }
  }

  for (const spendFate of [false, true]) {
    it(`terminates for seeds 1..20 (spendFate=${spendFate})`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const { status, actions } = playRun(seed, spendFate);
        expect(['won', 'lost']).toContain(status);
        expect(actions).toBeLessThan(MAX_ACTIONS);
      }
    });
  }
});
