const C = require('../constants');
const U = require('../utils');
const Phase = require('./phase');


class RoundStartPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-START-PHASE');
        const u = game.roundOwner;
    }
}

RoundStartPhase.name = 'RoundStartPhase';
module.exports = RoundStartPhase;
