import type { Game } from 'phaser';

// En móvil, 100vh/100dvh puede incluir la zona tapada por las barras del navegador (p. ej. Brave/Chrome en
// Android en horizontal) y el lienzo se corta por abajo. visualViewport sí da el área visible real.
export function installViewportFit(game: Game): void {
    const app = document.getElementById('app');
    if (!app) return;
    const fit = () => {
        const height = window.visualViewport?.height ?? window.innerHeight;
        app.style.height = `${Math.round(height)}px`;
        game.scale.refresh();
    };
    // Al girar, el tamaño definitivo llega con retraso: reajustar ahora y otra vez cuando se asiente.
    const fitSoon = () => {
        fit();
        window.setTimeout(fit, 300);
    };
    window.visualViewport?.addEventListener('resize', fitSoon);
    window.addEventListener('resize', fitSoon);
    window.addEventListener('orientationchange', fitSoon);
    document.addEventListener('fullscreenchange', fitSoon);
    fit();
}

// En pantallas táctiles, el primer toque pasa a pantalla completa (sin barras del navegador) y, donde se
// permite (Android), fija la orientación horizontal. iOS no lo soporta y sigue con el aviso de girar.
export function installMobileFullscreen(): void {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const root = document.documentElement;
    if (typeof root.requestFullscreen !== 'function') return;
    const enter = async () => {
        if (document.fullscreenElement) return;
        try {
            await root.requestFullscreen({ navigationUI: 'hide' });
            const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
            await orientation.lock?.('landscape');
        } catch {
            // El navegador puede negarlo; el juego sigue funcionando en la ventana normal.
        }
    };
    window.addEventListener('pointerup', enter, { once: true });
}
