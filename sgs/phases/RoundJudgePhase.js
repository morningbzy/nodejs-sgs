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
        while(judge) {
            let {card, asClass} = judge;
            console.log(`|[i] Judging ${card.name} as ${asClass}...`);

            // ---------------------------------
            // TODO: Before judge, ask WuXieKeJi
            // for(let _u of game.userRound()) {
            //     judgeCard = _u.on('beforeJudge');
            // }
            let judgeCard = game.getJudgeCard();
            game.broadcast(`ALERT ${u.figure.name}判定${card.name}为${judgeCard.suit}${judgeCard.number}。`);

            // TODO: Before judge effective, ask SiMaYi & ZhangJiao
            for(let _u of game.userRound()) {
                let result = yield _u.on('beforeJudgeEffect', game);
                if(result.success) {
                    judgeCard = result.get().cards[0];
                    game.broadcast(`ALERT ${u.figure.name}判定${card.name}为${judgeCard.suit}${judgeCard.number}。`);
                }
            }

            let result = asClass.judge(judgeCard);
            game.broadcast(`ALERT ${u.figure.name}判定${card.name}为${judgeCard.suit}${judgeCard.number}。${result.success?'生效':'未生效'}`);
            if(result.success) {
                asClass.judgeEffect(u);
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