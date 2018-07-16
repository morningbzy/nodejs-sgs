const U = require('../utils');
const cards = require('./cards');
const cardSet = cards.cardSet;

class CardManager {
    constructor() {
        this.used = Array.from(cardSet.values());  // 弃牌堆
        this.unused = [];  // 摸牌堆
        this.faked = new Map();  // 假牌
    }

    _status() {
        console.log(`|[i] `
            + `Unused: ${this.unused.length}, `
            + `Used: ${this.used.length}, `
            + `Faked: ${this.faked.size}, `
        );
    }

    shuffle() {
        // 将弃牌对归入摸牌堆，并洗牌
        this.unused.push(...U.shuffle(this.used));
        this.used = [];
        this._status();
    }

    shiftCards(count = 1) {
        // 从摸牌堆顶获得count张牌
        let cards;
        if (count > this.unused.length) {
            this.shuffle();
        }

        cards = this.unused.splice(0, count);
        this._status();
        return cards;
    }

    unshiftCards(cards) {
        // 将牌放回摸牌堆顶
        this.unused.unshift(...U.toArray(cards));
        this._status();
    }

    getCard(pk) {
        pk = U.toSingle(pk);
        return cardSet.has(pk) ? cardSet.get(pk) : this.faked.get(pk);
    }

    getCards(pks) {
        return Array.from(pks, (pk) => this.getCard(pk));
    }

    useCards(pks) {
        this.used.push(...this.getCards(pks));
        this._status();
    }

    fakeCards(cards, fakeInfo = {}) {
        console.assert(cards.length === 1 || fakeInfo.asClass !== undefined, 'Fake cards failed!');
        let {
            asClass = cards[0].constructor,
            asSuit = cards.length === 1 ? cards[0].suit : C.CARD_SUIT.NONE,
            asNumber = cards.length === 1 ? cards[0].number : 0,
        } = fakeInfo;

        let fakeCard = new asClass(asSuit, asNumber);
        fakeCard.faked = true;
        fakeCard.originCards = new Set(cards);
        this.faked.set(fakeCard.pk, fakeCard);
        this._status();
        return fakeCard;
    }

    destroyFakeCards(cards) {
        U.toArray(cards).map(c => this.faked.delete(c.pk));
        this._status();
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