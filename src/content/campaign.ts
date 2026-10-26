import type { Campaign, EncounterDef, LevelDef, RewardDef } from '../core/run';
import { ABILITIES, ENEMIES, HEROES } from './units';

export const ENCOUNTERS: EncounterDef[] = [
  { id: 'antechamber', title: 'La Antesala', enemyIds: ['skeleton', 'skeleton', 'skeleton'], isBoss: false },
  { id: 'ossuary', title: 'El Osario', enemyIds: ['skeleton', 'skeleton', 'ghoul', 'ghoul'], isBoss: false },
  { id: 'chapel', title: 'La Capilla Profanada', enemyIds: ['cultist', 'skeleton', 'skeleton', 'skeleton'], isBoss: false },
  { id: 'catacombs', title: 'Las Catacumbas', enemyIds: ['ghoul', 'ghoul', 'cultist', 'skeleton'], isBoss: false },
  { id: 'guard', title: 'La Guardia de Ceniza', enemyIds: ['ashenKnight', 'skeleton', 'skeleton'], isBoss: false },
  { id: 'throne', title: 'El Trono de Ceniza', enemyIds: ['ashenKing'], isBoss: true },
];

export const REWARDS: RewardDef[] = [
  {
    id: 'warriorEdge',
    name: 'Filo Afilado',
    description: 'Bran: +1 al ataque y +2 al daño.',
    effects: [
      { kind: 'attackBonus', heroId: 'warrior', amount: 1 },
      { kind: 'damageBonus', heroId: 'warrior', amount: 2 },
    ],
  },
  {
    id: 'clericFaith',
    name: 'Maza Consagrada',
    description: 'Isolda: +1 al ataque y +2 al daño.',
    effects: [
      { kind: 'attackBonus', heroId: 'cleric', amount: 1 },
      { kind: 'damageBonus', heroId: 'cleric', amount: 2 },
    ],
  },
  {
    id: 'mageFocus',
    name: 'Foco Arcano',
    description: 'Teodric: +1 al ataque y +2 al daño.',
    effects: [
      { kind: 'attackBonus', heroId: 'mage', amount: 1 },
      { kind: 'damageBonus', heroId: 'mage', amount: 2 },
    ],
  },
  {
    id: 'warriorArmor',
    name: 'Coraza Reforzada',
    description: 'Bran: +1 CA y +6 PG máximos.',
    effects: [
      { kind: 'ac', heroId: 'warrior', amount: 1 },
      { kind: 'maxHp', heroId: 'warrior', amount: 6 },
    ],
  },
  {
    id: 'clericAmulet',
    name: 'Amuleto de Vida',
    description: 'Isolda: +1 CA y +6 PG máximos.',
    effects: [
      { kind: 'ac', heroId: 'cleric', amount: 1 },
      { kind: 'maxHp', heroId: 'cleric', amount: 6 },
    ],
  },
  {
    id: 'mageCloak',
    name: 'Capa Protectora',
    description: 'Teodric: +1 CA y +6 PG máximos.',
    effects: [
      { kind: 'ac', heroId: 'mage', amount: 1 },
      { kind: 'maxHp', heroId: 'mage', amount: 6 },
    ],
  },
  {
    id: 'fateMax',
    name: 'Favor del Destino',
    description: '+1 Dado de Destino máximo (y uno más ahora).',
    effects: [{ kind: 'fateMax', amount: 1 }],
  },
  {
    id: 'holyWater',
    name: 'Agua Bendita',
    description: 'Todos: +2 PG máximos y recuperan 12 PG.',
    effects: [
      { kind: 'maxHp', heroId: 'warrior', amount: 2 },
      { kind: 'maxHp', heroId: 'cleric', amount: 2 },
      { kind: 'maxHp', heroId: 'mage', amount: 2 },
      { kind: 'maxHp', heroId: 'rogue', amount: 2 },
      { kind: 'healAll', amount: 12 },
    ],
  },
  {
    id: 'rogueEdge',
    name: 'Filo Envenenado',
    description: 'Nerea: +1 al ataque y +2 al daño.',
    effects: [
      { kind: 'attackBonus', heroId: 'rogue', amount: 1 },
      { kind: 'damageBonus', heroId: 'rogue', amount: 2 },
    ],
  },
  {
    id: 'rogueCloak',
    name: 'Capa de Sombras',
    description: 'Nerea: +1 CA y +6 PG máximos.',
    effects: [
      { kind: 'ac', heroId: 'rogue', amount: 1 },
      { kind: 'maxHp', heroId: 'rogue', amount: 6 },
    ],
  },
];

const levelHp: LevelDef['effects'] = [
  { kind: 'maxHp', heroId: 'warrior', amount: 5 },
  { kind: 'maxHp', heroId: 'cleric', amount: 4 },
  { kind: 'maxHp', heroId: 'mage', amount: 3 },
  { kind: 'maxHp', heroId: 'rogue', amount: 4 },
];

export const LEVELS: LevelDef[] = [
  { level: 2, xp: 200, summary: 'PG máx.: Bran +5, Isolda +4, Teodric +3, Nerea +4.', effects: levelHp },
  {
    level: 3,
    xp: 400,
    summary: '+1 al ataque para todos.',
    effects: ['warrior', 'cleric', 'mage', 'rogue'].map((heroId) => ({ kind: 'attackBonus' as const, heroId, amount: 1 })),
  },
  { level: 4, xp: 500, summary: 'PG máx.: Bran +5, Isolda +4, Teodric +3, Nerea +4.', effects: levelHp },
];

export const CAMPAIGN: Campaign = {
  heroes: HEROES,
  enemies: ENEMIES,
  abilities: ABILITIES,
  encounters: ENCOUNTERS,
  rewards: REWARDS,
  fateStart: { max: 3, sides: 4 },
  xpPerEncounter: 100,
  levels: LEVELS,
};
