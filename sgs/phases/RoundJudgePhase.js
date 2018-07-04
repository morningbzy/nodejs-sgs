const C = require('../constants');
const Phase = require('./phase');


class RoundJudgePhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        console.log('ROUND-JUDGE-PHASE');
        const u = game.roundOwner;

        let judge = u.popJudge();
        while (judge) {
            let {card} = judge;

            // ---------------------------------
            // TODO: Before judge, ask WuXieKeJi
            // for(let _u of game.userRound()) {
            //     judgeCard = _u.on('beforeJudge');
            // }
            let judgeCard = game.getJudgeCard();
            let context = {judgeCard};
            game.message([u, '判定', card, '为', context.judgeCard]);
            game.discardCards([judgeCard]);

            // TODO: Before judge effective, ask SiMaYi & ZhangJiao
            for (let _u of game.userRound()) {
                yield _u.on('beforeJudgeEffect', game, context);
            }

            yield u.on('judge', game, context);  // 目前仅用于小乔的【红颜】
            let result = card.judge(context.judgeCard);
            game.message([u, '判定', card, '为', context.judgeCard, '判定', result.success ? '生效' : '未生效']);

            if (result.success) {
                card.judgeEffect(u);
            }
            // TODO: After judge effective
            // for(let _u of game.userRound()) {
            //     judgeCard = _u.on('afterJudgeEffect');
            // }
            // ---------------------------------
            game.discardCards([card]);

            // next
            judge = u.popJudge();
        }
    }
}

RoundJudgePhase.name = 'RoundJudgePhase';
module.exports = RoundJudgePhase;