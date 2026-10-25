import { Scene } from 'phaser';
import { TEXTS } from '../../content/texts';
import { markScene } from '../smokeMarker';
import { COLORS, FONT_BODY, LAYOUT } from '../theme';
import { TextButton } from '../ui/Button';
import { startTarget } from '../view/flow';
import type { SceneTarget } from '../view/flow';

interface NarrativeData {
    lines: string[];
    next: SceneTarget;
}

export class Narrative extends Scene
{
    private data0!: NarrativeData;

    constructor ()
    {
        super('Narrative');
    }

    init (data: NarrativeData)
    {
        this.data0 = data;
    }

    create ()
    {
        this.add.rectangle(0, 0, LAYOUT.width, LAYOUT.height, COLORS.bg).setOrigin(0);
        const { lines, next } = this.data0;
        const button = new TextButton(this, 560, 320, 120, 28, TEXTS.labels.continue, () => startTarget(this, next));
        button.setVisible(false);

        lines.forEach((line, i) => {
            const text = this.add
                .text(320, 110 + i * 36, line, {
                    fontFamily: FONT_BODY,
                    fontSize: '16px',
                    color: COLORS.text,
                    align: 'center',
                    wordWrap: { width: 560 },
                })
                .setOrigin(0.5, 0)
                .setAlpha(0);
            this.tweens.add({
                targets: text,
                alpha: 1,
                duration: 400,
                delay: i * 500,
                onComplete: () => {
                    if (i === lines.length - 1) button.setVisible(true);
                },
            });
        });
        if (lines.length === 0) button.setVisible(true);
        markScene('Narrative');
    }
}
