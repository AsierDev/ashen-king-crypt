export const COLORS = {
  bg: 0x0b0a10,
  wall: 0x15121c,
  floor: 0x221c2a,
  panel: 0x1c1726,
  panelBorder: 0x5a4a6e,
  text: '#e8e0d0',
  textDim: '#9a90a8',
  gold: '#d9a441',
  goldHex: 0xd9a441,
  damage: '#e05a4a',
  damageHex: 0xe05a4a,
  heal: '#6fcf6a',
  healHex: 0x6fcf6a,
  hpFill: 0x5fae5a,
  hpLow: 0xc0392b,
  hpBg: 0x2a2333,
  fate: 0x6fa8dc,
  textDimHex: 0x9a90a8,
};

export const FONT_UI = 'Silkscreen, monospace';
export const FONT_BODY = 'PixelifySans, monospace';

export const LAYOUT = {
  width: 640,
  height: 360,
  logX: 8,
  logY: 22,
  logLines: 4,
  heroSlots: [
    { x: 250, y: 214 },
    { x: 180, y: 206 },
    { x: 110, y: 214 },
  ],
  enemySlots: [
    { x: 390, y: 214 },
    { x: 460, y: 206 },
    { x: 530, y: 214 },
    { x: 600, y: 206 },
  ],
  groundY: 214,
  panelY: 236,
  partyX: 12,
  partyY: 244,
  partyRowH: 20,
  fateY: 316,
  promptX: 312,
  promptY: 244,
  buttonY: 290,
  buttonRow2Y: 326,
  buttonXs: [364, 472, 580],
  buttonW: 100,
  buttonH: 28,
  diceX: 320,
  diceY: 140,
};

export const TIMING = {
  lunge: 120,
  flash: 80,
  float: 600,
  dice: 700,
  fate: 500,
  turnPause: 250,
  enemyThink: 400,
  endDelay: 900,
  effect: 250,
};
