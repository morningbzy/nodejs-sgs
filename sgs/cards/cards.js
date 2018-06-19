const aggregation = require('aggregation/es6');
const uuid = require('uuid/v4');
const C = require('../constants');
const R = require('../common/results');
const EventListener = require('../common/eventListener');
const ShaStage = require('../phases/sha/ShaStage');


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

    * start(game, ctx) {
        let u = ctx.sourceUser;
        game.lockUserCards(u, ctx.sourceCards);
        let command = yield game.wait(u, {
            validCmds: ['CANCEL', 'TARGET'],
            validator: (command) => {
                if (command.cmd === 'CANCEL') {
                    return true;
                }
                if (command.params.length !== 1) {
                    return false;
                }
                // TODO: validate distance & target-able
                return true;
            },
        });
        game.unlockUserCards(u, ctx.sourceCards);

        if (command.cmd === 'CANCEL') {
            return yield Promise.resolve(R.abort);
        }

        game.removeUserCards(u, ctx.sourceCards);

        let targetPks = command.params;
        ctx.targets = game.usersByPk(targetPks);
        ctx.targets.forEach((t) => game.pushUserJudge(t, ctx.sourceCards[0]));

        return yield Promise.resolve(R.success);
    }
}


class EquipmentCard extends aggregation(CardBase, EventListener) {
    constructor(suit, number) {
        super(suit, number);
        this.category = C.CARD_CATEGORY.EQUIPMENT;
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
    }
}


class Sha extends NormalCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '杀';
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
    }
}


class JueDou extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '决斗';
    }

    * start(game, ctx) {
        let u = ctx.sourceUser;
        game.lockUserCards(u, ctx.sourceCards);
        let command = yield game.wait(u, {
            validCmds: ['CANCEL', 'TARGET'],
            validator: (command) => {
                if (command.cmd === 'CANCEL') {
                    return true;
                }
                if (command.params.length !== 1) {
                    return false;
                }
                // TODO: validate distance & target-able
                return true;
            },
        });
        game.unlockUserCards(u, ctx.sourceCards);

        if (command.cmd === 'CANCEL') {
            return yield Promise.resolve(R.abort);
        }

        game.removeUserCards(u, ctx.sourceCards);

        let targetPks = command.params;
        ctx.targets = game.usersByPk(targetPks);
        let users = Array.from(ctx.targets).concat(u);
        let done = false;
        let loser;
        while (!done) {
            for (let _u of users) {
                let result = yield _u.on('requireSha', game, ctx);
                if (result.success) {
                    game.discardCards(ctx.sourceCards);
                    ctx.sourceUser = _u;
                    ctx.sourceCards = result.get().cards;
                    game.removeUserCards(_u, ctx.sourceCards);
                } else {
                    done = true;
                    loser = _u;
                    break;
                }
            }
        }

        ctx.damage = 1;
        let result = yield loser.on('damage', game, ctx);
        game.discardCards(ctx.sourceCards);
        return yield Promise.resolve(result);
    }
}


class WuZhongShengYou extends SilkBagCard {
    constructor(suit, number) {
        super(suit, number);
        this.name = '无中生有';
    }

    * start(game, ctx) {
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
        let result = R.judge(C.CARD_SUIT.HEART !== card.suit);
        console.log(result);
        console.log(result.success);
        console.log(result.fail);
        console.log(result.abort);
        return result;
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
    }

    * start(game, ctx) {
        let u = ctx.sourceUser;
        let result = yield u.on('requireSha', game, ctx);
        if(result.success) {
            let context = {
                sourceUser: u,
                sourceCards: result.get().cards,
                targets: new Set([ctx.shanPlayer]),
                skipShaInitStage: true,
                damage: 1,
            };
            return yield ShaStage.start(game, u, context);
        }
    }

    * shaBeenShan(game, ctx) {
        let u = ctx.sourceUser;
        let command = yield game.waitConfirm(u, `是否使用武器【青龙偃月刀】？`);
        if (command.cmd === C.CONFIRM.Y) {
            yield this.start(game, ctx);
        }
        return yield Promise.resolve(R.success);
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

    new LeBuSiShu(C.CARD_SUIT.SPADE, 6),
    new LeBuSiShu(C.CARD_SUIT.HEART, 6),
    new LeBuSiShu(C.CARD_SUIT.CLUB, 6),

    new QingLongYanYueDao(C.CARD_SUIT.SPADE, 5),
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
};
