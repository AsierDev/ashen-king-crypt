import type { Rng } from './rng';
import type { DiceExpr, RollMode } from './types';

export function rollDie(rng: Rng, sides: number): number {
  return rng.int(1, sides);
}

export function rollD20(rng: Rng, mode: RollMode): { rolls: number[]; kept: number } {
  if (mode === 'normal') {
    const roll = rollDie(rng, 20);
    return { rolls: [roll], kept: roll };
  }
  const rolls = [rollDie(rng, 20), rollDie(rng, 20)];
  const kept = mode === 'advantage' ? Math.max(...rolls) : Math.min(...rolls);
  return { rolls, kept };
}

export function rollDice(rng: Rng, expr: DiceExpr, crit = false): { rolls: number[]; total: number } {
  const count = crit ? expr.count * 2 : expr.count;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(rng, expr.sides));
  return { rolls, total: rolls.reduce((sum, r) => sum + r, 0) + expr.bonus };
}

export function formatDice(expr: DiceExpr): string {
  const base = `${expr.count}d${expr.sides}`;
  if (expr.bonus === 0) return base;
  return expr.bonus > 0 ? `${base}+${expr.bonus}` : `${base}${expr.bonus}`;
}
