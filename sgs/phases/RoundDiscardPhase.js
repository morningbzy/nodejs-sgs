const C = require('../constants');
const utils = require('../utils');
const Phase = require('./phase');


module.exports = class extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-DISCARD-PHASE');
        const u = game.roundOwner;

        let discardCount = Math.max(u.cards.size - u.hp, 0);
        while(discardCount > 0) {
            let command = yield game.wait(u, {
                validCmds: ['PLAY_CARD', 'CANCEL'],
                validator: (command) => {
                    if(command.cmd === 'CANCEL') {
                        return true;
                    }
                    return command.params.length <= discardCount;
                },
            });

            let discardCardPks = command.params;
            if(command.cmd === 'CANCEL') {
                // Random discard cards
                discardCardPks = utils.shuffle(u.cards).map((c) => c.pk).slice(0, discardCount);
            }

            console.log(discardCardPks);

            game.removeUserCards(u, discardCardPks);
            game.discardCards(discardCardPks);
            discardCount = Math.max(u.cards.size - u.hp, 0);
        }
    }
};
