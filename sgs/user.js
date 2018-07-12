const C = require('./constants');
const R = require('./common/results');
const FSM = require('./common/stateMachines');
const cardManager = require('./cards');
const sgsCards = require('./cards/cards');
const EventListener = require('./common/eventListener');


class User extends EventListener {
    constructor(sessionId, messageResp) {
        super();
        this.id = sessionId;
        this.state = C.USER_STATE.CREATED;

        this.name = '';
        this.resp = null;
        this.seatNum = null;
        this.role = null;
        this.figure = null;
        this.hp = 0;
        this.maxHp = 0;
        this.waiting = C.WAITING_FOR.NOTHING;
        this.faceUp = true;

        this.showFigure = false;
        this.cards = new Map();  // [];
        this.equipments = {
            weapon: null,
            armor: null,
            attackHorse: null,
            defenseHorse: null,
        };
        this.judgeStack = [];
        this.restoreCmds = [];

        this.roundOwner = false;
        this.phases = {
            RoundStartPhase: 1,
            RoundPreparePhase: 1,
            RoundJudgePhase: 1,
            RoundDrawCardPhase: 1,
            RoundPlayPhase: 1,
            RoundDiscardPhase: 1,
            RoundEndPhase: 1,
        };
        this.shaCount = 1;
        this.setResp(messageResp);
    }

    toJson(u) {
        let cards = [];
        (u.id === this.id) && this.cards.forEach((c) => {
            cards.push(c.toJsonString());
        });

        return {
            id: this.id,
            name: this.name,
            seatNum: this.seatNum,

            state: this.state,
            waiting: this.waiting,
            roundOwner: this.roundOwner,

            role: (u.id === this.id || this.role === C.ROLE.ZHUGONG || this.state === C.USER_STATE.DEAD) ? this.role : '?',
            figure: ((u.id === this.id || this.showFigure) && this.figure) ? this.figure.toJson() : null,
            hp: this.showFigure ? this.hp : 0,
            maxHp: this.showFigure ? this.maxHp : 0,
            faceUp: this.faceUp,
            judgeStack: this.judgeStack,

            cardCount: this.cards.size,
            cards,

            equipments: this.equipments,
        };
    }

    toJsonString(u) {
        return JSON.stringify(this.toJson(u));
    }

    setResp(resp) {
        if (this.resp) {
            this.resp.end('data: *DISCONNECTED\n\n');
        }
        this.resp = resp;
        this.reply(`CONNECTED ${this.id}`, true);
    }

    reply(data, selfMarker = true, addToResoreCmd = false) {
        // if (data != 'HB') console.log(`| <- ${data}`);
        this.resp.write("data: " + (selfMarker ? '*' : '-') + data + "\n\n");
        if (addToResoreCmd) {
            this.pushRestoreCmd({
                data,
                selfMarker,
            });
        }
    }

    pushRestoreCmd(cmd) {
        this.restoreCmds.push(cmd);
    }

    popRestoreCmd(cmd) {
        this.restoreCmds.pop();
    }

    restore() {
        for (let cmd of this.restoreCmds) {
            this.reply(cmd.data, cmd.selfMarker);
        }
    }

    setFigure(figure) {
        this.figure = figure;
        figure.owner = this;
        this.hp = figure.hp;
        this.maxHp = figure.hp;
    }

    addCards(cards) {
        for (let card of cards) {
            this.cards.set(card.pk, card);
        }
    }

    removeCardPks(cardPks) {
        for (let pk of cardPks) {
            this.cards.delete(pk);
        }
    }

    hasCard(card) {
        return this.cards.has(card.pk);
    }

    hasCardPk(cardPk) {
        return this.cards.has(cardPk);
    }

    pushJudge(card) {
        this.judgeStack.unshift({
            card: card,
        });
    }

    popJudge() {
        return this.judgeStack.shift();
    }

    equipCard(card) {
        this.equipments[card.equipType] = {
            card,
            state: C.SKILL_STATE.DISABLED,
        };

        card.setEquiper(this);
    }

    unequipCard(equipType) {
        let old = this.equipments[equipType];
        if (old) {
            old.card.setEquiper(null);
            this.equipments[equipType] = null;
            return old.card;
        }
        return null;
    }

    // ------

    * on(event, game, ctx = {}) {
        console.log(`|<U> ON ${this.name}(${this.figure.name}) ${event}`);
        return yield super.on(event, game, ctx);
    }

    // ------

    * roundPlayPhaseStart(game, ctx) {
        this.shaCount = 1;
        return yield this.figure.on('roundPlayPhaseStart', game, ctx);
    }

    * roundPlayPhaseEnd(game, ctx) {
        return yield this.figure.on('roundPlayPhaseEnd', game, ctx);
    }

    // ------

    * play(game, ctx) {
        let result = yield this.figure.on('play', game, ctx);
        if (!result && this.equipments.armor) {
            result = yield this.equipments.armor.card.on('play', game, ctx);
        }
        if (!result) {
        }
        return yield Promise.resolve(result);
    }

    distanceFrom(game, ctx) {
        let exDistance = this.figure.distanceFrom(game, ctx);
        exDistance += this.equipments.attackHorse === null ? 0 : -1;
        return exDistance;
    }

    distanceTo(game, ctx) {
        let exDistance = this.figure.distanceTo(game, ctx);
        exDistance += this.equipments.defenseHorse === null ? 0 : 1;
        return exDistance;
    }

    attackRange(game, ctx) {
        let exRange = this.figure.attackRange(game, ctx);
        exRange += this.equipments.weapon === null ? 1 : this.equipments.weapon.card.range;
        return exRange;
    }

    * useSha(game, ctx) {
        if (this.shaCount < 1) {
            console.log(`|<!> Use too many Sha`);
            return yield Promise.resolve(R.abort);
        }
        return yield Promise.resolve(R.success);
    }

    * usedSha(game, ctx) {
        this.shaCount--;
    }

    * useTao(game, ctx) {
        if (this.hp < this.maxHp) {
            game.message([ctx.sourceUser, '使用了', ctx.sourceCards]);
            ctx.heal = 1;
            yield this.on('heal', game, ctx);
            game.removeUserCards(ctx.sourceUser, ctx.sourceCards);
            game.discardCards(ctx.sourceCards);
        }
    }

    * damage(game, ctx) {
        let result = yield this.figure.on('beforeDamage', game, ctx);
        if (result.abort) {
            return yield Promise.resolve(result);
        }

        console.log(`|<U> HP - ${ctx.damage}`);
        this.hp -= ctx.damage;
        game.message([this, '受到', ctx.damage, '点伤害']);
        game.broadcastUserInfo(this);

        if (this.hp === 0) {
            // TODO game.userDying();
            yield this.on('dying', game, ctx);
        }

        if (this.state === C.USER_STATE.ALIVE) {
            yield this.figure.on('damage', game, ctx);
        }
    }

    * heal(game, ctx) {
        console.log(`<U> HP + ${ctx.heal}`);
        let willHeal = Math.min(this.maxHp - this.hp, ctx.heal);
        this.hp += willHeal;
        game.message([this, '恢复', willHeal, '点体力']);
        game.broadcastUserInfo(this);
        yield this.figure.on('heal', game, ctx);

        if (this.state === C.USER_STATE.DYING && this.hp > 0) {
            this.state = C.USER_STATE.ALIVE;
            game.broadcastUserInfo(this);
        }
    }

    * dying(game, ctx) {
        this.state = C.USER_STATE.DYING;
        game.broadcastUserInfo(this);

        // TODO require Tao
        for (let u of game.userRound()) {
            while (this.state === C.USER_STATE.DYING) {
                // 同一个人可以出多次桃救
                let command = yield game.waitConfirm(u, `${this.figure.name}濒死，是否为其出【桃】？`);
                if (command.cmd === C.CONFIRM.Y) {
                    let result = yield u.on('requireTao', game, ctx);
                    if (result.success) {
                        let cards = result.get();
                        game.removeUserCards(u, cards);
                        game.discardCards(cards);
                        ctx.heal = 1;
                        yield this.on('heal', game, ctx);
                    }
                } else {
                    break;
                }
            }

            if (this.state === C.USER_STATE.ALIVE) {
                break;
            }
        }

        if (this.hp <= 0) {
            yield this.on('die', game, ctx);
        }
    }

    * die(game, ctx) {
        this.state = C.USER_STATE.DEAD;
        game.userDead(this);
    }

    // NOTE: This is NOT an event handler
    * requireCard(game, cardClass, ctx) {
        const u = this;
        let result = yield game.waitFSM(u, FSM.get('requireSingleCard', game, {
            cardValidator: (command) => {
                let card = game.cardByPk(command.params);
                return (this.hasCard(card) && card instanceof cardClass);
            }
        }), ctx);

        if (result.success) {
            let card = result.get();
            return yield Promise.resolve(new R.CardResult().set(card));
        } else {
            return yield Promise.resolve(R.fail);
        }
    }

    * requireSha(game, ctx) {
        const u = this;
        let result;
        let cardClass = sgsCards.Sha;
        yield this.figure.on('requireSha', game, ctx);
        if (this.equipments.weapon) {
            yield this.equipments.weapon.card.on('requireSha', game, ctx);
        }

        const requireShaFSM = () => {
            let m = new FSM.Machine(game);
            m.addState(new FSM.State('CSE'), true);
            m.addState(new FSM.State('O'));
            m.addState(new FSM.State('S', function* (game, ctx, fsmContext) {
                let command = fsmContext.command;
                let skill = u.figure.skills[command.params[0]];
                let result = yield u.figure.useSkill(skill, game, ctx);
                let nextCmd = result.success ? 'OK' : 'CANCEL';
                fsmContext.result = result;
                return yield Promise.resolve({
                    command: nextCmd,
                });
            }));

            m.addTransition(new FSM.Transition('CSE', 'CARD', 'O',
                (command) => {
                    let card = game.cardByPk(command.params);
                    return (this.hasCard(card) && card instanceof cardClass);
                },
                (game, ctx) => {
                    ctx.card = game.cardByPk(ctx.command.params);
                }
            ));
            m.addTransition(new FSM.Transition('CSE', 'SKILL', 'S',
                (command) => {
                    let skill = u.figure.skills[command.params[0]];
                    return (skill.state === C.SKILL_STATE.ENABLED);
                }
            ));
            m.addTransition(new FSM.Transition('CSE', 'CANCEL', '_'));
            m.addTransition(new FSM.Transition('O', 'UNCARD', 'CSE', null,
                (game, ctx) => {
                    ctx.card = null;
                }
            ));
            m.addTransition(new FSM.Transition('O', 'OK', '_', null,
                (game, ctx) => {
                    return new R.CardResult().set(ctx.card);
                }
            ));
            m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));
            m.addTransition(new FSM.Transition('S', 'OK', '_', null,
                (game, ctx) => {
                    return ctx.result;
                }
            ));
            m.addTransition(new FSM.Transition('S', 'CANCEL', 'CSE'));

            m.setFinalHandler((r) => {
                return r.get().pop();
            });

            return m;
        };
        result = yield game.waitFSM(this, requireShaFSM(), ctx);
        return yield Promise.resolve(result);
    }

    * requireShan(game, ctx) {
        let result = yield this.figure.on('requireShan', game, ctx);
        if (!result.abort && result.fail && this.equipments.armor) {
            result = yield this.equipments.armor.card.on('requireShan', game, ctx);
        }
        if (!result.abort && result.fail) {
            result = yield this.requireCard(game, sgsCards.Shan, ctx);
        }
        return yield Promise.resolve(result);
    }

    * requireTao(game, ctx) {
        let result = yield this.figure.on('requireTao', game, ctx);
        if (!result.abort && result.fail) {
            result = yield this.requireCard(game, sgsCards.Tao, ctx);
        }
        return yield Promise.resolve(result);
    }

    * judge(game, ctx) {
        let result = yield this.figure.on('judge', game, ctx);
        return yield Promise.resolve(result);
    }

    * beforeJudgeEffect(game, ctx) {
        let result = yield this.figure.on('beforeJudgeEffect', game, ctx);
        return yield Promise.resolve(result);
    }

    * shaTarget(game, ctx) {
        yield this.figure.on('shaTarget', game, ctx);
        if (this.equipments.weapon) {
            yield this.equipments.weapon.card.on('shaTarget', game, ctx);
        }
        return yield Promise.resolve(R.success);
    }

    * beShaTarget(game, ctx) {
        let result = yield this.figure.on('beShaTarget', game, ctx);
        if (!result.abort && result.fail && this.equipments.armor) {
            result = yield this.equipments.armor.card.on('beShaTarget', game, ctx);
        }
        return yield Promise.resolve(result);
    }

    * shaBeenShan(game, ctx) {
        let result = yield this.figure.on('shaBeenShan', game, ctx);
        if (!result.abort && result.fail && this.equipments.weapon) {
            result = yield this.equipments.weapon.card.on('shaBeenShan', game, ctx);
        }
        return yield Promise.resolve(result);
    }
}

module.exports = User;
