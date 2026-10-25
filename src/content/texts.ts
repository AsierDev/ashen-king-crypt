import type { StatusId } from '../core/types';

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export const STATUS_LABELS: Record<StatusId, { name: string; short: string; positive: boolean }> = {
  blessed: { name: 'Bendición', short: 'BEN', positive: true },
  weakened: { name: 'Debilidad', short: 'DEB', positive: false },
  shielded: { name: 'Protección', short: 'PRO', positive: true },
};

export const TEXTS = {
  gameTitle: 'La Cripta del Rey Ceniza',
  subtitle: 'Un RPG por turnos',
  intro: [
    'Hace siete inviernos, el Rey Ceniza fue sepultado bajo la aldea de Valdeceniza.',
    'Anoche, las campanas de la cripta sonaron solas. Los muertos caminan otra vez.',
    'Bran, Isolda y Teodric descienden con antorchas. Si fracasan, nadie verá el alba.',
  ],
  encounterIntro: {
    antechamber: ['La Antesala.', 'Huesos que crujen se levantan del polvo para cerraros el paso.'],
    ossuary: ['El Osario.', 'Paredes de cráneos. Algo hambriento escarba entre ellos.'],
    chapel: ['La Capilla Profanada.', 'Un sectario reza al trono vacío. Sus plegarias tienen respuesta.'],
    catacombs: ['Las Catacumbas.', 'El aire huele a ceniza. Más abajo ya se oyen pasos de hierro.'],
    throne: ['El Trono de Ceniza.', 'El Rey abre los ojos. «Habéis llegado lejos para morir aquí.»'],
  } as Record<string, string[]>,
  victory: ['El Rey Ceniza se deshace en polvo y brasas.', 'Las campanas callan. Valdeceniza verá el alba.'],
  defeat: ['Las antorchas se apagan una a una.', 'El Rey Ceniza asciende hacia la aldea.'],
  labels: {
    start: 'Comenzar',
    continue: 'Continuar',
    restart: 'Volver a empezar',
    interlude: 'Interludio',
    interludeHint: 'Elige una opción:',
    rest: 'Descansar',
    restDesc: 'El grupo recupera todos sus PG (también los caídos) y se rellenan los Dados de Destino.',
    chooseAbility: '{name}: elige una habilidad.',
    chooseTarget: 'Elige un objetivo.',
    cancel: 'Cancelar',
    spendFate: 'Gastar d4',
    skipFate: 'No gastar',
    enemyTurn: 'Turno de {name}...',
    round: 'Ronda {n}',
    fate: 'Destino',
    hp: 'PG',
    victoryTitle: '¡Victoria!',
    defeatTitle: 'Derrota',
  },
};
