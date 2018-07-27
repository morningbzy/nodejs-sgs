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
            strings.push(`【<b>${e.name}</b>`);
            if(e.faked) {
                strings.push('<span class="text-muted">（');
                strings.push(Array.from(e.getOriginCards(), c => c.name).join('+'));
                strings.push('）</span>');
            }
            strings.push(`<span class="sgs-card-text sgs-card-suit-${e.suit} ${suitClass}">${e.number}</span>】`);
        } else {
            strings.push(e.toString());
        }
    }

    return strings.join('');
}

module.exports = {buildMessage};
