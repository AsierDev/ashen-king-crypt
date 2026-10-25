import { describe, expect, it } from 'vitest';
import { formatDice, rollD20, rollDice } from './dice';
import { createRng, parseSeed } from './rng';
import { createSequenceRng } from './sequenceRng';

describe('createRng', () => {
  it('es determinista para una misma semilla', () => {
    const a = createRng(42);
    const b = createRng(42);
    const first = Array.from({ length: 5 }, () => a.next());
    const second = Array.from({ length: 5 }, () => b.next());
    expect(first).toEqual(second);
  });

  it('semillas distintas dan valores distintos', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('int incluye ambos extremos', () => {
    const rng = createRng(7);
    const values = Array.from({ length: 1000 }, () => rng.int(1, 20));
    expect(values.every((v) => v >= 1 && v <= 20)).toBe(true);
    expect(values).toContain(1);
    expect(values).toContain(20);
  });
});

describe('parseSeed', () => {
  it('lee enteros no negativos y usa el valor por defecto en otro caso', () => {
    expect(parseSeed('?seed=123', 5)).toBe(123);
    expect(parseSeed('', 5)).toBe(5);
    expect(parseSeed('?seed=abc', 5)).toBe(5);
    expect(parseSeed('?seed=-3', 5)).toBe(5);
  });
});

describe('rollD20', () => {
  it('tira un dado en modo normal', () => {
    expect(rollD20(createSequenceRng([15]), 'normal')).toEqual({ rolls: [15], kept: 15 });
  });

  it('se queda con el mayor con ventaja', () => {
    expect(rollD20(createSequenceRng([4, 17]), 'advantage').kept).toBe(17);
  });

  it('se queda con el menor con desventaja', () => {
    expect(rollD20(createSequenceRng([4, 17]), 'disadvantage')).toEqual({ rolls: [4, 17], kept: 4 });
  });
});

describe('rollDice', () => {
  it('suma los dados y el bono', () => {
    expect(rollDice(createSequenceRng([3, 5]), { count: 2, sides: 6, bonus: 3 }).total).toBe(11);
  });

  it('duplica los dados en un crítico', () => {
    const result = rollDice(createSequenceRng([2, 7]), { count: 1, sides: 8, bonus: 3 }, true);
    expect(result.rolls).toEqual([2, 7]);
    expect(result.total).toBe(12);
  });
});

describe('formatDice', () => {
  it('formatea con bono positivo, nulo y negativo', () => {
    expect(formatDice({ count: 1, sides: 8, bonus: 3 })).toBe('1d8+3');
    expect(formatDice({ count: 2, sides: 6, bonus: 0 })).toBe('2d6');
    expect(formatDice({ count: 1, sides: 4, bonus: -1 })).toBe('1d4-1');
  });
});

describe('createSequenceRng', () => {
  it('lanza un error con valores fuera de rango o cola vacía', () => {
    expect(() => createSequenceRng([25]).int(1, 20)).toThrow();
    expect(() => createSequenceRng([]).int(1, 20)).toThrow();
  });
});
