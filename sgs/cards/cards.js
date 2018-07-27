const aggregation = require('aggregation/es6');
const uuid = require('uuid/v4');
const C = require('../constants');
const R = require('../common/results');
const U = require('../utils');
const {CardContext} = require('../context');
const FSM = require('../common/fsm');
const EventListener = require('../common/eventListener');
const Damage = require('../common/damage');


const initCardFSM = (game, parentCtx, opt) => {
    const {
        u,
        targetValidator,
        targetCount,
    } = opt;
    let m = new FSM.Machine(game, parentCtx);
    m.setContext(opt.initCtx);

    switch (targetCount) {
        case C.TARGET_SELECT_TYPE.SELF:
        case C.TARGET_SELECT_TYPE.ALL:
        case C.TARGET_SELECT_TYPE.ALL_OTHERS:
            switch (targetCount) {
                case C.TARGET_SELECT_TYPE.SELF:
                    m.setContext({targets: [u]});
                    break;
                case C.TARGET_SELECT_TYPE.ALL:
                    m.setContext({targets: game.userRound(u)});
                    break;
                case C.TARGET_SELECT_TYPE.ALL_OTHERS:
                    m.setContext({targets: game.userRound(u, true)});
                    break;
            }
            m.addState(new FSM.State('O'), true);

            m.addTransition(new FSM.Transition('O', 'OK', '_', null,
                (game, info) => {
                    info.result = new R.CardTargetResult().set(info.card, info.targets);
                }
            ));
            m.addTransition(new FSM.Transition('O', 'CARD', '_', null,
                (game, info) => {
                    u.reply(`UNSELECT CARD ${info.card.pk}`);
                    let card = game.cardByPk(info.command.params);
                    info.result = new R.CardResult(R.RESULT_STATE.ABORT).set(card);
                }
            ));
            m.addTransition(new FSM.Transition('O', 'UNCARD', '_'));
            m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));
            break;
        case C.TARGET_SELECT_TYPE.SINGLE:
            m.addState(new FSM.State('T'), true);
            m.addState(new FSM.State('O'));
            m.addTransition(new FSM.Transition('T', 'TARGET', 'O',
                targetValidator,
                (game, info) => {
                    info.target = game.userByPk(info.command.params);
                }
            ));
            m.addTransition(new FSM.Transition('T', 'CARD', '_', null,
                (game, info) => {
                    u.reply(`UNSELECT CARD ${info.card.pk}`);
                    let card = game.cardByPk(info.command.params);
                    info.result = new R.CardResult(R.RESULT_STATE.ABORT).set(card);
                }
            ));
            m.addTransition(new FSM.Transition('T', 'UNCARD', '_'));
            m.addTransition(new FSM.Transition('T', 'CANCEL', '_'));

            m.addTransition(new FSM.Transition('O', 'TARGET', 'O',
                targetValidator,
                (game, info) => {
                    u.reply(`UNSELECT TARGET ${info.target.id}`);
                    info.target = game.userByPk(info.command.params);
                }
            ));
            m.addTransition(new FSM.Transition('O', 'UNTARGET', 'T', null,
                (game, info) => {
                    info.target = null;
                }
            ));
            m.addTransition(new FSM.Transition('O', 'CARD', '_', null,
                (game, info) => {
                    u.reply(`UNSELECT CARD ${info.card.pk}`);
                    u.reply(`UNSELECT TARGET ${info.target.id}`);
                    let card = game.cardByPk(info.command.params);
                    info.result = new R.CardResult(R.RESULT_STATE.ABORT).set(card);
                }
            ));
            m.addTransition(new FSM.Transition('O', 'OK', '_', null,
                (game, info) => {
                    info.result = new R.CardTargetResult().set(info.card, info.target);
                }
            ));
            m.addTransition(new FSM.Transition('O', 'UNCARD', '_'));
            m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));
            break;
        default:
            m.setContext({targets: new Set()});
            m.addState(new FSM.State('T'), true);
            m.addState(new FSM.State('O'));
            m.addTransition(new FSM.Transition('T', 'TARGET',
                (game, info) => {
                    return (info.targets.size < targetCount) ? 'T' : 'O';
                },
                targetValidator,
                (game, info) => {
                    info.targets.add(game.userByPk(info.command.params));
                }
            ));
            m.addTransition(new FSM.Transition('T', 'UNTARGET', 'T',
                targetValidator,
                (game, info) => {
                    info.targets.delete(game.userByPk(info.command.params));
                }
            ));
            m.addTransition(new FSM.Transition('T', 'CARD', '_', null,
                (game, info) => {
                    u.reply(`UNSELECT CARD ${info.card.pk}`);
                    for (let target of info.targets) {
                        u.reply(`UNSELECT TARGET ${target.id}`);
                    }
                    let card = game.cardByPk(info.command.params);
                    info.result = new R.CardResult(R.RESULT_STATE.ABORT).set(card);
                }
            ));
            m.addTransition(new FSM.Transition('T', 'UNCARD', '_'));
            m.addTransition(new FSM.Transition('T', 'CANCEL', '_'));

            m.addTransition(new FSM.Transition('O', 'UNTARGET', 'T',
                targetValidator,
                (game, info) => {
                    info.targets.delete(game.userByPk(info.command.params));
                }
            ));
            m.addTransition(new FSM.Transition('O', 'CARD', '_',
                (game, info) => {
                    u.reply(`UNSELECT CARD ${info.card.pk}`);
                    for (let target of info.targets) {
                        u.reply(`UNSELECT TARGET ${target.id}`);
                    }
                    let card = game.cardByPk(info.command.params);
                    info.result = new R.CardResult(R.RESULT_STATE.ABORT).set(card);
                }
            ));
            m.addTransition(new FSM.Transition('O', 'OK', '_', null,
                (game, info) => {
                    info.result = new R.CardTargetResult().set(info.card, U.toArray(info.targets));
                }
            ));
            m.addTransition(new FSM.Transition('O', 'UNCARD', '_'));
            m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));
            break;
    }

    return m;
};


class CardBase {
    constructor(suit, number) {
        this.pk = uuid();
        this.suit = suit;
        this.number = number;

        this.faked = false;
        this.originCards = null;
    }

    getOriginCards() {
        let result = new Set();
        if (this.faked) {
            this.originCards.forEach(oc => {
                result = new Set([...result, ...oc.getOriginCards()]);
            });
        } else {
            result.add(this);
        }
        return result;
    }

    toJson() {
        return {
            pk: this.pk,
            name: this.name,
            shortName: this.shortName || this.name.substr(0, 1),
            category: this.category,
            suit: this.suit,
            number: this.number,
            faked: this.faked,
        };
    }

    toJsonString() {
        return JSON.stringify(this.toJson());
    }

    toString() {
        let str = this.name;
        if (this.faked) {
            str += `(${U.toArray(this.getOriginCards()).map(c => c.toString()).join(',')})`;
        }
        return `[Card: ${str}]`;
    }

    * init(game, ctx) {
        // 初始化：从用户点击该牌开始，到选中目标，到最终OK为止。
        // 此为连贯动作，期间不应插入其它事件。
        return yield Promise.resolve(new R.CardResult().set(this));
    }

    * start(game, ctx) {
        return yield Promise.resolve(R.success);
    }
}


class NormalCard extends CardBase {
    constructor(suit, number) {
        super(suit, number);
        this.category = C.CARD_CATEGORY.NORMAL;
    }

    * start(game, ctx) {
        if (this.run instanceof Function) {
            yield this.run(game, ctx);
        }
    }
}


class SilkBagCard extends CardBase {
    constructor(suit, number) {
        super(suit, number);
        this.category = C.CARD_CATEGORY.SILK_BAG;
        this.distance = Infinity;
        this.targetCount = 1;  // Could be C.TARGET_SELECT_TYPE.* or an positive integer
    }

    * init(game, ctx) {
        let u = ctx.i.sourceUser;
        let opt = {
            u,
            targetValidator: (command) => {
                let target = game.userByPk(command.params);
                return target.id !== u.id;
            },
            targetCount: this.targetCount,
            initCtx: {
                card: this,
            }
        };
        return yield game.waitFSM(u, initCardFSM(game, ctx, opt), ctx);
    }

    * start(game, ctx) {
        let u = ctx.i.sourceUser;
        let card = U.toSingle(ctx.i.card);
        let targets = ctx.i.targets;
        let targetMsg = (card.targetCount < C.TARGET_SELECT_TYPE.SINGLE) ? '' : ['对', targets];
        game.message([u, targetMsg, '使用了', card]);

        for (let target of targets) {
            // TODO WuXieKeJi
            ctx.i.currentTarget = target;
            yield this.run(game, ctx);
        }
    }
}


class DelayedSilkBagCard extends CardBase {
    constructor(suit, number) {
        super(suit, number);
        this.category = C.CARD_CATEGORY.DELAYED_SILK_BAG;
        this.distance = Infinity;
        this.targetCount = 1;  // Could be C.TARGET_SELECT_TYPE.* or an positive integer
    }

    * init(game, ctx) {
        let u = ctx.i.sourceUser;
        let distance = this.distance;
        let opt = {
            u,
            targetValidator: (command) => {
                let target = game.userByPk(command.params);
                return (target.id !== u.id
                    && game.distanceOf(u, target) <= distance
                    && !target.hasJudgeType(this));
            },
            targetCount: this.targetCount,
            initCtx: {
                card: this,
            }
        };
        return yield game.waitFSM(u, initCardFSM(game, ctx, opt), ctx);
    }

    * start(game, ctx) {
        let u = ctx.i.sourceUser;
        let card = U.toSingle(ctx.i.card);
        let targets = ctx.i.targets;
        game.message([u, '对', targets, '使用了', card]);
        ctx.i.targets.forEach((t) => game.pushUserJudge(t, card));
        ctx.handlingCards.delete(card);
    }

    * judgeEffect(u, game) {
        game.discardCards(this);
    }

    * judgeFailed(u, game) {
        game.discardCards(this);
    }
}


class EquipmentCard extends aggregation(CardBase, EventListener) {
    constructor(suit, number) {
        super(suit, number);
        this.category = C.CARD_CATEGORY.EQUIPMENT;
        this.targetCount = C.TARGET_SELECT_TYPE.SELF;
        this.equiperPk = null;
    }

    setEquiper(user) {
        this.equiperPk = user === null ? null : user.id;
    }

    equiper(game) {
        return game.userByPk(this.equiperPk);
    }

    * init(game, ctx) {
        let u = ctx.i.sourceUser;
        let opt = {
            u,
            targetValidator: (command) => {
                let target = game.userByPk(command.params);
                return target.id !== u.id;
            },
            targetCount: this.targetCount,
            initCtx: {
                card: this,
            }
        };
        return yield game.waitFSM(u, initCardFSM(game, ctx, opt), ctx);
    }

    * start(game, ctx) {
        yield this.run(game, ctx);
    }

    * run(game, ctx) {
        yield game.equipUserCard(U.toSingle(ctx.i.targets), this);
        return yield Promise.resolve(R.success);
    }

    * on(event, game, ctx) {
        console.log(`|<C> ON ${this.name} ${event}`);
        return yield super.on(event, game, ctx);
    }
}


class WeaponCard extends EquipmentCard {
    constructor(suit, number) {
        super(suit, number);
        this.equipType = C.EQUIP_TYPE.WEAPON;
        this.range = 0;
    }
}


class ArmorCard extends EquipmentCard {
    constructor(suit, number) {
        super(suit, number);
        this.equipType = C.EQUIP_TYPE.ARMOR;
    }
}


class AttackHorseCard extends EquipmentCard {
    constructor(suit, number) {
        super(suit, number);
        this.equipType = C.EQUIP_TYPE.ATTACK_HORSE;
    }
}


class DefenseHorseCard extends EquipmentCard {
    constructor(suit, number) {
        super(suit, number);
        this.equipType = C.EQUIP_TYPE.DEFENSE_HORSE;
    }
}


class Sha extends NormalCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '杀';
        this.targetCount = 1;  // TODO: How many targets are required
    }

    * init(game, ctx) {
        let u = ctx.i.sourceUser;
        yield u.on('useSha', game, ctx);
        if (ctx.phaseCtx.i.shaCount < 1) {
            console.log(`|[i] Use too many Sha`);
            return yield Promise.resolve(R.fail);
        }
        let opt = {
            u,
            targetValidator: (command) => {
                let target = game.userByPk(command.params);
                return target.id !== u.id && game.inAttackRange(u, target);
            },
            targetCount: this.targetCount,
            initCtx: {
                card: this,
            }
        };
        return yield game.waitFSM(u, initCardFSM(game, ctx, opt), ctx);
    }

    * targetEvents(game, ctx) {
        const u = ctx.i.sourceUser;

        // 指定目标时
        yield u.on('shaTarget', game, ctx);

        // 成为目标时
        for (let t of ctx.i.targets) {
            yield t.on('beShaTarget', game, ctx);
        }

        // 指定目标后
        yield u.on('afterShaTarget', game, ctx);

        // 成为目标后
        for (let t of ctx.i.targets) {
            yield t.on('afterBeShaTarget', game, ctx);
        }
    }

    * run(game, ctx) {
        ctx.i.shanAble = new Map();
        if (!ctx.i.skipShaInitStage) {
            yield this.targetEvents(game, ctx);
        }

        const u = ctx.i.sourceUser;
        const card = ctx.i.card;
        const targets = ctx.i.targets;
        ctx.i.damage = new Damage(u, card, 1);

        yield game.removeUserCards(ctx.i.sourceUser, card);
        game.message([ctx.i.sourceUser, '对', ctx.i.targets, '使用', card]);

        for (let target of targets) {
            ctx.i.hit = true;  // 命中
            ctx.i.shaTarget = target;
            ctx.i.exDamage = 0;

            if (!ctx.i.shanAble.has(target) || ctx.i.shanAble.get(target)) {
                let result = yield target.on('requireShan', game, ctx);
                if (result.success) {
                    if (result instanceof R.CardResult) {
                        let cards = result.get();
                        game.message([target, '使用了', cards]);
                        yield game.removeUserCards(target, cards, true);
                    }

                    yield target.on('usedShan', game, ctx);
                    ctx.i.hit = false;
                    yield u.on('shaBeenShan', game, ctx);
                }
            }

            if (ctx.i.hit) {
                yield u.on('shaHitTarget', game, ctx);
                yield target.on('damage', game, ctx);
            }
        }

        yield u.on('usedSha', game, ctx);
    }
}


class Shan extends NormalCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '闪';
    }

    * init(game, ctx) {
        return yield Promise.resolve(R.fail);
    }
}


class Tao extends NormalCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '桃';
        this.targetCount = C.TARGET_SELECT_TYPE.SELF;
    }

    * init(game, ctx) {
        let u = ctx.i.sourceUser;
        if (u.hp >= u.maxHp) {
            return yield Promise.resolve(R.fail);
        }
        let opt = {
            u,
            targetValidator: (command) => {
                let target = game.userByPk(command.params);
                return target.id !== u.id;
            },
            targetCount: this.targetCount,
            initCtx: {
                card: this,
            }
        };
        return yield game.waitFSM(u, initCardFSM(game, ctx, opt), ctx);
    }

    * run(game, ctx) {
        game.message([ctx.i.sourceUser, '使用了', ctx.i.card]);
        ctx.i.heal = 1;
        return yield U.toSingle(ctx.i.targets).on('useTao', game, ctx);
    }
}


class JueDou extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '决斗';
    }

    * run(game, ctx) {
        let u = ctx.i.sourceUser;
        let t = ctx.i.currentTarget;

        let users = [t, u];
        let done = false;
        let loser;
        while (!done) {
            for (let _u of users) {
                let result = yield _u.on('requireSha', game, ctx);
                if (result.success) {
                    game.discardCards(ctx.i.card);
                    ctx.handlingCards.delete(ctx.i.card);

                    ctx.i.sourceUser = _u;
                    ctx.i.card = result.get();
                    yield game.removeUserCards(_u, ctx.i.card);
                    ctx.handlingCards.add(ctx.i.card);
                    game.message([_u, '打出了', ctx.i.card]);
                } else {
                    done = true;
                    loser = _u;
                    break;
                }
            }
        }

        ctx.i.damage = new Damage(ctx.i.sourceUser, ctx.i.card, 1);
        yield loser.on('damage', game, ctx);
    }
}


class GuoHeChaiQiao extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '过河拆桥';
    }

    * run(game, ctx) {
        let u = ctx.i.sourceUser;
        let t = ctx.i.currentTarget;

        // Show all card candidates
        let cardCandidates = t.cardCandidates();
        u.reply(`CARD_CANDIDATE ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
        let command = yield game.wait(u, {
            validCmds: ['CARD_CANDIDATE'],
            validator: (command) => {
                const pks = command.params;
                return pks.length === 1;
            },
        });
        u.reply(`CLEAR_CANDIDATE`);
        u.popRestoreCmd('CARD_CANDIDATE');

        let card = game.cardByPk(command.params);
        game.message([u, '拆掉了', t, '的一张牌', card]);
        yield game.removeUserCardsEx(t, card, true);
    }
}


class NanManRuQin extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '南蛮入侵';
        this.targetCount = C.TARGET_SELECT_TYPE.ALL_OTHERS;
    }

    * run(game, ctx) {
        const t = ctx.i.currentTarget;
        ctx.i.damage = new Damage(ctx.i.sourceUser, this, 1);
        let result = yield t.on('requireSha', game, ctx);
        if (result.success) {
            let card = result.get();
            game.message([t, '打出了', card]);
            yield game.removeUserCards(t, card, true);
        } else {
            yield t.on('damage', game, ctx);
        }
    }
}


class WuZhongShengYou extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '无中生有';
        this.targetCount = C.TARGET_SELECT_TYPE.SELF;
    }

    * run(game, ctx) {
        const u = ctx.i.sourceUser;
        yield game.removeUserCards(u, ctx.i.card, true);
        game.message([u, '使用', this, '获得两张牌']);
        game.dispatchCards(u, 2);
    }
}


class LeBuSiShu extends DelayedSilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '乐不思蜀';
        this.shortName = '乐';
    }

    judge(card) {
        return C.CARD_SUIT.HEART !== card.suit;
    }

    * judgeEffect(u, game) {
        u.phases.RoundPlayPhase = 0;
        yield super.judgeEffect(u, game);
    }
}


class BingLiangCunDuan extends DelayedSilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '兵粮寸断';
        this.shortName = '断';
        this.distance = 1;
    }

    judge(card) {
        return C.CARD_SUIT.CLUB !== card.suit;
    }

    * judgeEffect(u, game) {
        u.phases.RoundDrawCardPhase = 0;
        yield super.judgeEffect(u, game);
    }
}


class ShanDian extends DelayedSilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '闪电';
        this.shortName = '电';
        this.targetCount = C.TARGET_SELECT_TYPE.SELF;
    }

    judge(card) {
        return (C.CARD_SUIT.SPADE === card.suit && 2 <= card.number && card.number <= 9);
    }

    * judgeEffect(u, game) {
        let ctx = new CardContext(game, this, {
            damage: new Damage(null, this, 3),
        });
        yield u.on('damage', game, ctx);
        yield super.judgeEffect(u, game);
    }

    * judgeFailed(u, game) {
        yield game.removeUserJudge(u, this);
        for (let next of game.userRound(u, true)) {
            if (!next.hasJudgeType(this)) {
                game.pushUserJudge(next, this);
                return;
            }
        }
        game.pushUserJudge(u, this);
    }
}


class QingLongYanYueDao extends WeaponCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '青龙偃月刀';
        this.shortName = '龙';
        this.range = 3;
    }

    * s1(game, ctx) {
        let u = this.equiper(game);
        let result = yield u.on('requireSha', game, ctx);
        if (result.success) {
            let card = result.get();
            let cardCtx = new CardContext(game, card, {
                sourceUser: u,
                targets: U.toSet(ctx.i.shaTarget),
                skipShaInitStage: true,
                damage: new Damage(u, card, 1),
            }).linkParent(ctx.parentCtx);
            cardCtx.handlingCards.add(card);
            game.message([u, '发动了', this, '使用了', cardCtx.i.card, '追杀', cardCtx.i.targets]);
            cardCtx.phaseCtx.i.shaCount++;  // 青龙偃月刀算额外的杀
            result = yield card.start(game, cardCtx);
            game.discardCards(cardCtx.allHandlingCards());
            return yield Promise.resolve(result);
        }
    }

    * shaBeenShan(game, ctx) {
        let u = this.equiper(game);
        let command = yield game.waitConfirm(u, `是否使用武器【${this.name}】？`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.s1(game, ctx);
        }
        return yield Promise.resolve(R.success);
    }
}


class GuDingDao extends WeaponCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '古锭刀';
        this.shortName = '古';
        this.range = 2;
    }

    * shaHitTarget(game, ctx) {
        const u = this.equiper(game);
        const target = ctx.i.shaTarget;
        if (target.cards.size <= 0) {
            game.message([u, '的装备', this, '生效，此【杀】伤害+1']);
            ctx.i.exDamage += 1;
        }
        return yield Promise.resolve(R.success);
    }
}


class CiXiongShuangGuJian extends WeaponCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '雌雄双股剑';
        this.shortName = '双';
        this.range = 2;
    }

    * afterShaTarget(game, ctx) {
        const u = ctx.i.sourceUser;
        for (let t of ctx.i.targets) {
            if (u.gender !== t.gender) {
                let command = yield game.waitConfirm(u, `是否对${t.figure.name}使用武器【${this.name}】？`);
                if (command.cmd === C.CONFIRM.Y) {
                    game.message([u, '对', t, '发动武器', this]);
                    let choice = '1';
                    let choices = [
                        `弃一张手牌`,
                        `让${u.figure.name}摸一张牌`,
                    ];

                    // 有手牌，才可以选择，否则直接选2
                    if (t.cards.size > 0) {
                        command = yield game.waitChoice(t, `请选择`, choices);
                        t.reply(`CLEAR_CANDIDATE`);
                        choice = command.params[0];
                    }

                    game.message([t, '选择: ', choices[parseInt(choice)]]);

                    if (choice === '0') {
                        let result = R.fail;
                        while (!result.success) {
                            result = yield t.requireCard(game, CardBase, ctx);
                        }
                        game.message([t, '弃掉一张手牌']);
                        yield game.removeUserCards(t, result.get(), true);
                    } else {
                        game.message([u, '获得一张牌']);
                        game.dispatchCards(u);
                    }
                }
            }
        }
    }
}


class GuanShiFu extends WeaponCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '贯石斧';
        this.shortName = '贯';
        this.range = 3;
    }

    * shaBeenShan(game, ctx) {
        let u = this.equiper(game);
        let cardCandidates = u.cardCandidates({
            includeJudgeCards: false,
            showHandCards: true,
        }).filter(c => c.card.pk !== this.pk);  // 排除当前装备的贯石斧

        if (cardCandidates.length >= 2) {
            let command = yield game.waitConfirm(u, `是否使用武器【${this.name}】？`);
            if (command.cmd === C.CONFIRM.Y) {
                u.reply(`CARD_CANDIDATE ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
                let command = yield game.wait(u, {
                    validCmds: ['CARD_CANDIDATE'],
                    validator: (command) => {
                        const pks = command.params;
                        return pks.length === 2;
                    },
                });
                u.reply(`CLEAR_CANDIDATE`);
                u.popRestoreCmd('CARD_CANDIDATE');

                let cards = game.cardsByPk(command.params);
                game.message([u, '弃掉', cards, '，发动武器', this, '使【杀】强制命中']);
                yield game.removeUserCardsEx(u, cards, true);
                ctx.i.hit = true;
            }
        }
        return yield Promise.resolve(R.success);
    }
}


class ZhuGeLianNu extends WeaponCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '诸葛连弩';
        this.shortName = '弩';
        this.range = 1;
    }

    * run(game, ctx) {
        ctx.phaseCtx.i.shaCount = Infinity;
        return yield super.run(game, ctx);
    }

    * play(game, ctx) {
        ctx.phaseCtx.i.shaCount = Infinity;
    }
}


class BaGuaZhen extends ArmorCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '八卦阵';
        this.shortName = '卦';
    }

    judge(card) {
        return [C.CARD_SUIT.HEART, C.CARD_SUIT.DIAMOND].includes(card.suit);
    }

    * s1(game, ctx) {
        let u = this.equiper(game);

        game.message([u, '发动了【', this.name, '】']);
        let result = yield game.doJudge(u, this.judge);
        game.message([u, '判定【', this.name, '】为', result.get(), '判定', result.success ? '生效' : '未生效']);

        return result;
    }

    * requireShan(game, ctx) {
        let u = this.equiper(game);
        let command = yield game.waitConfirm(u, `是否使用防具【${this.name}】？`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.s1(game, ctx);
        }
        return yield Promise.resolve(R.fail);
    }
}


class DiLu extends AttackHorseCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '的卢-1';
    }
}


class ChiTu extends DefenseHorseCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '赤兔+1';
    }
}


const cardSet = new Map();

[
    // 基本牌
    new Sha(C.CARD_SUIT.SPADE, 10),
    new Sha(C.CARD_SUIT.SPADE, 10),
    new Sha(C.CARD_SUIT.HEART, 10),
    new Sha(C.CARD_SUIT.CLUB, 3),
    new Sha(C.CARD_SUIT.CLUB, 6),
    new Sha(C.CARD_SUIT.CLUB, 9),
    new Sha(C.CARD_SUIT.CLUB, 10),
    new Sha(C.CARD_SUIT.DIAMOND, 9),

    new Shan(C.CARD_SUIT.DIAMOND, 2),
    new Shan(C.CARD_SUIT.DIAMOND, 4),
    new Shan(C.CARD_SUIT.DIAMOND, 8),
    new Shan(C.CARD_SUIT.DIAMOND, 11),

    new Tao(C.CARD_SUIT.HEART, 5),
    new Tao(C.CARD_SUIT.HEART, 7),
    new Tao(C.CARD_SUIT.DIAMOND, 2),

    // 非延时锦囊
    new JueDou(C.CARD_SUIT.SPADE, 1),
    new JueDou(C.CARD_SUIT.CLUB, 1),
    new JueDou(C.CARD_SUIT.DIAMOND, 1),

    new GuoHeChaiQiao(C.CARD_SUIT.SPADE, 3),
    new GuoHeChaiQiao(C.CARD_SUIT.SPADE, 4),
    new GuoHeChaiQiao(C.CARD_SUIT.SPADE, 12),
    new GuoHeChaiQiao(C.CARD_SUIT.CLUB, 3),
    new GuoHeChaiQiao(C.CARD_SUIT.CLUB, 4),
    new GuoHeChaiQiao(C.CARD_SUIT.HEART, 12),

    new WuZhongShengYou(C.CARD_SUIT.HEART, 7),
    new WuZhongShengYou(C.CARD_SUIT.HEART, 8),
    new WuZhongShengYou(C.CARD_SUIT.HEART, 9),
    new WuZhongShengYou(C.CARD_SUIT.HEART, 11),

    new NanManRuQin(C.CARD_SUIT.SPADE, 7),
    new NanManRuQin(C.CARD_SUIT.CLUB, 7),

    // 延时锦囊
    new LeBuSiShu(C.CARD_SUIT.SPADE, 6),
    new LeBuSiShu(C.CARD_SUIT.HEART, 6),
    new LeBuSiShu(C.CARD_SUIT.CLUB, 6),

    new BingLiangCunDuan(C.CARD_SUIT.SPADE, 10),
    new BingLiangCunDuan(C.CARD_SUIT.CLUB, 4),

    new ShanDian(C.CARD_SUIT.SPADE, 1),
    new ShanDian(C.CARD_SUIT.HEART, 12),

    // 武器
    new QingLongYanYueDao(C.CARD_SUIT.SPADE, 5),

    new GuDingDao(C.CARD_SUIT.SPADE, 1),

    new CiXiongShuangGuJian(C.CARD_SUIT.SPADE, 2),

    // new FangTianHuaJi(C.CARD_SUIT.DIAMOND, 12),
    new GuanShiFu(C.CARD_SUIT.DIAMOND, 5),
    // new HanBingJian(C.CARD_SUIT.SPADE, 2),
    // new QiLinGong(C.CARD_SUIT.HEART, 5),
    // new QingGangJian(C.CARD_SUIT.SPADE, 6),
    // new YinYueQiang(C.CARD_SUIT.DIAMOND, 12),
    // new ZhangBaSheMao(C.CARD_SUIT.SPADE, 12),
    // new ZhuQueYuShan(C.CARD_SUIT.DIAMOND, 1),
    new ZhuGeLianNu(C.CARD_SUIT.DIAMOND, 1),
    new ZhuGeLianNu(C.CARD_SUIT.CLUB, 1),

    // 防具
    new BaGuaZhen(C.CARD_SUIT.SPADE, 2),
    new BaGuaZhen(C.CARD_SUIT.CLUB, 2),

    // -1马
    new DiLu(C.CARD_SUIT.CLUB, 5),

    // +1马
    new ChiTu(C.CARD_SUIT.HEART, 5),

].map((c) => cardSet.set(c.pk, c));

module.exports = {
    cardSet,

    CardBase,
    NormalCard,
    SilkBagCard,
    DelayedSilkBagCard,
    EquipmentCard,
    WeaponCard,

    Sha,
    Shan,
    Tao,

    JueDou,
    GuoHeChaiQiao,
    WuZhongShengYou,
    NanManRuQin,

    LeBuSiShu,
    BingLiangCunDuan,
    ShanDian,

    QingLongYanYueDao,
    GuDingDao,
    CiXiongShuangGuJian,
    GuanShiFu,

    DiLu,
    ChiTu,
};
