const C = require('../constants');
const Phase = require('./phase');
const {PhaseContext} = require('../context');


class RoundEndPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game, roundCtx) {
        const u = game.roundOwner;
        const phaseCtx = new PhaseContext(game).linkParent(roundCtx);

        yield u.on('roundEndPhaseStart', game, phaseCtx);
    }
}

RoundEndPhase.name = 'RoundEndPhase';
module.exports = RoundEndPhase;
