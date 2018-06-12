const utils = require('../utils');
const cards = require('./cards');
const cardSet = cards.cardSet;

class CardManager {
    constructor() {
        this.used = cardSet.values();
        this.unused = [];
    }

    shuffle() {
        this.unused.push(...utils.shuffle(this.used));
        this.used = [];
    }

    shiftCards(count = 1) {
        let cards;
        if (count > this.unused.length) {
            this.shuffle();
        }

        cards = this.unused.splice(0, count);
        return cards;
    }

    unshiftCards(cards) {
        this.unused.unshift(...(Array.isArray(cards) ? cards : [cards]));
    }

    getCards(pks) {
        return pks.map((pk) => cards.cardSet.get(pk));
    }

    useCards(pks){
        this.used.push(...this.getCards(pks));
    }
}


module.exports = new CardManager();