const uuid = require('uuid/v4');
const C = require('../constants');


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


cardClasses = {
    Sha,
    Shan,
    Tao,
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
].map((c) => cardSet.set(c.pk, c));

module.exports = Object.assign(cardClasses, {cardSet});
