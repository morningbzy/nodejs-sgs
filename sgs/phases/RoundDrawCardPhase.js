const C = require('../constants');
const Phase = require('./phase');


class RoundDrawCardPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-DRAW-CARD-PHASE');
        const u = game.roundOwner;
        game.message([u, '从牌堆里摸了两张卡牌']);
        game.dispatchCards(u, 2);
    }
}

RoundDrawCardPhase.name = 'RoundDrawCardPhase';
module.exports = RoundDrawCardPhase;
