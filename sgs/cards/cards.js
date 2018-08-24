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
    m.setInfo(opt.initInfo);

    switch (targetCount) {
        case C.TARGET_SELECT_TYPE.SELF:
        case C.TARGET_SELECT_TYPE.ALL:
        case C.TARGET_SELECT_TYPE.ALL_OTHERS:
            switch (targetCount) {
                case C.TARGET_SELECT_TYPE.SELF:
                    m.setInfo({targets: [u]});
                    break;
                case C.TARGET_SELECT_TYPE.ALL:
                    m.setInfo({targets: game.userRound(u)});
                    break;
                case C.TARGET_SELECT_TYPE.ALL_OTHERS:
                    m.setInfo({targets: game.userRound(u, true)});
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
        case C.TARGET_SELECT_TYPE.ONE_OR_MORE:
            m.setInfo({targets: new Set()});
            m.addState(new FSM.State('T'), true);
            m.addState(new FSM.State('TO'));
            m.addTransition(new FSM.Transition('T', 'TARGET', 'TO',
                targetValidator,
                (game, info) => {
                    info.targets.add(game.userByPk(info.command.params));
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

            m.addTransition(new FSM.Transition('TO', 'TARGET', 'TO',
                targetValidator,
                (game, info) => {
                    info.targets.add(game.userByPk(info.command.params));
                }
            ));
            m.addTransition(new FSM.Transition('TO', 'UNTARGET',
                (game, info) => {
                    return (info.targets.size <= 0) ? 'T' : 'TO';
                },
                null,
                (game, info) => {
                    info.targets.delete(game.userByPk(info.command.params));
                }
            ));
            m.addTransition(new FSM.Transition('TO', 'CARD', '_', null,
                (gamec, info) => {
                    u.reply(`UNSELECT CARD ${info.card.pk}`);
                    for (let target of info.targets) {
                        u.reply(`UNSELECT TARGET ${target.id}`);
                    }
                    let card = game.cardByPk(info.command.params);
                    info.result = new R.CardResult(R.RESULT_STATE.ABORT).set(card);
                }
            ));
            m.addTransition(new FSM.Transition('TO', 'OK', '_', null,
                (game, info) => {
                    info.result = new R.CardTargetResult().set(info.card, U.toArray(info.targets));
                }
            ));
            m.addTransition(new FSM.Transition('TO', 'UNCARD', '_'));
            m.addTransition(new FSM.Transition('TO', 'CANCEL', '_'));
            break;
        default:
            m.setInfo({targets: new Set()});
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
            m.addTransition(new FSM.Transition('T', 'UNTARGET', 'T', null,
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

            m.addTransition(new FSM.Transition('O', 'UNTARGET', 'T', null,
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
        this.targetCount = C.TARGET_SELECT_TYPE.SINGLE;  // Could be C.TARGET_SELECT_TYPE.* or an positive integer
        this.targetValidators = [
            FSM.BASIC_VALIDATORS.notMeTargetValidator,
        ];
    }

    * init(game, ctx) {
        let u = ctx.i.sourceUser;
        let opt = {
            u,
            targetValidator: this.targetValidators,
            targetCount: this.targetCount,
            initInfo: {
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

        yield this.prepare(game, ctx);

        for (let target of targets) {
            ctx.i.silkCardEffect = true;
            ctx.i.currentTarget = target;

            yield target.on('beforeScrollCardEffect', game, ctx);

            if (ctx.i.silkCardEffect) {
                yield this.run(game, ctx);
            } else {
                yield this.skip(game, ctx);
            }
        }

        yield this.finish(game, ctx);
    }

    * run(game, ctx) {
    }

    * skip(game, ctx) {
    }

    * prepare(game, ctx) {
    }

    * finish(game, ctx) {
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
                    && game.distanceOf(u, target, ctx) <= distance
                    && !target.hasJudgeType(this));
            },
            targetCount: this.targetCount,
            initInfo: {
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

    * judgeEffect(u, game, ctx) {
        game.discardCards(this);
    }

    * judgeFailed(u, game, ctx) {
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
            targetCount: this.targetCount,
            initInfo: {
                card: this,
            }
        };
        return yield game.waitFSM(u, initCardFSM(game, ctx, opt), ctx);
    }

    * start(game, ctx) {
        yield this.run(game, ctx);
    }

    * run(game, ctx) {
        let u = ctx.i.sourceUser;
        let card = U.toSingle(ctx.i.card);
        yield game.equipUserCard(u, card);
        ctx.handlingCards.delete(card);
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


// 基本牌
class Sha extends NormalCard {
    constructor(suit, number, damageType = C.DAMAGE_TYPE.NORMAL) {
        super(suit, number);
        this.damageType = damageType;
        let damageTypeStr = '';
        switch (damageType) {
            case C.DAMAGE_TYPE.LEI:
                damageTypeStr = '(雷)';
                break;
            case C.DAMAGE_TYPE.HUO:
                damageTypeStr = '(火)';
                break;
        }
        this.name = `杀${damageTypeStr}`;
    }

    * init(game, ctx) {
        let u = ctx.i.sourceUser;
        ctx.i.shaCard = this;
        ctx.i.targetCount = 1;
        ctx.i.targetValidators = [];
        yield u.on('initSha', game, ctx);
        if (ctx.phaseCtx.i.shaCount >= u.getShaLimit()) {
            console.log(`|[i] Use too many Sha`);
            return yield Promise.resolve(R.fail);
        }
        let targetValidators = [(command, info) => {
            let target = info.game.userByPk(command.params);
            return target.id !== u.id && info.game.inAttackRange(u, target, ctx);
        }];

        if (ctx.i.targetValidators.length > 1) {
            targetValidators.push(...ctx.i.targetValidators);
        }

        let opt = {
            u,
            targetValidator: targetValidators,
            targetCount: ctx.i.targetCount,
            initInfo: {
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
        const u = ctx.i.sourceUser;
        ctx.i.ignoreArmor = false;
        ctx.i.shanAble = new Map();

        if (!ctx.i.skipShaInitStage) {
            yield this.targetEvents(game, ctx);
        }

        const card = ctx.i.card;
        const targets = ctx.i.targets;
        let damage = u.status.has(C.USER_STATUS.DRUNK) ? 2 : 1;  // 酒杀
        game.removeUserStatus(u, C.USER_STATUS.DRUNK);
        ctx.i.damage = new Damage(u, card, damage, card.damageType);

        yield game.removeUserCards(ctx.i.sourceUser, card);
        game.message([ctx.i.sourceUser, '对', ctx.i.targets, '使用', card]);
        yield u.on('startSha', game, ctx);

        for (let target of targets) {
            ctx.i.hit = true;  // 命中
            ctx.i.shaTarget = target;
            ctx.i.exDamage = 0;
            ctx.i.shaEffect = true;

            yield target.on('beSha', game, ctx);

            if (!ctx.i.shaEffect) {
                continue;
            }

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
            }

            if (ctx.i.hit) {
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
            targetCount: this.targetCount,
            initInfo: {
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


class Jiu extends NormalCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '酒';
        this.targetCount = C.TARGET_SELECT_TYPE.SELF;
    }

    * init(game, ctx) {
        let u = ctx.i.sourceUser;
        if (ctx.phaseCtx.i.jiuCount >= 1) {
            return yield Promise.resolve(R.fail);
        }
        let opt = {
            u,
            targetCount: this.targetCount,
            initInfo: {
                card: this,
            }
        };
        return yield game.waitFSM(u, initCardFSM(game, ctx, opt), ctx);
    }

    * run(game, ctx) {
        let u = ctx.i.sourceUser;
        game.message([u, '使用了', ctx.i.card]);
        game.addUserStatus(u, C.USER_STATUS.DRUNK);
        ctx.phaseCtx.i.jiuCount++;
    }
}

// 锦囊
class TaoYuanJieYi extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '桃园结义';
        this.targetCount = C.TARGET_SELECT_TYPE.ALL;
    }

    * run(game, ctx) {
        const t = ctx.i.currentTarget;
        ctx.i.heal = 1;
        yield t.on('heal', game, ctx);
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
        u.reply(`CARD_CANDIDATE ${'请选择一张牌'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
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
        yield game.removeUserCards(t, card, true);
    }
}


class ShunShouQianYang extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '顺手牵羊';
        this.targetValidators = [
            (command, info) => {
                let target = info.game.userByPk(command.params);
                return info.game.distanceOf(info.sourceUser, target, info.parentCtx) <= 1;
            },
        ];
    }

    * run(game, ctx) {
        let u = ctx.i.sourceUser;
        let t = ctx.i.currentTarget;

        // Show all card candidates
        let cardCandidates = t.cardCandidates();
        u.reply(`CARD_CANDIDATE ${'请选择一张牌'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
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
        game.message([u, '获得', t, '的一张牌', card]);
        yield game.removeUserCards(t, card);
        game.addUserCards(u, card);
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


class WanJianQiFa extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '万箭齐发';
        this.targetCount = C.TARGET_SELECT_TYPE.ALL_OTHERS;
    }

    * run(game, ctx) {
        const t = ctx.i.currentTarget;
        ctx.i.damage = new Damage(ctx.i.sourceUser, this, 1);
        let result = yield t.on('requireShan', game, ctx);
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


class WuXieKeJi extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '无懈可击';
        this.targetCount = C.TARGET_SELECT_TYPE.SINGLE;
    }

    * run(game, ctx) {
        ctx.parentCtx.i.silkCardEffect = false;
    }
}


class TieSuoLianHuan extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '铁索连环';
        this.targetCount = C.TARGET_SELECT_TYPE.ONE_OR_MORE;
        this.targetValidators = [
            FSM.BASIC_VALIDATORS.buildCountExceededValidator('targets', 2)
        ];
    }

    * run(game, ctx) {
        let t = ctx.i.currentTarget;
        game.toggleUserStatus(t, C.USER_STATUS.LINKED);
    }
}


class WuGuFengDeng extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '五谷丰登';
        this.targetCount = C.TARGET_SELECT_TYPE.ALL;
    }

    * prepare(game, ctx) {
        console.log(ctx.i.targets.length);

        let cards = game.cardManager.shiftCards(ctx.i.targets.length);
        ctx.i.cardCandidates = [];
        cards.map(card => {
            ctx.handlingCards.add(card);
            ctx.i.cardCandidates.push({card: card, show: true,});
        });

        game.broadcast(`CARD_CANDIDATE ${'请选择一张牌'} ${JSON.stringify(ctx.i.cardCandidates, U.jsonReplacer)}`, true, true);
    }

    * run(game, ctx) {
        const u = ctx.i.currentTarget;

        let command = yield game.wait(u, {
            validCmds: ['CARD_CANDIDATE'],
            validator: (command) => {
                const pks = command.params;
                return pks.length === 1;
            },
        });

        let card = game.cardByPk(command.params);
        ctx.handlingCards.delete(card);
        game.message([u, '获得', card]);
        game.addUserCards(u, card);

        ctx.i.cardCandidates = ctx.i.cardCandidates.filter(cc => cc.card !== card);
        ctx.i.targets.forEach(t => t.popRestoreCmd('CARD_CANDIDATE'));
        game.broadcast(`CARD_CANDIDATE ${'请选择一张牌'} ${JSON.stringify(ctx.i.cardCandidates, U.jsonReplacer)}`, true, true);
    }

    * finish(game, ctx) {
        ctx.i.targets.forEach(t => t.popRestoreCmd('CARD_CANDIDATE'));
        game.broadcast(`CLEAR_CANDIDATE`, true, false);
    }
}


class JieDaoShaRen extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '借刀杀人';
        this.targetCount = 2;
        this.targetValidators = [
            (command, info) => {
                let t = info.game.userByPk(command.params);
                if (info.targets.size < 1) {
                    return t.id !== info.sourceUser.id && t.equipments.weapon !== null;
                } else if (info.targets.size === 1) {
                    return info.game.inAttackRange(U.toSingle(info.targets), t, info.parentCtx);
                } else {
                    return false;
                }
            },
        ];
    }

    * start(game, ctx) {
        let targets = U.toArray(ctx.i.targets);
        ctx.i.targets = new Set(targets.slice(0, 1));
        ctx.i.secondaryTargets = new Set(targets.slice(1));
        yield super.start(game, ctx);
    }

    * run(game, ctx) {
        const u = ctx.i.sourceUser;
        let target = U.toSingle(ctx.i.targets);
        game.message([u, '借用', target, '的武器，让其对', ctx.i.secondaryTargets, '出【杀】']);
        let result = yield target.on('requireSha', game, ctx);
        if (result.success) {
            let card = result.get();
            let cardCtx = new CardContext(game, card, {
                sourceUser: target,
                targets: ctx.i.secondaryTargets,
            }).linkParent(ctx);

            yield game.removeUserCards(target, card);
            cardCtx.handlingCards.add(card);
            yield card.start(game, cardCtx);
        } else {
            let card = yield game.unequipUserCard(target, C.EQUIP_TYPE.WEAPON);
            game.message([u, '获得', target, '的武器', card]);
            game.addUserCards(u, card);
        }
    }
}


class HuoGong extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '火攻';
        this.targetCount = C.TARGET_SELECT_TYPE.SINGLE;
        this.targetValidators = [
            (command, info) => {
                let t = info.game.userByPk(command.params);
                return t.cards.size > (t.id === command.uid ? 1 : 0);
            },
        ];
    }

    * run(game, ctx) {
        const u = ctx.i.sourceUser;
        let t = U.toSingle(ctx.i.targets);

        t.reply('ALERT 请展示一张手牌...', true, true);
        let result = yield t.requireCard(game, ctx, CardBase);
        while (!result.success) {
            result = yield t.requireCard(game, ctx, CardBase);
        }
        t.reply('CLEAR_ALERT');
        t.reply('UNSELECT ALL');
        t.popRestoreCmd('ALERT');
        let cardA = result.get();
        game.message([t, '展示出一张手牌', cardA]);
        game.broadcastPopup(`CARD ${t.figure.name} 火攻-展示 ${cardA.toJsonString()}`);

        u.reply('ALERT 请弃置一张同花色的手牌...', true, true);
        result = yield u.requireCard(game, ctx, CardBase, [
            (command, info) => {
                let card = game.cardByPk(command.params);
                card = u.filterCard(card);
                return card.suit === cardA.suit;
            }
        ]);
        u.reply('CLEAR_ALERT');
        u.popRestoreCmd('ALERT');

        if (result.success) {
            let cardB = result.get();
            game.message([u, '弃置一张手牌', cardB, '使火攻造成伤害']);
            game.broadcastPopup(`CARD ${u.figure.name} 火攻-弃置 ${cardB.toJsonString()}`);
            yield game.removeUserCards(u, cardB, true);
            ctx.i.damage = new Damage(u, this, 1, C.DAMAGE_TYPE.HUO);
            yield t.on('damage', game, ctx);
        } else {
            game.message([u, '未能弃置一张同花色手牌，火攻没有造成伤害']);
        }
        game.broadcastClearPopup();
    }
}


// 延时类锦囊
class LeBuSiShu extends DelayedSilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '乐不思蜀';
        this.shortName = '乐';
    }

    judge(card) {
        return C.CARD_SUIT.HEART !== card.suit;
    }

    * judgeEffect(u, game, ctx) {
        u.phases.RoundPlayPhase = 0;
        yield super.judgeEffect(u, game, ctx);
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

    * judgeEffect(u, game, ctx) {
        u.phases.RoundDrawCardPhase = 0;
        yield super.judgeEffect(u, game, ctx);
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

    * judgeEffect(u, game, ctx) {
        ctx.i.damage = new Damage(null, this, 3, C.DAMAGE_TYPE.LEI);
        yield u.on('damage', game, ctx);
        yield super.judgeEffect(u, game, ctx);
    }

    * judgeFailed(u, game, ctx) {
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


// 武器
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
            cardCtx.i.isExtraSha = true;  // 青龙偃月刀算额外的杀
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


class HanBingJian extends WeaponCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '寒冰剑';
        this.shortName = '寒';
        this.range = 2;
    }

    * shaHitTarget(game, ctx) {
        const u = this.equiper(game);
        const t = ctx.i.shaTarget;
        let cardCandidates = t.cardCandidates({includeJudgeCards: false});

        const discardTargetCard = function* () {
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
            game.message([u, '弃置了', t, '的一张牌', card]);
            yield game.removeUserCards(t, card, true);
        };

        if (cardCandidates.length > 0) {
            let command = yield game.waitConfirm(u, `是否对${t.figure.name}使用武器【${this.name}】？`);
            if (command.cmd === C.CONFIRM.Y) {
                game.message([u, '对', t, '发动武器', this]);
                ctx.i.hit = false;
                u.reply(`CARD_CANDIDATE ${'请选择第一张牌'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
                yield discardTargetCard();

                cardCandidates = t.cardCandidates({includeJudgeCards: false});
                if (cardCandidates.length > 0) {
                    u.reply(`CARD_CANDIDATE ${'请选择第二张牌'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
                    yield discardTargetCard();
                }
            }
        } else {

        }
    }
}


class QiLinGong extends WeaponCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '麒麟弓';
        this.shortName = '麒';
        this.range = 5;
    }

    * shaHitTarget(game, ctx) {
        const u = this.equiper(game);
        const t = ctx.i.shaTarget;

        let cardCandidates = [];
        for (let equipType of [C.EQUIP_TYPE.ATTACK_HORSE, C.EQUIP_TYPE.DEFENSE_HORSE]) {
            if (t.equipments[equipType]) {
                cardCandidates.push({card: t.equipments[equipType].card, show: true,});
            }
        }
        if (cardCandidates.length > 0) {
            let command = yield game.waitConfirm(u, `是否对${t.figure.name}使用武器【${this.name}】？`);
            if (command.cmd === C.CONFIRM.Y) {
                u.reply(`CARD_CANDIDATE ${'请选择一匹马'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
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
                game.message([u, '弃置了', t, '的一匹马', card]);
                yield game.removeUserCards(t, card, true);
            }
        }
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
                            result = yield t.requireCard(game, ctx, CardBase);
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


class FangTianHuaJi extends WeaponCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '方天画戟';
        this.shortName = '方';
        this.range = 4;
    }

    effect(u, cards) {
        return (u.cards.size > 0 && U.toArray(u.cards.values()).filter(card => !U.toArray(cards).includes(card)).length <= 0);
    }

    * initSha(game, ctx) {
        let u = ctx.i.sourceUser;
        let cards = game.cardManager.unfakeCard(ctx.i.shaCard);
        if (this.effect(u, cards)) {
            ctx.i.targetCount = C.TARGET_SELECT_TYPE.ONE_OR_MORE;
            ctx.i.targetValidators = [
                FSM.BASIC_VALIDATORS.buildCountExceededValidator('targets', 3)
            ];
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
                u.reply(`CARD_CANDIDATE ${'请选择两张牌'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
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
                yield game.removeUserCards(u, cards, true);
                ctx.i.hit = true;
            }
        }
        return yield Promise.resolve(R.success);
    }
}


class QingGangJian extends WeaponCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '青釭剑';
        this.shortName = '釭';
        this.range = 2;
    }

    * startSha(game, ctx) {
        let u = this.equiper(game);
        game.message([u, '装备了【', this.name, '】，将无视目标防具']);
        ctx.i.ignoreArmor = true;
    }
}


class ZhuGeLianNu extends WeaponCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '诸葛连弩';
        this.shortName = '弩';
        this.range = 1;
    }
}


// 防具
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


class RenWangDun extends ArmorCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '仁王盾';
        this.shortName = '仁';
    }

    * beSha(game, ctx) {
        if ([C.CARD_SUIT.SPADE, C.CARD_SUIT.CLUB].includes(ctx.i.card.suit)) {
            let u = this.equiper(game);
            game.message([u, '装备了【', this.name, '】，', ctx.i.card, '无效']);
            ctx.i.shaEffect = false;
        }
    }
}


class TengJia extends ArmorCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '藤甲';
        this.shortName = '藤';
    }

    * beSha(game, ctx) {
        if (ctx.i.card.damageType === C.DAMAGE_TYPE.NORMAL) {
            let u = this.equiper(game);
            game.message([u, '装备了【', this.name, '】，', ctx.i.card, '无效']);
            ctx.i.shaEffect = false;
        }
    }

    * beforeScrollCardEffect(game, ctx) {
        let card = ctx.i.card;
        if (card instanceof NanManRuQin || card instanceof WanJianQiFa) {
            let u = this.equiper(game);
            game.message([u, '装备了【', this.name, '】，', card, '无效']);
            ctx.i.silkCardEffect = false;
        }
    }

    * damage(game, ctx) {
        let damage = ctx.i.damage;
        if (damage.type === C.DAMAGE_TYPE.HUO) {
            let u = this.equiper(game);
            game.message([u, '装备了【', this.name, '】，受到的火属性伤害+1']);
            ctx.i.exDamage = (ctx.i.exDamage || 0) + 1;
        }
    }
}


class BaiYinShiZi extends ArmorCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '白银狮子';
        this.shortName = '狮';
    }

    * damage(game, ctx) {
        let damage = ctx.i.damage;
        if (damage.value > 1) {
            let u = this.equiper(game);
            game.message([u, '装备了【', this.name, '】，受到伤害为1']);
            ctx.i.exDamage = 1 - (damage.value);
        }
    }

    * unequip(game, ctx) {
        let u = ctx.i.sourceUser;
        game.message([u, '失去了【', this.name, '】，应回复1点体力']);
        ctx.i.heal = 1;
        yield u.on('heal', game, ctx);
    }
}

// -1马
class DiLu extends AttackHorseCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '的卢-1';
    }
}


// +1马
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

    new Sha(C.CARD_SUIT.HEART, 4, C.DAMAGE_TYPE.HUO),
    new Sha(C.CARD_SUIT.HEART, 7, C.DAMAGE_TYPE.HUO),
    new Sha(C.CARD_SUIT.HEART, 10, C.DAMAGE_TYPE.HUO),
    new Sha(C.CARD_SUIT.DIAMOND, 4, C.DAMAGE_TYPE.HUO),
    new Sha(C.CARD_SUIT.DIAMOND, 5, C.DAMAGE_TYPE.HUO),

    new Sha(C.CARD_SUIT.SPADE, 4, C.DAMAGE_TYPE.LEI),
    new Sha(C.CARD_SUIT.SPADE, 5, C.DAMAGE_TYPE.LEI),
    new Sha(C.CARD_SUIT.SPADE, 6, C.DAMAGE_TYPE.LEI),
    new Sha(C.CARD_SUIT.SPADE, 7, C.DAMAGE_TYPE.LEI),
    new Sha(C.CARD_SUIT.SPADE, 8, C.DAMAGE_TYPE.LEI),
    new Sha(C.CARD_SUIT.CLUB, 5, C.DAMAGE_TYPE.LEI),
    new Sha(C.CARD_SUIT.CLUB, 6, C.DAMAGE_TYPE.LEI),
    new Sha(C.CARD_SUIT.CLUB, 7, C.DAMAGE_TYPE.LEI),
    new Sha(C.CARD_SUIT.CLUB, 8, C.DAMAGE_TYPE.LEI),

    new Shan(C.CARD_SUIT.DIAMOND, 2),
    new Shan(C.CARD_SUIT.DIAMOND, 4),
    new Shan(C.CARD_SUIT.DIAMOND, 8),
    new Shan(C.CARD_SUIT.DIAMOND, 11),

    new Tao(C.CARD_SUIT.HEART, 5),
    new Tao(C.CARD_SUIT.HEART, 7),
    new Tao(C.CARD_SUIT.DIAMOND, 2),

    new Jiu(C.CARD_SUIT.SPADE, 3),
    new Jiu(C.CARD_SUIT.SPADE, 9),

    // 非延时锦囊
    new TaoYuanJieYi(C.CARD_SUIT.HEART, 1),

    new JueDou(C.CARD_SUIT.SPADE, 1),
    new JueDou(C.CARD_SUIT.CLUB, 1),
    new JueDou(C.CARD_SUIT.DIAMOND, 1),

    new GuoHeChaiQiao(C.CARD_SUIT.SPADE, 3),
    new GuoHeChaiQiao(C.CARD_SUIT.SPADE, 4),
    new GuoHeChaiQiao(C.CARD_SUIT.SPADE, 12),
    new GuoHeChaiQiao(C.CARD_SUIT.CLUB, 3),
    new GuoHeChaiQiao(C.CARD_SUIT.CLUB, 4),
    new GuoHeChaiQiao(C.CARD_SUIT.HEART, 12),

    new ShunShouQianYang(C.CARD_SUIT.DIAMOND, 3),
    new ShunShouQianYang(C.CARD_SUIT.DIAMOND, 4),
    new ShunShouQianYang(C.CARD_SUIT.SPADE, 3),
    new ShunShouQianYang(C.CARD_SUIT.SPADE, 4),
    new ShunShouQianYang(C.CARD_SUIT.SPADE, 11),

    new WuZhongShengYou(C.CARD_SUIT.HEART, 7),
    new WuZhongShengYou(C.CARD_SUIT.HEART, 8),
    new WuZhongShengYou(C.CARD_SUIT.HEART, 9),
    new WuZhongShengYou(C.CARD_SUIT.HEART, 11),

    new NanManRuQin(C.CARD_SUIT.SPADE, 7),
    new NanManRuQin(C.CARD_SUIT.SPADE, 13),
    new NanManRuQin(C.CARD_SUIT.CLUB, 7),

    new WanJianQiFa(C.CARD_SUIT.HEART, 1),

    new WuXieKeJi(C.CARD_SUIT.SPADE, 11),
    new WuXieKeJi(C.CARD_SUIT.SPADE, 13),
    new WuXieKeJi(C.CARD_SUIT.CLUB, 12),
    new WuXieKeJi(C.CARD_SUIT.CLUB, 13),
    new WuXieKeJi(C.CARD_SUIT.HEART, 1),
    new WuXieKeJi(C.CARD_SUIT.HEART, 13),
    new WuXieKeJi(C.CARD_SUIT.DIAMOND, 12),

    new TieSuoLianHuan(C.CARD_SUIT.SPADE, 11),
    new TieSuoLianHuan(C.CARD_SUIT.SPADE, 12),
    new TieSuoLianHuan(C.CARD_SUIT.CLUB, 10),
    new TieSuoLianHuan(C.CARD_SUIT.CLUB, 11),
    new TieSuoLianHuan(C.CARD_SUIT.CLUB, 12),
    new TieSuoLianHuan(C.CARD_SUIT.CLUB, 13),

    new WuGuFengDeng(C.CARD_SUIT.HEART, 3),
    new WuGuFengDeng(C.CARD_SUIT.HEART, 4),

    new JieDaoShaRen(C.CARD_SUIT.CLUB, 12),
    new JieDaoShaRen(C.CARD_SUIT.CLUB, 13),

    new HuoGong(C.CARD_SUIT.HEART, 2),
    new HuoGong(C.CARD_SUIT.HEART, 3),
    new HuoGong(C.CARD_SUIT.DIAMOND, 12),

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
    new FangTianHuaJi(C.CARD_SUIT.DIAMOND, 12),
    new GuanShiFu(C.CARD_SUIT.DIAMOND, 5),
    new HanBingJian(C.CARD_SUIT.SPADE, 2),
    new QiLinGong(C.CARD_SUIT.HEART, 5),
    new QingGangJian(C.CARD_SUIT.SPADE, 6),
    // new ZhangBaSheMao(C.CARD_SUIT.SPADE, 12),
    // new ZhuQueYuShan(C.CARD_SUIT.DIAMOND, 1),
    new ZhuGeLianNu(C.CARD_SUIT.DIAMOND, 1),
    new ZhuGeLianNu(C.CARD_SUIT.CLUB, 1),

    // 防具
    new BaGuaZhen(C.CARD_SUIT.SPADE, 2),
    new BaGuaZhen(C.CARD_SUIT.CLUB, 2),
    new RenWangDun(C.CARD_SUIT.CLUB, 2),
    new TengJia(C.CARD_SUIT.CLUB, 2),
    new BaiYinShiZi(C.CARD_SUIT.CLUB, 2),

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
    Jiu,

    TaoYuanJieYi,
    JueDou,
    GuoHeChaiQiao,
    ShunShouQianYang,
    NanManRuQin,
    WanJianQiFa,
    WuZhongShengYou,
    WuXieKeJi,
    TieSuoLianHuan,
    WuGuFengDeng,
    JieDaoShaRen,
    HuoGong,

    LeBuSiShu,
    BingLiangCunDuan,
    ShanDian,

    QingLongYanYueDao,
    GuDingDao,
    CiXiongShuangGuJian,
    FangTianHuaJi,
    GuanShiFu,
    HanBingJian,
    QiLinGong,
    QingGangJian,
    ZhuGeLianNu,

    BaGuaZhen,
    RenWangDun,
    TengJia,
    BaiYinShiZi,

    DiLu,
    ChiTu,
};
