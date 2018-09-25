const C = require('../constants');
const Phase = require('./phase');
const {PhaseContext} = require('../context');


class RoundDrawCardPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        const u = game.roundOwner;
        const phaseCtx = new PhaseContext(game);

        yield u.on('roundDrawCardPhaseStart', game, phaseCtx);
        let pass = phaseCtx.skipPhase === true;

        if (!pass && u.state !== C.USER_STATE.DEAD && game.state !== C.GAME_STATE.ENDING) {
            game.message([u, '从牌堆里摸了两张卡牌']);
            game.dispatchCards(u, 2);
        }

        yield u.on('roundDrawCardPhaseEnd', game, phaseCtx);
    }
}

RoundDrawCardPhase.name = 'RoundDrawCardPhase';
module.exports = RoundDrawCardPhase;
