const C = require('../constants');
const Phase = require('./phase');


module.exports = class extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-DISCARD-PHASE');
        const u = game.roundOwner;
    }
};
