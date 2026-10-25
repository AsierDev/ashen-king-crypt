import { Scene } from 'phaser';
import type { Loader } from 'phaser';
import { createUnitAnimations, ensurePlaceholders, queueUnitAssets } from '../assets';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        this.add.rectangle(320, 180, 300, 16).setStrokeStyle(1, 0xffffff);

        const bar = this.add.rectangle(320 - 148, 180, 4, 12, 0xffffff);

        this.load.on('progress', (progress: number) => {

            bar.width = 4 + (292 * progress);

        });
    }

    preload ()
    {
        this.load.setPath('assets');

        this.load.font('PixelifySans', 'fonts/PixelifySans.ttf', 'truetype');
        this.load.font('Silkscreen', 'fonts/Silkscreen-Regular.ttf', 'truetype');
        queueUnitAssets(this.load);
        this.load.on('loaderror', (file: Loader.File) => console.warn('Asset no cargado:', file.key));
    }

    create ()
    {
        ensurePlaceholders(this);
        createUnitAnimations(this);
        this.scene.start('Title');
    }
}
