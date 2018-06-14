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

        let discardCount = Math.max(u.cards.size - u.hp, 0);
        while(discardCount > 0) {
            let command = yield game.wait(u, {
                validCmds: ['CARD', 'CANCEL'],
                validator: (command) => {
                    if(command.cmd === 'CANCEL') {
                        return true;
                    }
                    return command.params.length <= discardCount;
                },
            });

            let discardCardPks = command.params.filter((cardPk) => u.hasCardPk(cardPk));
            if(command.cmd === 'CANCEL') {
                // Random discard cards
                discardCardPks = utils.shuffle(u.cards.keys()).slice(0, discardCount);
            }
            game.removeUserCardPks(u, discardCardPks);
            game.discardCardPks(discardCardPks);
            discardCount = Math.max(u.cards.size - u.hp, 0);
        }
    }
}

RoundDiscardPhase.name = 'RoundDiscardPhase';
module.exports = RoundDiscardPhase;