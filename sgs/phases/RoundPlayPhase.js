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
        u.shaCount = 1;

        let pass = false;
        while (!pass && game.state !== C.GAME_STATE.ENDING) {
            yield u.on('requirePlay', game, {});

            let command = yield game.wait(u, {
                validCmds: ['CARD', 'SKILL', 'PASS'],
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
                    if (card instanceof sgsCards.Sha) {
                        game.lockUserCards(u, [card]);
                        let context = {
                            sourceCards: [card],
                        };
                        let result = yield ShaStage.start(game, u, context);
                        if (result === 'cancel') {
                            // User cancel
                        }
                    }
                    game.unlockUserCards(u, [card]);
                    break;
                case 'SKILL':
                    let skill = u.figure.skills[command.params[0]];
                    let context = {
                        sourceUser: u,
                        skill: skill,
                    };
                    if(skill.state === C.SKILL_STATE.ENABLED) {
                        let result = yield u.figure.useSkill(skill, game, context);
                        if (result === 'cancel') {
                            // User cancel
                        }
                    }
                    break;
            }
        }
    }
};
