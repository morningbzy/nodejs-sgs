const C = require('../constants');
const Phase = require('./phase');


module.exports = class extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-PLAY-PHASE');
        const u = game.roundOwner;
        yield game.wait(u, {
            validator: (uid, cmd, params) => {
                if (uid !== u.id || cmd !== 'PLAY_CARD') {
                    return false;
                }
                return true;
            },
            value: (uid, cmd, params) => {
                return params[0];  // Card.pk
            },
        });
    }
};
