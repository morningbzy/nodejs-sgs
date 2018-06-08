const C = require('../constants');
const Phase = require('./phase');


module.exports = class extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        game.state = C.GAME_STATE.INIT_CARDS;
        for (let u of game.userRound()) {
            game.dispatchCards(u, 4);
        }
    }
};
