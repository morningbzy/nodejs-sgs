const C = require('../constants');
const Phase = require('./phase');
const cardManager = require('../cards');
const sgsCards = require('../cards/cards');
const ShaStage = require('./sha/ShaStage');


module.exports = class extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-PLAY-PHASE');
        const u = game.roundOwner;
        let pass = false;
        while (!pass) {
            let command = yield game.wait(u, {
                validator: (command) => {
                    if (command.uid !== u.id || !['PLAY_CARD', 'PASS'].includes(command.cmd)) {
                        return false;
                    }
                    // User own the card
                    return true;
                },
            });

            switch (command.cmd) {
                case 'PASS':
                    pass = true;
                    continue;
                case 'PLAY_CARD':
                    let card = cardManager.getCards(command.params)[0];
                    if (card instanceof sgsCards.Sha) {
                        yield ShaStage.start(game, u);
                    }
                    break;
            }
        }
    }
};
