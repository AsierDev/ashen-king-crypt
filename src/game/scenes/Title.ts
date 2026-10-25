import { Scene } from 'phaser';
import { CAMPAIGN } from '../../content/campaign';
import { TEXTS } from '../../content/texts';
import { parseSeed } from '../../core/rng';
import { isMuted, startAmbience, toggleMuted, unlockAudio } from '../audio';
import { addCryptBackground } from '../background';
import { getSession, newSession, randomSeed } from '../session';
import { markScene } from '../smokeMarker';
import { COLORS, FONT_BODY, FONT_UI } from '../theme';
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
        addCryptBackground(this, 0.55);
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
        const soundLabel = () => (isMuted() ? TEXTS.labels.soundOff : TEXTS.labels.soundOn);
        const sound = new TextButton(this, 572, 20, 120, 20, soundLabel(), () => {
            unlockAudio();
            toggleMuted();
            sound.setLabel(soundLabel());
        });
        new TextButton(this, 320, 250, 140, 28, TEXTS.labels.start, () => {
            unlockAudio();
            startAmbience();
            newSession(parseSeed(window.location.search, randomSeed()));
            startTarget(this, introTarget(getSession().run, CAMPAIGN));
        });
        markScene('Title');
    }
}
