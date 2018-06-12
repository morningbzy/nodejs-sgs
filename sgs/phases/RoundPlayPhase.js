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
                validCmds: ['CARD', 'PASS'],
                validator: (command) => {
                    switch (command.cmd) {
                        case 'CARD':
                            if (command.params.length !== 1) {
                                return false;
                            }
                            for (let cardPk of command.params) {
                                if (!u.hasCardPk(cardPk)) {
                                    return false;
                                }
                            }
                            break;
                    }

                    return true;
                },
            });

            switch (command.cmd) {
                case 'PASS':
                    pass = true;
                    continue;
                case 'CARD':
                    let card = cardManager.getCards(command.params)[0];
                    let result;
                    game.lockUserCards(u, [card]);
                    if (card instanceof sgsCards.Sha) {
                        let stageInfo = {
                            sourceCards: [card],
                        };
                        result = yield ShaStage.start(game, u, stageInfo);
                        if (result === 'cancel') {
                            game.unlockUserCards(u, [card]);
                        }
                    }
                    break;
            }
        }
    }
};
