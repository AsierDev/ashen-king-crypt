import { Scene } from 'phaser';

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
    }

    create ()
    {
        this.add.text(320, 180, 'La Cripta del Rey Ceniza', { fontFamily: 'monospace', fontSize: 16, color: '#e8e0d0' }).setOrigin(0.5);
    }
}
