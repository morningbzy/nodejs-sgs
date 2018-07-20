const C = require('../constants');
const R = require('../common/results');
const U = require('../utils');
const FSM = require('../common/stateMachines');
const Phase = require('./phase');
const Context = require('../context');


class RoundPlayPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* useCard(game, ctx) {
        let u = ctx.sourceUser;
        let card = U.toSingle(ctx.sourceCards);

        if (card.faked) {
            console.log(`|[i] Use card [${Array.from(card.originCards, c => c.name).join(', ')}] as [${card.name}]`);
        } else {
            console.log(`|[i] Use card [${card.name}]`);
        }

        // TODO fire '?Target' events
        // on shaTarget, beShaTarget, afterShaTarget, afterBeShaTarget ...

        yield game.removeUserCards(u, ctx.sourceCards);
        ctx.handlingCards.add(card);

        yield card.start(game, ctx);
    }

    static* start(game) {
        const u = game.roundOwner;
        const phaseContext = new Context();
        let pass = false;
        let result;

        yield u.on('roundPlayPhaseStart', game, phaseContext);

        while (!pass && u.state !== C.USER_STATE.DEAD && game.state !== C.GAME_STATE.ENDING) {
            u.reply('UNSELECT ALL');

            // 一次出牌结算开始
            const playContext = new Context({
                phaseContext,
                sourceUser: u,
            });
            yield u.on('play', game, playContext);

            const requirePlay = () => {
                let m = new FSM.Machine(game);
                m.addState(new FSM.State('CSP'), true);
                m.addState(new FSM.State('C', function* (game, ctx, fsmContext) {
                    let nextCmd;
                    let params = [];
                    ctx.card = fsmContext.card;
                    let result = yield ctx.card.init(game, ctx);
                    fsmContext.result = result;
                    if (result.success) {
                        nextCmd = 'OK';
                    } else {
                        // Another Card
                        if (result instanceof R.CardResult) {
                            nextCmd = 'CARD';
                            params = [result.get().pk];
                        } else {
                            u.reply('UNSELECT ALL');
                            nextCmd = 'UNCARD';
                        }
                    }
                    console.warn('requirePlay:State[C]:_SUB', nextCmd);
                    return yield Promise.resolve({
                        command: nextCmd,
                        params
                    });
                }));
                m.addState(new FSM.State('S', function* (game, ctx, fsmContext) {
                    let nextCmd;
                    let params = [];
                    ctx.skill = fsmContext.skill;
                    let result = yield ctx.skill.init(game, ctx);
                    fsmContext.result = result;
                    if (result.success) {
                        nextCmd = 'OK';
                    } else {
                        nextCmd = 'CANCEL';
                    }
                    console.warn('requirePlay:State[S]:_SUB', nextCmd);
                    return yield Promise.resolve({
                        command: nextCmd,
                        params
                    });
                }));

                m.addTransition(new FSM.Transition('CSP', 'CARD', 'C',
                    (command) => {
                        let card = game.cardByPk(command.params);
                        return u.hasCard(card);
                    },
                    (game, ctx) => {
                        ctx.card = game.cardByPk(ctx.command.params);
                    }
                ));
                m.addTransition(new FSM.Transition('CSP', 'SKILL', 'S',
                    (command) => {
                        let skill = u.figure.skills[command.params[0]];
                        return (skill.state === C.SKILL_STATE.ENABLED);
                    },
                    (game, ctx) => {
                        ctx.skill = u.figure.skills[command.params[0]];
                    }
                ));
                m.addTransition(new FSM.Transition('CSP', 'PASS', '_'));

                m.addTransition(new FSM.Transition('C', 'CARD', 'C', null,
                    (game, ctx) => {
                        console.warn('requirePlay:T[C-CARD-C]:a', ctx.command);
                        // u.reply(`SELECT CARD ${ctx.command.params}`);
                        ctx.card = game.cardByPk(ctx.command.params);
                    }
                ));
                m.addTransition(new FSM.Transition('C', 'UNCARD', 'CSP'));
                m.addTransition(new FSM.Transition('C', 'OK', '_', null,
                    (game, ctx) => {
                        return ctx.result;
                    }
                ));

                m.addTransition(new FSM.Transition('S', 'CANCEL', 'CSP'));
                m.addTransition(new FSM.Transition('S', 'OK', '_', null,
                    (game, ctx) => {
                        return ctx.result;
                    }
                ));

                m.setFinalHandler((r) => {
                    return r.get().pop();
                });

                return m;
            };

            let result = yield game.waitFSM(u, requirePlay(), playContext);
            console.log('RountPlayPhase.*start', result);
            u.reply('UNSELECT ALL');

            if (result.abort) {
                pass = true;
            } else if (result.fail) {

            } else if (result instanceof R.CardTargetResult) {
                // Execute card
                playContext.sourceCards = result.get().card;
                playContext.targets = U.toArray(result.get().target);
                yield this.useCard(game, playContext);
            } else if (result instanceof R.CardResult) {
                console.error('Card without a target???');
                playContext.sourceCards = result.get();
                playContext.targets = null;
                yield this.useCard(game, playContext);
            } else {
            }

            // let command = yield game.wait(u, {
            //     waitingTag: C.WAITING_FOR.PLAY,
            //     validCmds: ['CARD', 'SKILL', 'PASS'],
            //     validator: (command) => {
            //         switch (command.cmd) {
            //             case 'CARD':
            //                 for (let cardPk of command.params) {
            //                     if (!u.hasCardPk(cardPk)) {
            //                         return false;
            //                     }
            //                 }
            //                 break;
            //             case 'SKILL':
            //                 let skill = u.figure.skills[command.params[0]];
            //                 if (skill.state !== C.SKILL_STATE.ENABLED) {
            //                     return false;
            //                 }
            //         }
            //         return true;
            //     },
            // });
            //
            // switch (command.cmd) {
            //     case 'PASS':
            //         pass = true;
            //         continue;
            //     case 'CARD':
            //         let card = game.cardByPk(command.params);
            //         playContext.sourceCards = U.toArray(card);
            //         result = yield this.useCard(game, playContext);
            //         break;
            //     case 'SKILL':
            //         let skill = u.figure.skills[command.params[0]];
            //         playContext.skill = skill;
            //         result = yield u.figure.useSkill(skill, game, playContext);
            //         if (result instanceof R.CardResult) {
            //             playContext.sourceCards = U.toArray(result.get());
            //             result = yield this.useCard(game, playContext);
            //         } else {
            //         }
            //         break;
            // }

            // 结算完毕
            game.discardCards(playContext.handlingCards);
        }

        yield u.on('roundPlayPhaseEnd', game, phaseContext);
    }
}

RoundPlayPhase.name = 'RoundPlayPhase';
module.exports = RoundPlayPhase;
