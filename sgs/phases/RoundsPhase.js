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
        let u = game.roundOwner;
        return function* gen() {
            for (let p of subPhases) {
                console.log(p.name);
                while (u.phases[p.name]) {
                    if (u.state === C.USER_STATE.DEAD || game.state === C.GAME_STATE.ENDING)
                        return;
                    yield p.start(game);
                    u.phases[p.name]--;
                }
            }
        };
    };

    static* start(game) {
        game.state = C.GAME_STATE.ROUNDS;
        console.log('ROUND-PHASE');

        while (game.state !== C.GAME_STATE.ENDING) {
            let userRound = game.userRound(game.zhugong);
            for (let u of userRound) {
                if ([C.USER_STATE.DEAD].includes(u.state)) {
                    continue;
                }
                console.log(`|<G> ${u.name}(${u.figure.name})'s ROUND BEGIN`);

                game.initRound(u);
                yield this.roundPhases(game);
                game.uninitRound(u);
                console.log(`|<G> ${u.name}(${u.figure.name})'s ROUND END`);
            }
        }

        console.log('ROUND-PHASE-DONE');
    }
};