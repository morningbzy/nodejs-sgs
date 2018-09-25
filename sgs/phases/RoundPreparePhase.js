const C = require('../constants');
const Phase = require('./phase');
const {PhaseContext} = require('../context');


class RoundPreparePhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game, roundCtx) {
        const u = game.roundOwner;
        const phaseCtx = new PhaseContext(game).linkParent(roundCtx);
        yield u.on('roundPreparePhaseStart', game, phaseCtx);
        game.discardCards(phaseCtx.allHandlingCards());
    }
}

RoundPreparePhase.name = 'RoundPreparePhase';
module.exports = RoundPreparePhase;
