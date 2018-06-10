const C = require('../constants');
const Phase = require('./phase');


module.exports = class extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-PLAY-PHASE');
        const u = game.roundOwner;
        let pass = false;
        while(!pass) {
            pass = yield game.wait(u, {
                validator: (uid, cmd, params) => {
                    if (uid !== u.id || !['PLAY_CARD', 'PASS'].includes(cmd)) {
                        return false;
                    }
                    return true;
                },
                value: (uid, cmd, params) => {
                    return cmd === 'PASS';  // params[0];  // Card.pk
                },
            });
        }
    }
};
