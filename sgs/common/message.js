const C = require('../constants');
const User = require('../user');
const sgsCards = require('../cards/cards');
const Skill = require('../skills');


function buildMessage(elements) {
    let strings = [];
    for (let e of elements) {
        if (e === undefined) continue;

        if (Array.isArray(e)) {
            strings.push(buildMessage(e));
        } else if (e instanceof Set || e instanceof Map) {
            strings.push(buildMessage(Array.from(e.values())));
        } else if (e instanceof User) {
            strings.push(`<b style="margin-right: 0.25rem">${e.figure.name}</b>`);
        } else if (e instanceof sgsCards.CardBase) {
            let suitClass = [C.CARD_SUIT.HEART, C.CARD_SUIT.DIAMOND].includes(e.suit) ? 'text-danger' : 'text-dark';
            strings.push(`【<b>${e.name}</b>`);
            if (e.faked) {
                strings.push('<span class="text-muted">（');
                strings.push(Array.from(e.getOriginCards(), c => c.name).join('+'));
                strings.push('）</span>');
            }
            if(e.ghost) {
                strings.push('】');
            } else {
                strings.push(`<span class="sgs-card-text sgs-card-suit-${e.suit} ${suitClass}">${e.number}</span>】`);
            }
        } else {
            strings.push(e.toString());
        }
    }

    return strings.join('');
}

function buildPopup(elements) {
    let info = [];
    for (let e of elements) {
        if (e === undefined) continue;

        if (Array.isArray(e)) {
            info.push(...buildPopup(e));
        } else if (e instanceof Set || e instanceof Map) {
            info.push(...buildPopup(Array.from(e.values())));
        } else if (e instanceof User) {
            info.push({targets: [e.figure.name]});
        } else if (e instanceof sgsCards.CardBase) {
            info.push({cards: [e.toJson()]});
        } else if (e instanceof Skill) {
            info.push({skill: e.name});
        } else if (e instanceof Object && e.icon) {
            info.push({icon: e.icon});
        } else if (e instanceof Object) {
            info.push(e);
        } else if (typeof(e) === 'string') {
            info.push({text: {content: e, type: 'info'}});
        } else {
            info.push({text: {content: e.toString(), type: 'info'}});
        }
    }
    return info;
}

module.exports = {buildMessage, buildPopup};
