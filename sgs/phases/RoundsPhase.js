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
            let userRound = game.userRound(game.zhugong);
            for (let u of userRound) {
                if([C.USER_STATE.DEAD].includes(u.state)) {
                    continue;
                }
                console.log(`|<G> ${u.name}(${u.figure.name})'s ROUND BEGIN`);
                game.roundOwner = u;
                yield this.roundPhases(game);
                console.log(`|<G> ${u.name}(${u.figure.name})'s ROUND END`);

                if(game.usersNotInState(C.USER_STATE.DEAD).length === 1) {
                    game.state = C.GAME_STATE.ENDING;
                }
            }
        }

        console.log('ROUND-PHASE-DONE');
    }
};