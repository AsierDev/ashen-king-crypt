import { Boot } from './scenes/Boot';
import { AUTO, Game, Scale } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { Title } from './scenes/Title';
import { Narrative } from './scenes/Narrative';
import { Combat } from './scenes/Combat';
import { Interlude } from './scenes/Interlude';
import { End } from './scenes/End';
import { installMuteKey } from './audio';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 640,
    height: 360,
    parent: 'game-container',
    backgroundColor: '#0b0a10',
    pixelArt: true,
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        zoom: Scale.MAX_ZOOM
    },
    scene: [
        Boot,
        Preloader,
        Title,
        Narrative,
        Combat,
        Interlude,
        End
    ]
};

const StartGame = (parent: string) => {

    installMuteKey();

    const game = new Game({ ...config, parent });
    // Al girar el móvil o mostrar/ocultar las barras del navegador, el tamaño visible cambia tarde: reajustar.
    const refresh = () => window.setTimeout(() => game.scale.refresh(), 250);
    window.addEventListener('orientationchange', refresh);
    window.visualViewport?.addEventListener('resize', refresh);
    return game;

}

export default StartGame;
