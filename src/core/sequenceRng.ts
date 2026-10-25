import type { Rng } from './rng';

export function createSequenceRng(values: number[]): Rng {
  const queue = [...values];
  return {
    next: () => {
      throw new Error('sequence rng: next() not supported');
    },
    int: (min, max) => {
      const v = queue.shift();
      if (v === undefined || v < min || v > max) {
        throw new Error(`sequence rng: ${v} not in [${min},${max}]`);
      }
      return v;
    },
  };
}
