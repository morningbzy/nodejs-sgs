const uuid = require('uuid/v4');
const C = require('../constants');
const R = require('../common/results');


class CardBase {
    constructor(suit, number) {
        this.suit = suit;
        this.number = number;
        this.pk = uuid();
    }

    toJson() {
        return {
            pk: this.pk,
            name: this.name,
            shortName: this.shortName || this.name.substr(0, 1),
            category: this.category,
            suit: this.suit,
            number: this.number,
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

    static* start(game, ctx) {
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
        ctx.targets = game.usersByPk(targetPks)[0];

        game.pushUserJudge(ctx.targets, ctx.sourceCards[0]);

        return yield Promise.resolve(R.success);
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

    static* start(game, ctx) {
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
        let users = ctx.targets.concat(u);
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

    static* start(game, ctx) {
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

    static judge(card) {
        let result = R.judge(C.CARD_SUIT.HEART !== card.suit);
        console.log(result);
        console.log(result.success);
        console.log(result.fail);
        console.log(result.abort);
        return result;
    }

    static judgeEffect(u) {
        u.phases.RoundPlayPhase = 0;
    }
}


cardClasses = {
    CardBase,
    NormalCard,
    SilkBagCard,
    DelayedSilkBagCard,

    Sha,
    Shan,
    Tao,

    JueDou,
    WuZhongShengYou,

    LeBuSiShu,
};


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
].map((c) => cardSet.set(c.pk, c));

module.exports = Object.assign(cardClasses, {cardSet});
