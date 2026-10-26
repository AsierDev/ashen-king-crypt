import { Scene } from 'phaser';
import { CAMPAIGN } from '../../content/campaign';
import { TEXTS } from '../../content/texts';
import { applyReward, applyRest, rollRewardOffer } from '../../core/run';
import type { RewardDef } from '../../core/run';
import { getSession } from '../session';
import { markScene } from '../smokeMarker';
import { COLORS, FONT_BODY, FONT_UI, LAYOUT } from '../theme';
import { TextButton } from '../ui/Button';
import { formatHeroStatus } from '../view/combatText';
import { afterInterludeTarget, startTarget } from '../view/flow';

export class Interlude extends Scene
{
    constructor ()
    {
        super('Interlude');
    }

    create ()
    {
        this.add.rectangle(0, 0, LAYOUT.width, LAYOUT.height, COLORS.bg).setOrigin(0);
        const { run, rng } = getSession();
        const offer = rollRewardOffer(run, CAMPAIGN, rng);

        this.add
            .text(320, 24, TEXTS.labels.interlude, { fontFamily: FONT_UI, fontSize: '16px', color: COLORS.gold })
            .setOrigin(0.5);

        const body = { fontFamily: FONT_BODY, fontSize: '16px', color: COLORS.text };
        run.heroes.forEach((p, i) => {
            const name = CAMPAIGN.heroes.find((h) => h.id === p.heroId)!.name;
            this.add.text(i % 2 === 0 ? 24 : 330, 58 + Math.floor(i / 2) * 20, formatHeroStatus({ name, hp: p.hp, maxHp: p.maxHp }), body);
        });
        this.add.text(24, 58 + Math.ceil(run.heroes.length / 2) * 20, `${TEXTS.labels.fate} ${run.fate.current}/${run.fate.max}`, body);
        this.add.text(320, 150, TEXTS.labels.interludeHint, body).setOrigin(0.5);

        let chosen = false;
        const choose = (apply: () => void) => () => {
            if (chosen) return;
            chosen = true;
            apply();
            startTarget(this, afterInterludeTarget(run, CAMPAIGN));
        };
        const ys = [190, 242, 294];
        new TextButton(
            this, 320, ys[0], 600, 44,
            `${TEXTS.labels.rest}\n${TEXTS.labels.restDesc}`,
            choose(() => applyRest(run)),
            16, FONT_BODY,
        );
        offer.forEach((reward: RewardDef, i: number) => {
            new TextButton(
                this, 320, ys[i + 1], 600, 44,
                `${reward.name}\n${reward.description}`,
                choose(() => applyReward(run, reward)),
                16, FONT_BODY,
            );
        });
        markScene('Interlude');
    }
}
