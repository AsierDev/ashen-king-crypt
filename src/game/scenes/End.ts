import { Scene } from 'phaser';
import { TEXTS } from '../../content/texts';
import { markScene } from '../smokeMarker';
import { COLORS, FONT_BODY, FONT_UI, LAYOUT } from '../theme';
import { TextButton } from '../ui/Button';

export class End extends Scene
{
    private result: 'won' | 'lost' = 'lost';

    constructor ()
    {
        super('End');
    }

    init (data: { result: 'won' | 'lost' })
    {
        this.result = data.result;
    }

    create ()
    {
        const won = this.result === 'won';
        this.add.rectangle(0, 0, LAYOUT.width, LAYOUT.height, COLORS.bg).setOrigin(0);
        this.add
            .text(320, 90, won ? TEXTS.labels.victoryTitle : TEXTS.labels.defeatTitle, {
                fontFamily: FONT_UI,
                fontSize: '32px',
                color: won ? COLORS.gold : COLORS.damage,
            })
            .setOrigin(0.5);
        (won ? TEXTS.victory : TEXTS.defeat).forEach((line, i) => {
            this.add
                .text(320, 150 + i * 28, line, {
                    fontFamily: FONT_BODY,
                    fontSize: '16px',
                    color: COLORS.text,
                    align: 'center',
                    wordWrap: { width: 560 },
                })
                .setOrigin(0.5, 0);
        });
        new TextButton(this, 320, 300, 180, 28, TEXTS.labels.restart, () => this.scene.start('Title'));
        markScene('End');
    }
}
