export type Side = 'hero' | 'enemy';
export type StatusId = 'blessed' | 'weakened' | 'shielded';
export type TargetRule = 'singleEnemy' | 'allEnemies' | 'singleAlly' | 'self';
export type RollMode = 'normal' | 'advantage' | 'disadvantage';
export type AiProfile = 'lowestHp' | 'random' | 'summoner' | 'ashenKing';
export type AttackOutcome = 'hit' | 'crit' | 'miss' | 'fumble';
export interface DiceExpr {
  count: number;
  sides: number;
  bonus: number;
}
export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  target: TargetRule;
  roll: 'attack' | 'none';
  usesPerCombat?: number;
  damage?: DiceExpr;
  heal?: DiceExpr;
  canRevive?: boolean;
  applyStatus?: { status: StatusId; duration: number };
  summon?: { enemyId: string; count: number };
}
export interface CombatantDef {
  id: string;
  name: string;
  maxHp: number;
  ac: number;
  attackBonus: number;
  initiativeBonus: number;
  abilityIds: string[];
}
export interface HeroDef extends CombatantDef {
  className: string;
}
export interface EnemyDef extends CombatantDef {
  aiProfile: AiProfile;
  unique?: boolean;
}
export interface StatusInstance {
  status: StatusId;
  remaining: number;
}
export interface CombatantState {
  id: string;
  defId: string;
  side: Side;
  name: string;
  hp: number;
  maxHp: number;
  ac: number;
  attackBonus: number;
  damageBonus: number;
  initiativeBonus: number;
  abilityIds: string[];
  usesLeft: Record<string, number>;
  statuses: StatusInstance[];
  downed: boolean;
  turnsTaken: number;
  aiProfile?: AiProfile;
}
export interface FatePool {
  current: number;
  max: number;
  sides: number;
}
export type FateStage = 'attack' | 'damage' | 'heal';
export interface PendingRoll {
  stage: FateStage;
  actorId: string;
  abilityId: string;
  targetId: string;
  total: number;
  targetAc: number;
  crit: boolean;
}
export interface ActionIntent {
  actorId: string;
  abilityId: string;
  targetId?: string;
}
export interface CombatState {
  combatants: CombatantState[];
  order: string[];
  turnIndex: number;
  round: number;
  fate: FatePool;
  pending: PendingRoll | null;
  result: 'victory' | 'defeat' | null;
  abilities: Record<string, AbilityDef>;
  enemyDefs: Record<string, EnemyDef>;
  nextEnemySerial: number;
}
export type CombatEvent =
  | { type: 'initiativeRolled'; entries: { id: string; roll: number; total: number }[] }
  | { type: 'turnStarted'; actorId: string; round: number }
  | { type: 'abilityUsed'; actorId: string; abilityId: string; targetIds: string[] }
  | {
      type: 'attackRolled';
      actorId: string;
      targetId: string;
      mode: RollMode;
      rolls: number[];
      kept: number;
      bonus: number;
      total: number;
      targetAc: number;
      outcome: AttackOutcome;
    }
  | {
      type: 'fateDieSpent';
      stage: 'attack';
      value: number;
      total: number;
      targetAc: number;
      outcome: 'hit' | 'miss';
      remaining: number;
    }
  | { type: 'fateDieSpent'; stage: 'damage' | 'heal'; value: number; total: number; remaining: number }
  | { type: 'damageDealt'; targetId: string; amount: number; hpAfter: number; crit: boolean }
  | { type: 'healed'; targetId: string; amount: number; hpAfter: number; revived: boolean }
  | { type: 'statusApplied'; targetId: string; status: StatusId; duration: number }
  | { type: 'statusExpired'; targetId: string; status: StatusId }
  | { type: 'combatantDowned'; targetId: string }
  | { type: 'summoned'; actorId: string; combatantId: string; defId: string }
  | { type: 'summonFailed'; actorId: string }
  | { type: 'combatEnded'; result: 'victory' | 'defeat' };
