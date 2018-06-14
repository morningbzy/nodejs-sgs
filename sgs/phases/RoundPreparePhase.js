const C = require('../constants');
const Phase = require('./phase');


class RoundPreparePhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-PREPARE-PHASE');
        const u = game.roundOwner;
    }
}

RoundPreparePhase.name = 'RoundPreparePhase';
module.exports = RoundPreparePhase;
