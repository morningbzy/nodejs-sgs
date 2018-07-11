const aggregation = require('aggregation/es6');
const uuid = require('uuid/v4');
const C = require('../constants');
const R = require('../common/results');
const U = require('../utils');
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
    }
}


class DelayedSilkBagCard extends CardBase {
    constructor(suit, number) {
        super(suit, number);
        this.category = C.CARD_CATEGORY.DELAYED_SILK_BAG;
    }

    * run(game, ctx) {
        let u = ctx.sourceUser;
        game.lockUserCards(u, ctx.sourceCards);
        let result = yield game.waitFSM(u, FSM.get('requireSingleTarget', game, {
            cancelOnUncard: true,
            targetValidator: (command) => {
                // TODO: validate distance & target-able
                // let targets = game.usersByPk(command.params);
                return true;
            }
        }), ctx);
        game.unlockUserCards(u, ctx.sourceCards);

        if (result.success) {
            game.removeUserCards(u, ctx.sourceCards);

            let target = result.get();
            ctx.targets = U.toSet(target);
            game.message([ctx.sourceUser, '对', ctx.targets, '使用了', ctx.sourceCards]);
            ctx.targets.forEach((t) => game.pushUserJudge(t, ctx.sourceCards[0]));

            return yield Promise.resolve(R.success);
        } else {
            return yield Promise.resolve(R.abort);
        }
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
        game.equipUserCard(game.roundOwner, this);
        return yield Promise.resolve(R.success);
    }

    * on(event, game, ctx) {
        console.log(`|<E> ON ${this.name} ${event}`);
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
        return yield ShaStage.start(game, game.roundOwner, ctx);
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
        }), ctx);
        game.unlockUserCards(u, ctx.sourceCards);
        if (!result.success) {
            return yield Promise.resolve(result);
        }

        game.removeUserCards(u, ctx.sourceCards);
        ctx.targets = [result.get()];
        game.message([ctx.sourceUser, '对', ctx.targets, '使用了', ctx.sourceCards]);

        let users = Array.from(ctx.targets).concat(u);
        let done = false;
        let loser;
        while (!done) {
            for (let _u of users) {
                let result = yield _u.on('requireSha', game, ctx);
                if (result.success) {
                    game.discardCards(ctx.sourceCards);
                    ctx.sourceUser = _u;
                    ctx.sourceCards = result.get();
                    game.message([_u, '打出了', ctx.sourceCards]);
                    game.removeUserCards(_u, ctx.sourceCards);
                } else {
                    done = true;
                    loser = _u;
                    break;
                }
            }
        }

        ctx.damage = 1;
        result = yield loser.on('damage', game, ctx);
        game.discardCards(ctx.sourceCards);
        return yield Promise.resolve(result);
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
        ctx.damage = 1;

        for (let _u of game.userRound(game.roundOwner, true)) {
            let result = yield _u.on('requireSha', game, ctx);
            if (result.success) {
                let card = result.get();
                game.message([_u, '打出了', card]);
                game.removeUserCards(_u, card);
                game.discardCards(card);
            } else {
                yield _u.on('damage', game, ctx);
            }
        }

        game.removeUserCards(u, ctx.sourceCards);
        game.discardCards(ctx.sourceCards);
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
        game.removeUserCards(u, ctx.sourceCards);
        game.dispatchCards(u, 2);
        game.discardCards(ctx.sourceCards);
    }
}


class LeBuSiShu extends DelayedSilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '乐不思蜀';
        this.shortName = '乐';
    }

    judge(card) {
        return R.judge(C.CARD_SUIT.HEART !== card.suit);
    }

    judgeEffect(u) {
        u.phases.RoundPlayPhase = 0;
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
            let context = {
                sourceUser: u,
                sourceCards: result.get(),
                targets: new Set([ctx.shanPlayer]),
                skipShaInitStage: true,
                damage: 1,
            };
            game.message([u, '发动了', this, '使用了', context.sourceCards, '追杀', context.targets]);
            return yield ShaStage.start(game, u, context);
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


class BaGuaZhen extends ArmorCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '八卦阵';
        this.shortName = '卦';
    }

    judge(card) {
        return R.judge([C.CARD_SUIT.HEART, C.CARD_SUIT.DIAMOND].includes(card.suit));
    }

    * s1(game, ctx) {
        let u = this.equiper(game);

        // ---------------------------------
        // TODO: Before judge, ask WuXieKeJi
        // for(let _u of game.userRound()) {
        //     judgeCard = _u.on('beforeJudge');
        // }
        let judgeCard = game.getJudgeCard();
        let context = {judgeCard};
        game.message([u, '发动了【', this.name, '】，判定为', context.judgeCard]);
        game.discardCards([judgeCard]);

        // TODO: Before judge effective, ask SiMaYi & ZhangJiao
        for (let _u of game.userRound()) {
            yield _u.on('beforeJudgeEffect', game, context);
        }

        yield u.on('judge', game, context);  // 目前仅用于小乔的【红颜】
        let result = this.judge(context.judgeCard);
        game.message([u, '判定【', this.name, '】为', context.judgeCard, '判定', result.success ? '生效' : '未生效']);

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
        this.name = '的卢';
    }
}

class ChiTu extends DefenseHorseCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '赤兔';
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

    new WuZhongShengYou(C.CARD_SUIT.HEART, 7),
    new WuZhongShengYou(C.CARD_SUIT.HEART, 8),
    new WuZhongShengYou(C.CARD_SUIT.HEART, 9),
    new WuZhongShengYou(C.CARD_SUIT.HEART, 11),

    new NanManRuQin(C.CARD_SUIT.SPADE, 7),
    new NanManRuQin(C.CARD_SUIT.CLUB, 7),

    new LeBuSiShu(C.CARD_SUIT.SPADE, 6),
    new LeBuSiShu(C.CARD_SUIT.HEART, 6),
    new LeBuSiShu(C.CARD_SUIT.CLUB, 6),

    new QingLongYanYueDao(C.CARD_SUIT.SPADE, 5),

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
    WuZhongShengYou,

    LeBuSiShu,

    QingLongYanYueDao,

    ChiTu
};
