import { Scene } from 'phaser';
import type { GameObjects } from 'phaser';
import { CAMPAIGN } from '../../content/campaign';
import { STATUS_LABELS, TEXTS, fill } from '../../content/texts';
import { runEnemyTurn } from '../../core/ai';
import {
  declineFate,
  getActive,
  getAvailableAbilities,
  getCombatant,
  getValidTargets,
  performAction,
  spendFateDie,
} from '../../core/combat';
import { finishEncounter, startEncounter } from '../../core/run';
import type { ActionIntent, AbilityDef, CombatEvent, CombatState } from '../../core/types';
import { getSession } from '../session';
import { markScene } from '../smokeMarker';
import { COLORS, FONT_BODY, FONT_UI, LAYOUT, TIMING } from '../theme';
import { TextButton } from '../ui/Button';
import { DiceView } from '../ui/DiceView';
import { UnitView } from '../ui/UnitView';
import {
  formatAbilityButton,
  formatEvent,
  formatFatePrompt,
  formatHeroStatus,
  formatTurnOrder,
} from '../view/combatText';
import { afterCombatTarget, startTarget } from '../view/flow';

export class Combat extends Scene
{
    private combat!: CombatState;
    private units = new Map<string, UnitView>();
    private enemySlotOf = new Map<string, number>();
    private dice!: DiceView;
    private logLines: string[] = [];
    private logText!: GameObjects.Text;
    private turnText!: GameObjects.Text;
    private promptText!: GameObjects.Text;
    private partyTexts: GameObjects.Text[] = [];
    private fateGfx!: GameObjects.Graphics;
    private buttons: TextButton[] = [];
    private busy = false;
    private closed = false;

    constructor ()
    {
        super('Combat');
    }

    create ()
    {
        this.units = new Map();
        this.enemySlotOf = new Map();
        this.logLines = [];
        this.partyTexts = [];
        this.buttons = [];
        this.busy = false;
        this.closed = false;

        this.drawBackground();

        const { run, rng } = getSession();
        const { combat, events } = startEncounter(run, CAMPAIGN, rng);
        this.combat = combat;

        combat.combatants
            .filter((c) => c.side === 'hero')
            .forEach((c, i) => {
                const slot = LAYOUT.heroSlots[i];
                this.units.set(c.id, new UnitView(this, c, slot.x, slot.y));
            });
        combat.combatants.filter((c) => c.side === 'enemy').forEach((c) => this.addEnemyView(c.id));

        this.createTexts(CAMPAIGN.encounters[run.encounterIndex].title);
        this.dice = new DiceView(this);
        this.events.once('shutdown', () => {
            this.closed = true;
            this.dice.destroy();
        });

        markScene('Combat');

        void this.playEvents(events).then(() => this.nextStep());
    }

    private drawBackground ()
    {
        if (this.textures.exists('bg-crypt')) this.add.image(0, 0, 'bg-crypt').setOrigin(0);
        else {
            this.add.rectangle(0, 0, LAYOUT.width, LAYOUT.groundY, COLORS.wall).setOrigin(0);
            this.add.rectangle(0, LAYOUT.groundY, LAYOUT.width, LAYOUT.panelY - LAYOUT.groundY, COLORS.floor).setOrigin(0);
        }
        this.add
            .rectangle(0, LAYOUT.panelY, LAYOUT.width, LAYOUT.height - LAYOUT.panelY, COLORS.panel)
            .setOrigin(0)
            .setStrokeStyle(1, COLORS.panelBorder);
    }

    private createTexts (title: string)
    {
        this.turnText = this.add.text(8, 4, '', { fontFamily: FONT_UI, fontSize: '8px', color: COLORS.text });
        this.add
            .text(632, 4, title, { fontFamily: FONT_UI, fontSize: '8px', color: COLORS.textDim })
            .setOrigin(1, 0);
        this.logText = this.add.text(LAYOUT.logX, LAYOUT.logY, '', {
            fontFamily: FONT_BODY,
            fontSize: '16px',
            color: COLORS.text,
        });
        this.promptText = this.add.text(LAYOUT.promptX, LAYOUT.promptY, '', {
            fontFamily: FONT_BODY,
            fontSize: '16px',
            color: COLORS.text,
            wordWrap: { width: 320 },
        });
        this.combat.combatants
            .filter((c) => c.side === 'hero')
            .forEach((c, i) => {
                this.partyTexts.push(
                    this.add.text(LAYOUT.partyX, LAYOUT.partyY + i * LAYOUT.partyRowH, formatHeroStatus(c), {
                        fontFamily: FONT_UI,
                        fontSize: '8px',
                        color: COLORS.text,
                    }),
                );
            });
        this.add.text(LAYOUT.partyX, LAYOUT.fateY, TEXTS.labels.fate, {
            fontFamily: FONT_UI,
            fontSize: '8px',
            color: COLORS.textDim,
        });
        this.fateGfx = this.add.graphics();
        this.drawFate(this.combat.fate.current);
    }

    private drawFate (current: number)
    {
        this.fateGfx.clear();
        for (let i = 0; i < this.combat.fate.max; i++) {
            const x = LAYOUT.partyX + 52 + i * 18;
            const y = LAYOUT.fateY + 4;
            if (i < current) {
                this.fateGfx.fillStyle(COLORS.fate);
                this.fateGfx.fillTriangle(x, y + 5, x + 6, y - 5, x + 12, y + 5);
            } else {
                this.fateGfx.lineStyle(1, COLORS.fate);
                this.fateGfx.strokeTriangle(x, y + 5, x + 6, y - 5, x + 12, y + 5);
            }
        }
    }

    private addEnemyView (id: string)
    {
        const slotIndex = LAYOUT.enemySlots.findIndex((_, i) => ![...this.enemySlotOf.values()].includes(i));
        if (slotIndex < 0) return undefined;
        const slot = LAYOUT.enemySlots[slotIndex];
        const view = new UnitView(this, getCombatant(this.combat, id), slot.x, slot.y);
        this.units.set(id, view);
        this.enemySlotOf.set(id, slotIndex);
        return view;
    }

    private wait (ms: number): Promise<void>
    {
        return new Promise((resolve) => this.time.delayedCall(ms, () => resolve()));
    }

    private pushLog (line: string)
    {
        this.logLines.push(line);
        if (this.logLines.length > LAYOUT.logLines) this.logLines.shift();
        this.logText.setText(this.logLines.join('\n'));
    }

    private refreshTurnText (activeId: string)
    {
        const index = this.combat.order.indexOf(activeId);
        this.turnText.setText(formatTurnOrder({ ...this.combat, turnIndex: index < 0 ? this.combat.turnIndex : index }));
    }

    private refreshParty ()
    {
        this.combat.combatants
            .filter((c) => c.side === 'hero')
            .forEach((c, i) => this.partyTexts[i].setText(formatHeroStatus(c)));
    }

    private async playEvents (events: CombatEvent[])
    {
        this.busy = true;
        for (const e of events) {
            if (this.closed) return;
            const line = formatEvent(e, this.combat);
            if (line !== null) this.pushLog(line);
            await this.playEvent(e);
        }
        this.refreshParty();
        this.drawFate(this.combat.fate.current);
        this.busy = false;
    }

    private async playEvent (e: CombatEvent)
    {
        switch (e.type) {
            case 'initiativeRolled':
                this.refreshTurnText(this.combat.order[this.combat.turnIndex]);
                break;
            case 'turnStarted':
                this.dice.hide();
                this.units.forEach((u) => u.setActive(false));
                this.units.get(e.actorId)?.setActive(true);
                this.refreshTurnText(e.actorId);
                await this.wait(TIMING.turnPause);
                break;
            case 'abilityUsed': {
                const ability = this.combat.abilities[e.abilityId];
                const actor = getCombatant(this.combat, e.actorId);
                const view = this.units.get(e.actorId);
                if (!view) break;
                if (ability.damage) await view.playLunge(actor.side === 'hero' ? 1 : -1);
                else await view.playHop();
                break;
            }
            case 'attackRolled':
                this.dice.showD20(e.rolls, e.kept, e.outcome);
                await this.wait(TIMING.dice);
                break;
            case 'fateDieSpent':
                this.dice.showD4(e.value);
                this.drawFate(e.remaining);
                await this.wait(TIMING.fate);
                break;
            case 'damageDealt': {
                const view = this.units.get(e.targetId);
                const target = getCombatant(this.combat, e.targetId);
                if (!view) break;
                await view.flash();
                view.setHp(e.hpAfter, target.maxHp);
                view.floatText(`-${e.amount}`, COLORS.damage);
                if (target.side === 'hero') this.setPartyHp(e.targetId, e.hpAfter);
                if (e.crit) {
                    view.floatText('¡CRÍTICO!', COLORS.gold, true);
                    this.cameras.main.shake(120, 0.01);
                }
                await this.wait(TIMING.effect);
                break;
            }
            case 'healed': {
                const view = this.units.get(e.targetId);
                const target = getCombatant(this.combat, e.targetId);
                if (!view) break;
                view.setHp(e.hpAfter, target.maxHp);
                view.floatText(`+${e.amount}`, COLORS.heal);
                if (target.side === 'hero') this.setPartyHp(e.targetId, e.hpAfter);
                if (e.revived) view.revive();
                await this.wait(TIMING.effect);
                break;
            }
            case 'statusApplied': {
                const view = this.units.get(e.targetId);
                view?.setStatuses(getCombatant(this.combat, e.targetId).statuses);
                view?.floatText(STATUS_LABELS[e.status].name, COLORS.gold);
                break;
            }
            case 'statusExpired':
                this.units.get(e.targetId)?.setStatuses(getCombatant(this.combat, e.targetId).statuses);
                break;
            case 'combatantDowned': {
                const view = this.units.get(e.targetId);
                if (!view) break;
                await view.playDowned();
                if (getCombatant(this.combat, e.targetId).side === 'enemy') {
                    view.destroy();
                    this.units.delete(e.targetId);
                    this.enemySlotOf.delete(e.targetId);
                }
                break;
            }
            case 'summoned': {
                const view = this.addEnemyView(e.combatantId);
                this.refreshTurnText(this.combat.order[this.combat.turnIndex]);
                await view?.fadeIn();
                break;
            }
            case 'combatEnded':
                this.dice.hide();
                this.add
                    .text(LAYOUT.width / 2, 100, e.result === 'victory' ? TEXTS.labels.victoryTitle : TEXTS.labels.defeatTitle, {
                        fontFamily: FONT_UI,
                        fontSize: '32px',
                        color: COLORS.gold,
                    })
                    .setOrigin(0.5);
                await this.wait(TIMING.endDelay);
                break;
            case 'summonFailed':
                break;
        }
    }

    private setPartyHp (heroId: string, hp: number)
    {
        const heroes = this.combat.combatants.filter((c) => c.side === 'hero');
        const i = heroes.findIndex((c) => c.id === heroId);
        if (i >= 0) this.partyTexts[i].setText(formatHeroStatus({ ...heroes[i], hp }));
    }

    private async nextStep ()
    {
        if (this.closed) return;
        if (this.combat.result) {
            this.onCombatFinished();
            return;
        }
        if (this.combat.pending) {
            this.showFatePrompt();
            return;
        }
        const active = getActive(this.combat);
        if (active.side === 'hero') {
            this.showHeroActions();
            return;
        }
        this.promptText.setText(fill(TEXTS.labels.enemyTurn, { name: active.name }));
        this.busy = true;
        await this.wait(TIMING.enemyThink);
        if (this.closed) return;
        await this.playEvents(runEnemyTurn(this.combat, getSession().rng));
        void this.nextStep();
    }

    private clearActions ()
    {
        this.buttons.forEach((b) => b.destroy());
        this.buttons = [];
        this.units.forEach((u) => u.setTargetable(false));
    }

    private addButton (x: number, y: number, label: string, onClick: () => void, enabled = true)
    {
        const button = new TextButton(this, x, y, LAYOUT.buttonW, LAYOUT.buttonH, label, () => {
            if (!this.busy) onClick();
        });
        button.setEnabled(enabled);
        this.buttons.push(button);
        return button;
    }

    private showHeroActions ()
    {
        this.clearActions();
        const actor = getActive(this.combat);
        this.promptText.setText(fill(TEXTS.labels.chooseAbility, { name: actor.name }));
        const available = new Set(getAvailableAbilities(this.combat, actor.id).map((a) => a.id));
        actor.abilityIds.forEach((id, i) => {
            const ability = this.combat.abilities[id];
            const x = LAYOUT.buttonXs[i % LAYOUT.buttonXs.length];
            const y = i < LAYOUT.buttonXs.length ? LAYOUT.buttonY : LAYOUT.buttonRow2Y;
            this.addButton(
                x,
                y,
                formatAbilityButton(ability, actor.usesLeft[id]),
                () => this.chooseAbility(ability),
                available.has(id),
            );
        });
    }

    private chooseAbility (ability: AbilityDef)
    {
        const actor = getActive(this.combat);
        if (ability.target === 'singleEnemy' || ability.target === 'singleAlly') this.beginTargeting(ability);
        else void this.act({ actorId: actor.id, abilityId: ability.id });
    }

    private beginTargeting (ability: AbilityDef)
    {
        this.clearActions();
        const actor = getActive(this.combat);
        this.promptText.setText(TEXTS.labels.chooseTarget);
        for (const id of getValidTargets(this.combat, actor.id, ability.id)) {
            this.units.get(id)?.setTargetable(true, () => {
                if (this.busy) return;
                void this.act({ actorId: actor.id, abilityId: ability.id, targetId: id });
            });
        }
        this.addButton(LAYOUT.buttonXs[2], LAYOUT.buttonRow2Y, TEXTS.labels.cancel, () => this.showHeroActions());
    }

    private async act (intent: ActionIntent)
    {
        this.clearActions();
        await this.playEvents(performAction(this.combat, intent, getSession().rng));
        void this.nextStep();
    }

    private showFatePrompt ()
    {
        this.clearActions();
        const pending = this.combat.pending;
        if (!pending) return;
        this.promptText.setText(formatFatePrompt(this.combat));
        if (pending.stage !== 'attack') this.units.get(pending.targetId)?.setTargetable(true);
        this.addButton(LAYOUT.buttonXs[0], LAYOUT.buttonY, TEXTS.labels.spendFate, () => {
            this.clearActions();
            void this.playEvents(spendFateDie(this.combat, getSession().rng)).then(() => this.nextStep());
        });
        this.addButton(LAYOUT.buttonXs[1], LAYOUT.buttonY, TEXTS.labels.skipFate, () => {
            this.clearActions();
            void this.playEvents(declineFate(this.combat, getSession().rng)).then(() => this.nextStep());
        });
    }

    private onCombatFinished ()
    {
        this.clearActions();
        const { run } = getSession();
        finishEncounter(run, this.combat, CAMPAIGN);
        startTarget(this, afterCombatTarget(run));
    }
}
