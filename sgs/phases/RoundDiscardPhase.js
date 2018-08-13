const C = require('../constants');
const utils = require('../utils');
const Phase = require('./phase');


class RoundDiscardPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-DISCARD-PHASE');
        const u = game.roundOwner;

        u.reply('ALERT 请弃牌...', true, true);

        let discardCount = Math.max(u.cards.size - u.maxHandCards(), 0);
        while (discardCount > 0) {
            let command = yield game.wait(u, {
                validCmds: ['CARD', 'CANCEL'],
                validator: (command) => {
                    if (command.cmd === 'CANCEL') {
                        return true;
                    }
                    return command.params.length <= discardCount;
                },
            });

            let discardCardPks = command.params.filter((cardPk) => u.hasCardPk(cardPk));
            if (command.cmd === 'CANCEL') {
                // Random discard cards
                discardCardPks = utils.shuffle(u.cards.keys()).slice(0, discardCount);
            }
            let cards = game.cardsByPk(discardCardPks);
            yield game.removeUserCards(u, cards, true);

            discardCount = Math.max(u.cards.size - u.maxHandCards(), 0);
        }

        u.reply('CLEAR_ALERT');
        u.popRestoreCmd('ALERT');
    }
}

RoundDiscardPhase.name = 'RoundDiscardPhase';
module.exports = RoundDiscardPhase;