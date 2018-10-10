const C = require('../constants');
const U = require('../utils');
const cards = require('./cards');
const cardSet = cards.cardSet;

class CardManager {
    constructor() {
        this.used = new Set(cardSet.values());  // 弃牌堆
        this.unused = [];  // 摸牌堆
        this.faked = new Map();  // 假牌
    }

    _status() {
        console.log(`|[i] `
            + `Unused: ${this.unused.length}, `
            + `Used: ${this.used.size}, `
            + `Faked: ${this.faked.size}, `
        );
    }

    shuffle() {
        // 将弃牌对归入摸牌堆，并洗牌
        this.unused.push(...U.shuffle(this.used));
        this.used.clear();
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

    pushCards(cards) {
        // 将牌放到摸牌堆底
        this.unused.push(...U.toArray(cards));
        this._status();

    }

    getCard(pk) {
        pk = U.toSingle(pk);
        return cardSet.has(pk) ? cardSet.get(pk) : this.faked.get(pk);
    }

    getCards(pks) {
        return Array.from(U.toArray(pks), (pk) => this.getCard(pk));
    }

    discardCards(cards) {
        for (let card of this.unfakeCards(cards)) {
            console.log(`|[i] Discard ${card}`);
            this.used.add(card);
        }
        this.destroyFakeCards(cards);
        this._status();
    }

    fakeCards(cards, fakeInfo = {}) {
        cards = U.toArray(cards);
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
        console.log(`|[i] Fake card ${fakeCard}`);
        this._status();
        return fakeCard;
    }

    destroyFakeCards(cards) {
        U.toArray(cards).filter(c => c.faked).map(c => {
            console.log(`|[i] Destory faked card ${c}`);
            this.faked.delete(c.pk);
        });
        this._status();
    }

    unfakeCard(card) {
        return U.toArray(card.getOriginCards());
    }

    unfakeCards(cards) {
        return U.toArray(cards).reduce((r, c) => {
            return r.concat(this.unfakeCard(c));
        }, []);
    }

    createGhostCard(asClass) {
        console.log(`|[i] Ghost card [${asClass.name}]`);
        const card = new asClass(C.CARD_SUIT.NONE, 0);
        return card;
    }

    asCandidates(cards) {
        let candidates = [];
        cards.forEach(card => {
            candidates.push({
                card: card,
                show: true,
            });
        });
        return candidates;
    }
}


module.exports = new CardManager();