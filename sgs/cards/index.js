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

    getCard(pk) {
        pk = Array.isArray(pk) ? pk[0] : pk;
        return cards.cardSet.get(pk);
    }

    getCards(pks) {
        return Array.from(pks, (pk) => this.getCard(pk));
    }

    useCards(pks) {
        this.used.push(...this.getCards(pks));
    }

    fakeCards(cards, fakeInfo = {}) {
        console.assert(cards.length === 1 || fakeInfo.asClass !== undefined, 'Fake cards failed!');
        let {
            asClass = cards[0].constructor,
            asSuit = cards.length === 1 ? cards[0].suit : C.CARD_SUIT.NONE,
            asNumber = cards.length === 1 ? cards[0].number : 0,
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