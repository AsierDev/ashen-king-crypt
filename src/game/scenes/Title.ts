import { Scene } from 'phaser';
import { CAMPAIGN } from '../../content/campaign';
import { TEXTS } from '../../content/texts';
import { parseSeed } from '../../core/rng';
import { getSession, newSession, randomSeed } from '../session';
import { markScene } from '../smokeMarker';
import { COLORS, FONT_BODY, FONT_UI, LAYOUT } from '../theme';
import { TextButton } from '../ui/Button';
import { introTarget, startTarget } from '../view/flow';

export class Title extends Scene
{
    constructor ()
    {
        super('Title');
    }

    create ()
    {
        this.add.rectangle(0, 0, LAYOUT.width, LAYOUT.height, COLORS.wall).setOrigin(0);
        this.add
            .text(320, 120, TEXTS.gameTitle, {
                fontFamily: FONT_UI,
                fontSize: '32px',
                color: COLORS.gold,
                align: 'center',
                wordWrap: { width: 600 },
            })
            .setOrigin(0.5);
        this.add
            .text(320, 170, TEXTS.subtitle, { fontFamily: FONT_BODY, fontSize: '16px', color: COLORS.textDim })
            .setOrigin(0.5);
        new TextButton(this, 320, 250, 140, 28, TEXTS.labels.start, () => {
            newSession(parseSeed(window.location.search, randomSeed()));
            startTarget(this, introTarget(getSession().run, CAMPAIGN));
        });
        markScene('Title');
    }
}
