import { Boot } from './scenes/Boot';
import { AUTO, Game, Scale } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { Title } from './scenes/Title';
import { Narrative } from './scenes/Narrative';
import { Combat } from './scenes/Combat';
import { Interlude } from './scenes/Interlude';
import { End } from './scenes/End';

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

    return new Game({ ...config, parent });

}

export default StartGame;
