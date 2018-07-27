const C = require('../constants');
const Phase = require('./phase');
const {PhaseContext} = require('../context');


class RoundPreparePhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        const u = game.roundOwner;
        const phaseCtx = new PhaseContext(game);
        yield u.on('roundPreparePhaseStart', game, phaseCtx);
        game.discardCards(phaseCtx.allHandlingCards());
    }
}

RoundPreparePhase.name = 'RoundPreparePhase';
module.exports = RoundPreparePhase;
