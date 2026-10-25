// Sonido sintetizado con Web Audio: sin ficheros de audio que descargar ni licenciar.
export type SfxName =
    | 'click'
    | 'dice'
    | 'hit'
    | 'crit'
    | 'miss'
    | 'heal'
    | 'fate'
    | 'downed'
    | 'victory'
    | 'defeat';

const MUTE_KEY = 'cripta-mute';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambienceOn = false;
let muted = readMuted();

function readMuted(): boolean {
    try {
        return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
        return false;
    }
}

function context(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return ctx;
}

/** Llamar desde un gesto del usuario: los navegadores no dejan sonar audio antes. */
export function unlockAudio(): void {
    const c = context();
    if (c && c.state === 'suspended') void c.resume();
}

export function isMuted(): boolean {
    return muted;
}

export function toggleMuted(): boolean {
    muted = !muted;
    try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
        // Sin almacenamiento: el ajuste dura solo esta sesión.
    }
    if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
    return muted;
}

function tone(type: OscillatorType, freq: number, start: number, dur: number, vol: number, endFreq?: number): void {
    const c = ctx!;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
}

function noise(start: number, dur: number, vol: number, filterFreq: number, endFilter?: number): void {
    const c = ctx!;
    const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, start);
    if (endFilter) filter.frequency.exponentialRampToValueAtTime(endFilter, start + dur);
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(gain).connect(master!);
    src.start(start);
}

export function playSfx(name: SfxName): void {
    const c = context();
    if (!c || muted || c.state !== 'running') return;
    const t = c.currentTime + 0.01;
    switch (name) {
        case 'click':
            tone('square', 660, t, 0.05, 0.08);
            break;
        case 'dice':
            for (let i = 0; i < 6; i++) noise(t + i * 0.07, 0.04, 0.25, 2500 + i * 300);
            break;
        case 'hit':
            noise(t, 0.12, 0.5, 900);
            tone('sine', 140, t, 0.18, 0.5, 60);
            break;
        case 'crit':
            noise(t, 0.18, 0.6, 1200);
            tone('sine', 160, t, 0.25, 0.6, 50);
            tone('square', 990, t + 0.02, 0.2, 0.12, 1320);
            break;
        case 'miss':
            noise(t, 0.25, 0.25, 600, 2400);
            break;
        case 'heal':
            [523.25, 659.25, 783.99].forEach((f, i) => tone('sine', f, t + i * 0.08, 0.35, 0.18));
            break;
        case 'fate':
            tone('triangle', 1318.5, t, 0.6, 0.2);
            tone('sine', 1975.5, t + 0.03, 0.5, 0.08);
            break;
        case 'downed':
            tone('sawtooth', 220, t, 0.5, 0.15, 70);
            break;
        case 'victory':
            [392, 493.88, 587.33, 783.99].forEach((f, i) => tone('triangle', f, t + i * 0.12, 0.5, 0.18));
            break;
        case 'defeat':
            [392, 349.23, 311.13, 233.08].forEach((f, i) => tone('triangle', f, t + i * 0.18, 0.6, 0.18));
            break;
    }
}

/** Zumbido grave de cripta con un vaivén lento. Idempotente. */
export function startAmbience(): void {
    const c = context();
    if (!c || ambienceOn) return;
    ambienceOn = true;
    const out = c.createGain();
    out.gain.value = 0.05;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.connect(out).connect(master!);
    for (const f of [55, 55.4, 82.4]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(filter);
        o.start();
    }
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(out.gain);
    lfo.start();
}

/** Tecla M para silenciar en cualquier pantalla. */
export function installMuteKey(): void {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') toggleMuted();
    });
}
