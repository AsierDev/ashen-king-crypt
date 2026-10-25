import { CAMPAIGN } from '../content/campaign';
import { createRng } from '../core/rng';
import type { Rng } from '../core/rng';
import { createRun } from '../core/run';
import type { RunState } from '../core/run';

export interface Session {
  seed: number;
  rng: Rng;
  run: RunState;
}

let current: Session | null = null;

export function newSession(seed: number): Session {
  current = { seed, rng: createRng(seed), run: createRun(CAMPAIGN) };
  return current;
}

export function getSession(): Session {
  if (!current) throw new Error('no session');
  return current;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}
