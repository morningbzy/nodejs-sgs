const C = require('../constants');
const Phase = require('./phase');
const {PhaseContext, CardContext} = require('../context');


class RoundJudgePhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-JUDGE-PHASE');
        const u = game.roundOwner;
        const phaseCtx = new PhaseContext(game);

        for (let card of u.getJudgeStack()) {
            game.broadcast(`JUDGING ${card.pk}`, u);
            game.message([u, '判定', card]);

            let targets = new Set([u]);
            let cardCtx = new CardContext(game, card, {
                sourceUser: u,
                targets,
            }).linkParent(phaseCtx);

            for (let target of targets) {
                cardCtx.i.silkCardEffect = true;
                cardCtx.i.currentTarget = target;

                yield target.on('beforeSilkCardEffect', game, cardCtx);

                if (cardCtx.i.silkCardEffect) {
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
                } else {
                    yield game.removeUserJudge(u, card);
                    yield card.judgeFailed(u, game);
                }
            }
        }
    }
}

RoundJudgePhase.name = 'RoundJudgePhase';
module.exports = RoundJudgePhase;