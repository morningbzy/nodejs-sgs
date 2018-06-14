const C = require('../constants');
const Phase = require('./phase');


class RoundDrawCardPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-DRAW-CARD-PHASE');
        const u = game.roundOwner;
        game.dispatchCards(u, 2);
    }
}

RoundDrawCardPhase.name = 'RoundDrawCardPhase';
module.exports = RoundDrawCardPhase;
