const C = require('../constants');
const R = require('../common/results');
const Phase = require('./phase');


class RoundPlayPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* useCard(game, context) {
        let result;
        let card = context.sourceCards[0];
        let u = context.sourceUser;

        if (card.faked) {
            console.log(`|[i] Use card [${Array.from(card.originCards, c => c.name).join(', ')}] as [${card.name}]`);
        } else {
            console.log(`|[i] Use card [${card.name}]`);
        }

        result = yield card.start(game, context);
        return yield Promise.resolve(result);
    }

    static* start(game) {
        let context = {};
        let pass = false;
        let result;

        const u = game.roundOwner;
        u.shaCount = 1;

        yield u.on('roundPlayPhaseStart', game, context);

        while (!pass && u.state !== C.USER_STATE.DEAD && game.state !== C.GAME_STATE.ENDING) {
            u.reply('UNSELECT ALL');
            yield u.on('play', game, context);

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

            context = {
                sourceUser: u,
            };
            switch (command.cmd) {
                case 'PASS':
                    pass = true;
                    continue;
                case 'CARD':
                    let card = game.cardByPk(command.params);
                    context.sourceCards = [card];
                    result = yield this.useCard(game, context);
                    break;
                case 'SKILL':
                    let skill = u.figure.skills[command.params[0]];
                    context.skill = skill;
                    result = yield u.figure.useSkill(skill, game, context);
                    if (result instanceof R.CardResult) {
                        context.sourceCards = [result.get()];
                        result = yield this.useCard(game, context);
                    } else {
                    }
                    break;
            }
        }

        yield u.on('roundPlayPhaseEnd', game, context);
    }
}

RoundPlayPhase.name = 'RoundPlayPhase';
module.exports = RoundPlayPhase;
