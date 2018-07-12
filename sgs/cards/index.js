const U = require('../utils');
const cards = require('./cards');
const cardSet = cards.cardSet;

class CardManager {
    constructor() {
        this.used = cardSet.values();
        this.unused = [];
        this.fakedCards = new Map();
    }

    shuffle() {
        this.unused.push(...U.shuffle(this.used));
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
        this.unused.unshift(...U.toArray(cards));
    }

    getCard(pk) {
        pk = Array.isArray(pk) ? pk[0] : pk;
        return cards.cardSet.has(pk) ? cards.cardSet.get(pk) : this.fakedCards.get(pk);
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
        this.fakedCards.set(faked.pk, faked);
        return faked;
    }

    destroyFakeCards(cards) {
        U.toArray(cards).map(c => this.fakedCards.delete(c.pk));
    }

    unfakeCard(card) {
        let rtn = U.toArray(card.getOriginCards());
        return rtn;
    }

    unfakeCards(cards) {
        return cards.reduce((r, c) => {
            return r.concat(this.unfakeCard(c));
        }, []);
    }
}


module.exports = new CardManager();