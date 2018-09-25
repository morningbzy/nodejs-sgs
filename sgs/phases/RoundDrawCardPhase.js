const C = require('../constants');
const Phase = require('./phase');
const {PhaseContext} = require('../context');


class RoundDrawCardPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game, roundCtx) {
        const u = game.roundOwner;
        const phaseCtx = new PhaseContext(game).linkParent(roundCtx);
        phaseCtx.i.drawCardCount = 2;

        yield u.on('roundDrawCardPhaseStart', game, phaseCtx);
        let pass = phaseCtx.skipPhase === true;

        if (!pass && u.state !== C.USER_STATE.DEAD && game.state !== C.GAME_STATE.ENDING) {
            game.message([u, '从牌堆里摸了两张卡牌']);
            game.dispatchCards(u, phaseCtx.i.drawCardCount);
        }

        yield u.on('roundDrawCardPhaseEnd', game, phaseCtx);
    }
}

RoundDrawCardPhase.name = 'RoundDrawCardPhase';
module.exports = RoundDrawCardPhase;
