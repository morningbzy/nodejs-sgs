const C = require('../constants');
const R = require('../common/results');
const U = require('../utils');
const Phase = require('./phase');
const Context = require('../context');


class RoundPlayPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* useCard(game, ctx) {
        let result;
        let card = U.toSingle(ctx.sourceCards);

        ctx.handlingCards.add(card);

        if (card.faked) {
            console.log(`|[i] Use card [${Array.from(card.originCards, c => c.name).join(', ')}] as [${card.name}]`);
        } else {
            console.log(`|[i] Use card [${card.name}]`);
        }

        result = yield card.start(game, ctx);
        return yield Promise.resolve(result);
    }

    static* start(game) {
        const u = game.roundOwner;
        const phaseContext = new Context();
        let pass = false;
        let result;

        yield u.on('roundPlayPhaseStart', game, phaseContext);

        while (!pass && u.state !== C.USER_STATE.DEAD && game.state !== C.GAME_STATE.ENDING) {
            u.reply('UNSELECT ALL');

            // 结算开始
            const playContext = new Context({
                phaseContext,
                sourceUser: u,
            });
            yield u.on('play', game, playContext);

            let command = yield game.wait(u, {
                waitingTag: C.WAITING_FOR.PLAY,
                validCmds: ['CARD', 'SKILL', 'PASS'],
                validator: (command) => {
                    switch (command.cmd) {
                        case 'CARD':
                            for (let cardPk of command.params) {
                                if (!u.hasCardPk(cardPk)) {
                                    return false;
                                }
                            }
                            break;
                        case 'SKILL':
                            let skill = u.figure.skills[command.params[0]];
                            if (skill.state !== C.SKILL_STATE.ENABLED) {
                                return false;
                            }
                    }
                    return true;
                },
            });

            switch (command.cmd) {
                case 'PASS':
                    pass = true;
                    continue;
                case 'CARD':
                    let card = game.cardByPk(command.params);
                    playContext.sourceCards = U.toArray(card);
                    result = yield this.useCard(game, playContext);
                    break;
                case 'SKILL':
                    let skill = u.figure.skills[command.params[0]];
                    playContext.skill = skill;
                    result = yield u.figure.useSkill(skill, game, playContext);
                    if (result instanceof R.CardResult) {
                        playContext.sourceCards = U.toArray(result.get());
                        result = yield this.useCard(game, playContext);
                    } else {
                    }
                    break;
            }

            // 结算完毕
            game.discardCards(playContext.handlingCards);
        }

        yield u.on('roundPlayPhaseEnd', game, phaseContext);
    }
}

RoundPlayPhase.name = 'RoundPlayPhase';
module.exports = RoundPlayPhase;
