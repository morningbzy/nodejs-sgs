const utils = require('../utils');
const cards = require('./cards');

class CardManager {
    constructor() {
        this.cards = cards.cardSet;
        this.used = Object.keys(this.cards).map((k) => this.cards[k]);
        this.unused = [];
        this.onhand = [];
    }

    shuffle() {
        this.used = utils.shuffle(this.used);
        this.unused.push(...this.used);
        this.used = [];
    }

    shiftCards(count = 1) {
        let cards;
        if (count > this.unused.length) {
            this.shuffle();
        }

        cards = this.unused.splice(0, count);
        this.onhand.push(...cards);
        return cards;
    }

    unshiftCards(cards) {
        this.unused.unshift(...(Array.isArray(cards) ? cards : [cards]));
    }
}


module.exports = new CardManager();