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

    static* useCard(game, context, asClass) {
        let cards = context.sourceCards;
        let u = context.sourceUser;

        if (!asClass && cards.length !== 1) {
            console.log(`|<!> Invalid useCard invoking: !asClass && cards.length !== 1`);
            return yield Promise.resolve(R.fail);
        }

        if (asClass) {
            console.log(`|[i] use card ${cards[0].name} as ${asClass}`);
        } else {
            console.log(`|[i] use card ${cards[0].name}`);
        }

        asClass = asClass || cards[0].constructor;

        let result;
        // if (asClass === sgsCards.Sha || cards[0] instanceof sgsCards.Sha) {
        if (asClass === sgsCards.Sha) {
            result = yield ShaStage.start(game, u, context);
        }
        // if (asClass === sgsCards.Tao || cards[0] instanceof sgsCards.Tao) {
        if (asClass === sgsCards.Tao) {
            result = yield u.on('useTao', game, context);
        }
        // if (asClass.__proto__ === sgsCards.SilkBagCard || cards[0] instanceof sgsCards.SilkBagCard) {
        if (asClass.__proto__ === sgsCards.SilkBagCard) {
            result = yield asClass.start(game, context);
        }
        if (asClass.__proto__ === sgsCards.DelayedSilkBagCard) {
            result = yield asClass.start(game, context);
        }
        return yield Promise.resolve(result);
    }

    static* start(game) {
        console.log('ROUND-PLAY-PHASE');
        const u = game.roundOwner;
        u.shaCount = 1;

        let pass = false;
        while (!pass && u.state !== C.USER_STATE.DEAD && game.state !== C.GAME_STATE.ENDING) {
            yield u.on('play', game, {});

            let command = yield game.wait(u, {
                waitingTag: C.WAITING_FOR.PLAY,
                validCmds: ['CARD', 'SKILL', 'PASS'],
                validator: (command) => {
                    switch (command.cmd) {
                        case 'CARD':
                            if (command.params.length !== 1) {
                                return false;
                            }
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

            let context = {
                sourceUser: u,
            };
            let result;
            switch (command.cmd) {
                case 'PASS':
                    pass = true;
                    continue;
                case 'CARD':
                    let card = cardManager.getCards(command.params)[0];
                    context.sourceCards = [card];
                    result = yield this.useCard(game, context);
                    break;
                case 'SKILL':
                    let skill = u.figure.skills[command.params[0]];
                    context.skill = skill;
                    if (skill.state === C.SKILL_STATE.ENABLED) {
                        result = yield u.figure.useSkill(skill, game, context);
                        if (result instanceof R.CardResult) {
                            let obj = result.get();
                            context.sourceCards = obj.cards;
                            result = yield this.useCard(game, context, obj.asClass);
                        }
                    }
                    break;
            }
        }
    }
}

RoundPlayPhase.name = 'RoundPlayPhase';
module.exports = RoundPlayPhase;
