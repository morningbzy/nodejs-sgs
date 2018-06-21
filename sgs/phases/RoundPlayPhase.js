const C = require('../constants');
const R = require('../common/results');
const Phase = require('./phase');
const cardManager = require('../cards');
const sgsCards = require('../cards/cards');
const ShaStage = require('./sha/ShaStage');


class RoundPlayPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* useCard(game, context) {
        let result;
        let card = context.sourceCards[0];
        let u = context.sourceUser;

        if(card.faked) {
            console.log(`|[i] Use card [${Array.from(card.originCards, c => c.name).join(', ')}] as [${card.name}]`);
        } else {
            console.log(`|[i] Use card [${card.name}]`);
        }

        if (card instanceof sgsCards.Sha) {
            result = yield ShaStage.start(game, u, context);
        }
        if (card instanceof sgsCards.Tao) {
            result = yield u.on('useTao', game, context);
        }
        if (card instanceof sgsCards.SilkBagCard) {
            result = yield card.start(game, context);
        }
        if (card instanceof sgsCards.DelayedSilkBagCard) {
            result = yield card.start(game, context);
        }
        if (card instanceof sgsCards.EquipmentCard) {
            game.equipUserCard(u, card);
            result = yield Promise.resolve(R.success);
        }
        return yield Promise.resolve(result);
    }

    static* start(game) {
        console.log('ROUND-PLAY-PHASE');
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
                    let cards = cardManager.getCards(command.params);
                    context.sourceCards = cards;
                    result = yield this.useCard(game, context);
                    break;
                case 'SKILL':
                    let skill = u.figure.skills[command.params[0]];
                    context.skill = skill;
                    if (skill.state === C.SKILL_STATE.ENABLED) {
                        result = yield u.figure.useSkill(skill, game, context);
                        if (result instanceof R.CardResult) {
                            let {cards} = result.get();
                            context.sourceCards = cards;
                            result = yield this.useCard(game, context);
                        }
                    }
                    break;
            }
        }

        yield u.on('roundPlayPhaseEnd', game, context);
    }
}

RoundPlayPhase.name = 'RoundPlayPhase';
module.exports = RoundPlayPhase;
