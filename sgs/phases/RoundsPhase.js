const C = require('../constants');
const Phase = require('./phase');

const subPhases = [
    'RoundStartPhase',
    'RoundPreparePhase',
    'RoundJudgePhase',
    'RoundDrawCardPhase',
    'RoundPlayPhase',
    'RoundDiscardPhase',
    'RoundEndPhase',
].map((className) => require(`./${className}`));

module.exports = class extends Phase {
    constructor(game) {
        super(game);
    }

    static roundPhases(game) {
        return function* gen() {
            for (let p of subPhases) {
                yield p.start(game);
            }
        };
    };

    static* start(game) {
        game.state = C.GAME_STATE.ROUNDS;
        console.log('ROUND-PHASE');

        while (game.state !== C.GAME_STATE.ENDING) {
            for (let u of game.userRound()) {
                if (![C.USER_STATE.ALIVE, C.USER_STATE.DYING].includes(u.state)) {
                    continue;
                }
                game.roundOwner = u;
                yield this.roundPhases(game);
            }
        }

        console.log('ROUND-PHASE-DONE');
    }
};