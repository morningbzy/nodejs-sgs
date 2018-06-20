const C = require('../constants');
const User = require('../user');
const sgsCards = require('../cards/cards');


function buildMessage(elements) {
    let strings = [];
    for (let e of elements) {
        if(e === undefined) continue;

        if (Array.isArray(e)) {
            strings.push(buildMessage(e));
        } else if (e instanceof Set || e instanceof Map) {
            strings.push(buildMessage(Array.from(e.values())));
        } else if (e instanceof User) {
            strings.push(`<b>${e.figure.name}</b>`);
        } else if (e instanceof sgsCards.CardBase) {
            let suitClass = [C.CARD_SUIT.HEART, C.CARD_SUIT.DIAMOND].includes(e.suit) ? 'text-danger' : 'text-dark';
            strings.push(`【${e.name}<span class="sgs-card-text sgs-card-suit-${e.suit} ${suitClass}">${e.number}</span>】`);

            if(e.faked) {
                strings.push('(');
                strings.push(buildMessage(e.getOriginCards()));
                strings.push(')');
            }
        } else {
            strings.push(e.toString());
        }
    }

    return strings.join('');
}

module.exports = {buildMessage};
