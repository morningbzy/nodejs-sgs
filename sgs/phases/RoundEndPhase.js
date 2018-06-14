const C = require('../constants');
const Phase = require('./phase');


class RoundEndPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-END-PHASE');
        const u = game.roundOwner;
    }
}

RoundEndPhase.name = 'RoundEndPhase';
module.exports = RoundEndPhase;
