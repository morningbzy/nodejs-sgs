const C = require('../constants');
const Phase = require('./phase');


class RoundJudgePhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-JUDGE-PHASE');
        const u = game.roundOwner;

        for (let judge of u.getJudgeStack()) {
            let card = judge;

            game.message([u, '判定', card]);
            game.broadcast(`JUDGING ${card.pk}`, u);
            let result = yield game.doJudge(u, card.judge);
            game.message([u, '判定', card, '为', result.get(), '判定', result.success ? '生效' : '未生效']);
            yield game.removeUserJudge(u, card);

            if (result.success) {
                yield card.judgeEffect(u, game);
                // TODO: After judge effective
                // for(let _u of game.userRound()) {
                //     judgeCard = _u.on('afterJudgeEffect');
                // }
                // ---------------------------------
            } else {
                yield card.judgeFailed(u, game);
            }
        }
    }
}

RoundJudgePhase.name = 'RoundJudgePhase';
module.exports = RoundJudgePhase;