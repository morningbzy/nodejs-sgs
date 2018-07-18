const aggregation = require('aggregation/es6');
const uuid = require('uuid/v4');
const C = require('../constants');
const R = require('../common/results');
const U = require('../utils');
const Context = require('../context');
const FSM = require('../common/stateMachines');
const EventListener = require('../common/eventListener');
const ShaStage = require('../phases/sha/ShaStage');


class CardBase {
    constructor(suit, number) {
        this.pk = uuid();
        this.suit = suit;
        this.number = number;

        this.faked = false;
        this.originCards = null;

        this.requireOk = false;
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

    * start(game, ctx) {
        let u = ctx.sourceUser;
        if (!(this.run instanceof Function) ||
            this.requireOk && !(yield game.waitFSM(u, FSM.get('requireOk', game), ctx)).success) {
            return yield Promise.resolve(R.fail);
        }

        return yield this.run(game, ctx);
    }
}


class NormalCard extends CardBase {
    constructor(suit, number) {
        super(suit, number);
        this.category = C.CARD_CATEGORY.NORMAL;
    }
}


class SilkBagCard extends CardBase {
    constructor(suit, number) {
        super(suit, number);
        this.category = C.CARD_CATEGORY.SILK_BAG;
        this.distance = Infinity;
    }
}


class DelayedSilkBagCard extends CardBase {
    constructor(suit, number) {
        super(suit, number);
        this.category = C.CARD_CATEGORY.DELAYED_SILK_BAG;
        this.distance = Infinity;
        this.needTarget = true;
    }

    * run(game, ctx) {
        let u = ctx.sourceUser;
        let distance = this.distance;
        let card = this;
        game.lockUserCards(u, ctx.sourceCards);
        let result;
        if (this.needTarget) {
            result = yield game.waitFSM(u, FSM.get('requireSingleTarget', game, {
                cancelOnUncard: true,
                targetValidator: (command) => {
                    let target = game.userByPk(command.params);
                    return (target.id !== u.id
                        && game.distanceOf(u, target) <= distance
                        && !target.hasJudgeType(card));
                }
            }), ctx);
        } else if (!u.hasJudgeType(card) && (yield game.waitOk(u))) {
            result = new R.TargetResult().set(u);
        } else {
            result = R.abort;
        }
        game.unlockUserCards(u, ctx.sourceCards);

        if (result.success) {
            yield game.removeUserCards(u, ctx.sourceCards);

            let target = result.get();
            ctx.targets = U.toSet(target);
            game.message([ctx.sourceUser, '对', ctx.targets, '使用了', ctx.sourceCards]);
            ctx.targets.forEach((t) => game.pushUserJudge(t, ctx.sourceCards[0]));

            return yield Promise.resolve(R.success);
        } else {
            return yield Promise.resolve(R.abort);
        }
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

        this.requireOk = true;
        this.equiperPk = null;
    }

    setEquiper(user) {
        this.equiperPk = user === null ? null : user.id;
    }

    equiper(game) {
        return game.userByPk(this.equiperPk);
    }

    * run(game, ctx) {
        yield game.equipUserCard(game.roundOwner, this);
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
    }

    * run(game, ctx) {
        return yield ShaStage.start(game, ctx);
    }
}


class Shan extends NormalCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '闪';
    }
}


class Tao extends NormalCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '桃';
        this.requireOk = true;
    }

    * run(game, ctx) {
        return yield game.roundOwner.on('useTao', game, ctx);
    }
}


class JueDou extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '决斗';
    }

    * run(game, ctx) {
        let u = ctx.sourceUser;
        game.lockUserCards(u, ctx.sourceCards);
        let result = yield game.waitFSM(u, FSM.get('requireSingleTarget', game, {
            cancelOnUncard: true,
            targetValidator: (command) => {
                let target = game.userByPk(command.params);
                return target.id !== u.id;
            }
        }), ctx);
        game.unlockUserCards(u, ctx.sourceCards);
        if (!result.success) {
            return yield Promise.resolve(result);
        }

        yield game.removeUserCards(u, ctx.sourceCards);
        ctx.targets = U.toArray(result.get());
        game.message([ctx.sourceUser, '对', ctx.targets, '使用了', ctx.sourceCards]);

        let users = ctx.targets.concat(u);
        let done = false;
        let loser;
        while (!done) {
            for (let _u of users) {
                let result = yield _u.on('requireSha', game, ctx);
                if (result.success) {
                    game.discardCards(ctx.sourceCards);
                    ctx.handlingCards.delete(ctx.sourceCards);

                    ctx.sourceUser = _u;
                    ctx.sourceCards = result.get();
                    yield game.removeUserCards(_u, ctx.sourceCards);
                    ctx.handlingCards.add(ctx.sourceCards);
                    game.message([_u, '打出了', ctx.sourceCards]);
                } else {
                    done = true;
                    loser = _u;
                    break;
                }
            }
        }

        ctx.damage = 1;
        result = yield loser.on('damage', game, ctx);
        return yield Promise.resolve(result);
    }
}


class GuoHeChaiQiao extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '过河拆桥';
    }

    * run(game, ctx) {
        let u = ctx.sourceUser;

        game.lockUserCards(u, ctx.sourceCards);
        let result = yield game.waitFSM(u, FSM.get('requireSingleTarget', game, {
            cancelOnUncard: true,
        }), ctx);
        game.unlockUserCards(u, ctx.sourceCards);
        if (!result.success) {
            return yield Promise.resolve(result);
        }

        yield game.removeUserCards(u, ctx.sourceCards, true);
        let target = result.get();
        ctx.targets = target;
        game.message([ctx.sourceUser, '对', target, '使用了', ctx.sourceCards]);

        // TODO: WuXieKeJi

        // Show all card candidates
        let cardCandidates = target.cardCandidates();
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
        game.message([u, '拆掉了', target, '的一张牌']);
        yield game.removeUserCardsEx(target, card, true);

        return yield Promise.resolve(R.success);
    }
}


class NanManRuQin extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '南蛮入侵';
        this.requireOk = true;
    }

    * run(game, ctx) {
        const u = ctx.sourceUser;
        game.message([u, '使用了', this]);
        yield game.removeUserCards(u, ctx.sourceCards);

        ctx.damage = 1;
        for (let _u of game.userRound(game.roundOwner, true)) {
            let result = yield _u.on('requireSha', game, ctx);
            if (result.success) {
                let card = result.get();
                game.message([_u, '打出了', card]);
                yield game.removeUserCards(_u, card, true);
            } else {
                yield _u.on('damage', game, ctx);
            }
        }
    }
}


class WuZhongShengYou extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '无中生有';

        this.requireOk = true;
    }

    * run(game, ctx) {
        const u = ctx.sourceUser;
        yield game.removeUserCards(u, ctx.sourceCards, true);
        game.message([u, '使用', this, '获得两张牌']);
        game.dispatchCards(u, 2);
        return yield Promise.resolve(R.success);
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
        this.needTarget = false;
    }

    judge(card) {
        return (C.CARD_SUIT.SPADE === card.suit && 2 <= card.number && card.number <= 9);
    }

    * judgeEffect(u, game) {
        let ctx = new Context({damage: 3, sourceCards: this});
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
            let context = new Context({
                sourceUser: u,
                sourceCards: card,
                targets: U.toSet(ctx.shaTarget),
                skipShaInitStage: true,
                damage: 1,
                phaseContext: ctx.phaseContext,
            });
            context.handlingCards.add(card);
            game.message([u, '发动了', this, '使用了', context.sourceCards, '追杀', context.targets]);
            context.phaseContext.shaCount ++;  // 青龙偃月刀算额外的杀
            result = yield ShaStage.start(game, context);
            yield game.discardCards(context.handlingCards);
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
        const target = ctx.shaTarget;
        if (target.cards.size <= 0) {
            game.message([u, '的装备', this, '生效，此【杀】伤害+1']);
            ctx.exDamage += 1;
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
        const u = ctx.sourceUser;
        for (let t of ctx.targets) {
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

        if(cardCandidates.length >= 2) {
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
                ctx.hit = true;
            }
        }
        return yield Promise.resolve(R.success);
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
        return yield Promise.resolve(R.success);
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

    new LeBuSiShu(C.CARD_SUIT.SPADE, 6),
    new LeBuSiShu(C.CARD_SUIT.HEART, 6),
    new LeBuSiShu(C.CARD_SUIT.CLUB, 6),

    new BingLiangCunDuan(C.CARD_SUIT.SPADE, 10),
    new BingLiangCunDuan(C.CARD_SUIT.CLUB, 4),

    new ShanDian(C.CARD_SUIT.SPADE, 1),
    new ShanDian(C.CARD_SUIT.HEART, 12),

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
    // new ZhuGeLianNu(C.CARD_SUIT.DIAMOND, 1),
    // new ZhuGeLianNu(C.CARD_SUIT.CLUB, 1),

    new BaGuaZhen(C.CARD_SUIT.SPADE, 2),
    new BaGuaZhen(C.CARD_SUIT.CLUB, 2),

    new DiLu(C.CARD_SUIT.CLUB, 5),

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
