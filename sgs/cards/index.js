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
        return Array.from(pks, (pk) => cards.cardSet.get(pk));
    }

    useCards(pks) {
        this.used.push(...this.getCards(pks));
    }

    fakeCards(cards, fakeInfo = {}) {
        console.assert(cards.length === 1 || fakeInfo.asClass !== undefined, 'Fake cards failed!');
        let {
            asClass = cards[0].constructor,
            asSuit = cards[0].suit,
            asNumber = cards[0].number
        } = fakeInfo;

        let faked = new asClass(asSuit, asNumber);
        faked.faked = true;
        faked.originCards = new Set(cards);
        return faked;
    }

    unfakeCard(card) {
        return Array.from(card.getOriginCards());
    }

    unfakeCards(cards) {
        return cards.reduce((r, c) => r.concat(this.unfakeCard(c)), []);
    }
}


module.exports = new CardManager();