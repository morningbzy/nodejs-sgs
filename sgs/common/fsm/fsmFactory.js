const C = require('../../constants');
const R = require('../results');
const U = require('../../utils');
const FSM = require('.');
const {SkillContext} = require('../../context');

const ST = C.SELECT_TYPE;


class MachineFactory {
    requireSingleCard(game, ctx, opt) {
        let m = new FSM.Machine(game, ctx);
        m.addState(new FSM.State('C'), true);
        m.addState(new FSM.State('O'));

        m.addTransition(new FSM.Transition('C', 'CARD', 'O',
            opt.cardValidator,
            (game, info) => {
                info.card = game.cardByPk(info.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('C', 'CANCEL', '_'));
        m.addTransition(new FSM.Transition('O', 'CARD', 'O',
            opt.cardValidator,
            (game, info) => {
                let u = game.userByPk(info.command.uid);
                u.reply(`UNSELECT CARD ${info.card.pk}`);
                info.card = game.cardByPk(info.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'UNCARD', 'C', null,
            (game, info) => {
                info.card = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'OK', '_', null,
            (game, info) => {
                info.result = new R.CardResult().set(info.card);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));

        return m;
    }

    requireSingleTarget(game, ctx, opt) {
        let m = new FSM.Machine(game, ctx);
        m.addState(new FSM.State('T'), true);
        m.addState(new FSM.State('O'));

        m.addTransition(new FSM.Transition('T', 'TARGET', 'O',
            opt.targetValidator,
            (game, info) => {
                info.target = game.userByPk(info.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('T', 'CANCEL', '_'));
        m.addTransition(new FSM.Transition('O', 'TARGET', 'O',
            opt.targetValidator,
            (game, info) => {
                let u = game.userByPk(info.command.uid);
                u.reply(`UNSELECT TARGET ${info.target.id}`);
                info.target = game.userByPk(info.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'UNTARGET', 'T', null,
            (game, info) => {
                info.target = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'OK', '_', null,
            (game, info) => {
                info.result = new R.TargetResult().set(info.target);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));

        if (opt.cancelOnUncard === true) {
            m.addTransition(new FSM.Transition('T', 'UNCARD', '_'));
            m.addTransition(new FSM.Transition('O', 'UNCARD', '_'));
        }

        return m;
    }

    requireSingleCardAndTarget(game, ctx, opt) {
        let m = new FSM.Machine(game, ctx);
        m.addState(new FSM.State('C'), true);
        m.addState(new FSM.State('T'));
        m.addState(new FSM.State('O'));

        m.addTransition(new FSM.Transition('C', 'CARD', 'T',
            opt.cardValidator,
            (game, info) => {
                info.card = game.cardByPk(info.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('C', 'CANCEL', '_'));

        m.addTransition(new FSM.Transition('T', 'TARGET', 'O',
            opt.targetValidator,
            (game, info) => {
                info.target = game.userByPk(info.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('T', 'CARD', 'T',
            opt.cardValidator,
            (game, info) => {
                let u = game.userByPk(info.command.uid);
                u.reply(`UNSELECT CARD ${info.card.pk}`);
                info.card = game.cardByPk(info.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('T', 'UNCARD', 'C', null,
            (game, info) => {
                info.card = null;
            }
        ));
        m.addTransition(new FSM.Transition('T', 'CANCEL', '_'));

        m.addTransition(new FSM.Transition('O', 'TARGET', 'O',
            opt.targetValidator,
            (game, info) => {
                let u = game.userByPk(info.command.uid);
                u.reply(`UNSELECT TARGET ${info.target.id}`);
                info.target = game.userByPk(info.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'UNTARGET', 'T', null,
            (game, info) => {
                info.target = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'CARD', 'T',
            opt.cardValidator,
            (game, info) => {
                let u = game.userByPk(info.command.uid);
                u.reply(`UNSELECT CARD ${info.card.pk}`);
                u.reply(`UNSELECT TARGET ${info.target.id}`);
                info.card = game.cardByPk(info.command.params);
                info.target = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'UNCARD', 'C', null,
            (game, info) => {
                let u = game.userByPk(info.command.uid);
                u.reply(`UNSELECT TARGET ${info.target.id}`);
                info.card = null;
                info.target = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'OK', '_', null,
            (game, info) => {
                info.result = new R.CardTargetResult().set(info.card, info.target);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));

        if (opt.cancelOnUncard === true) {
            m.addTransition(new FSM.Transition('T', 'UNCARD', '_'));
            m.addTransition(new FSM.Transition('O', 'UNCARD', '_'));
        }

        return m;
    }

    requireSpecCard(game, ctx, opt) {
        const {
            u,
            cardClass,
        } = opt;

        let m = new FSM.Machine(game, ctx);
        m.addState(new FSM.State('CSE'), true);
        m.addState(new FSM.State('O'));
        m.addState(new FSM.State('S', function* (info) {
            let command = info.command;
            let skill = u.figure.skills[command.params[0]];
            let skillCtx = new SkillContext(game, skill, {
                requireCard: true,
            }).linkParent(info.parentCtx);
            let result = yield u.figure.triggerSkill(skill, info.game, skillCtx);
            let nextCmd = (result.success && result instanceof R.CardResult) ? 'OK' : 'CANCEL';
            info.result = result;
            return yield Promise.resolve({
                cmd: nextCmd,
                params: [],
            });
        }));

        m.addTransition(new FSM.Transition('CSE', 'CARD', 'O',
            (command) => {
                let card = game.cardByPk(command.params);
                return (u.hasCard(card) && card instanceof cardClass);
            },
            (game, info) => {
                info.card = game.cardByPk(info.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('CSE', 'SKILL', 'S',
            (command) => {
                let skill = u.figure.skills[command.params[0]];
                return (skill.state === C.SKILL_STATE.ENABLED);
            }
        ));
        m.addTransition(new FSM.Transition('CSE', 'CANCEL', '_'));
        m.addTransition(new FSM.Transition('O', 'UNCARD', 'CSE', null,
            (game, info) => {
                info.card = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'OK', '_', null,
            (game, info) => {
                info.result = new R.CardResult().set(info.card);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));
        m.addTransition(new FSM.Transition('S', 'OK', '_'));
        m.addTransition(new FSM.Transition('S', 'CANCEL', 'CSE'));

        return m;
    }

    requireCardsAndTargets(game, ctx, opt) {
        let {
            u,
            cardCount,
            targetCount,
            cardValidator,
            targetValidator,
            initCtx = {
                cards: new Set(),
                targets: new Set(),
            }
        } = opt;

        cardCount = cardCount instanceof Function ? cardCount(ctx) : cardCount;
        targetCount = targetCount instanceof Function ? targetCount(ctx) : targetCount;

        let m = new FSM.Machine(game, ctx);
        m.setContext(initCtx);

        let stateC, stateT, stateO;
        if (cardCount === ST.NONE) {
            stateC = null;
        } else {
            stateC = new FSM.State('C');
            cardValidator = [
                cardValidator,
                FSM.BASIC_VALIDATORS.buildCountExceededValidator('cards', cardCount)
            ];
            m.addState(stateC, true);
        }

        if (targetCount === ST.NONE) {
            stateT = null;
        } else if (cardCount === ST.ONE_OR_MORE) {
            stateT = new FSM.State('CT');
            m.addState(stateT);
        } else {
            stateT = new FSM.State('T');
            targetValidator = [
                targetValidator,
                FSM.BASIC_VALIDATORS.buildCountExceededValidator('targets', targetCount)
            ];
            m.addState(stateT, stateC === null);
        }

        if (targetCount === ST.ONE_OR_MORE) {
            stateO = new FSM.State('TO');
        } else if (cardCount === ST.ONE_OR_MORE && targetCount === ST.None) {
            stateO = new FSM.State('CO');
        } else {
            stateO = new FSM.State('O');
        }
        m.addState(stateO, (stateC === null && stateT === null));
        console.log(`FSM:initial:stateT.pk: ${stateC ? stateC.pk : '/'} - ${stateT ? stateT.pk : '/'} - ${stateO.pk}`);

        if (stateC) {
            m.addTransition(new FSM.Transition('C', 'CANCEL', '_'));
            m.addTransition(new FSM.Transition('C', 'CARD',
                (game, info) => {
                    const next = stateT ? stateT.pk : stateO.pk;
                    return (cardCount === ST.ONE_OR_MORE
                        || cardCount <= info.cards.size) ? next : 'C';
                },
                cardValidator,
                (game, info) => {
                    let u = game.userByPk(info.command.uid);
                    if (cardCount === ST.SINGLE && info.cards.size > 0) {
                        info.cards.forEach((card) => u.reply(`UNSELECT CARD ${card.pk}`));
                        info.cards.clear();
                    }
                    let card = game.cardByPk(info.command.params);
                    info.cards.add(card);
                }
            ));
            m.addTransition(new FSM.Transition('C', 'UNCARD', 'C', null,
                (game, info) => {
                    let card = game.cardByPk(info.command.params);
                    info.cards.delete(card);
                }
            ));
        }

        if (stateT) {
            m.addTransition(new FSM.Transition(stateT.pk, 'CANCEL', '_'));
            m.addTransition(new FSM.Transition(stateT.pk, 'TARGET',
                (game, info) => {
                    return (targetCount === ST.ONE_OR_MORE
                        || targetCount <= info.targets.size) ? stateO.pk : stateT.pk;
                },
                targetValidator,
                (game, info) => {
                    let u = game.userByPk(info.command.uid);
                    if (targetCount === ST.SINGLE && info.targets.size > 0) {
                        info.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                        info.targets.clear();
                    }
                    let target = game.userByPk(info.command.params);
                    info.targets.add(target);
                }
            ));
            m.addTransition(new FSM.Transition(stateT.pk, 'UNTARGET', stateT.pk, null,
                (game, info) => {
                    let target = game.userByPk(info.command.params);
                    info.targets.delete(target);
                }
            ));
            if (stateC && stateT.pk === 'T') {
                m.addTransition(new FSM.Transition('T', 'CARD', 'C',
                    cardValidator,
                    (game, info) => {
                        let u = game.userByPk(info.command.uid);
                        let card = game.cardByPk(info.command.params);
                        if (cardCount === ST.SINGLE) {
                            info.cards.forEach((c) => u.reply(`UNSELECT CARD ${c.pk}`));
                            info.cards.clear();
                        }
                        info.targets.forEach((t) => u.reply(`UNSELECT TARGET ${t.id}`));
                        info.targets.clear();
                        info.cards.add(card);
                    }
                ));
                m.addTransition(new FSM.Transition('T', 'UNCARD', 'C', null,
                    (game, info) => {
                        let u = game.userByPk(info.command.uid);
                        info.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                        info.targets.clear();
                        let card = game.cardByPk(info.command.params);
                        info.cards.delete(card);
                    }
                ));
            } else if (stateC && stateT.pk === 'CT') {
                m.addTransition(new FSM.Transition('CT', 'CARD', 'CT',
                    cardValidator,
                    (game, info) => {
                        let u = game.userByPk(info.command.uid);
                        info.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                        info.targets.clear();
                        let card = game.cardByPk(info.command.params);
                        info.cards.add(card);
                    }
                ));
                m.addTransition(new FSM.Transition('CT', 'UNCARD',
                    (game, info) => {
                        return (info.cards.size < 1) ? 'C' : 'CT';
                    },
                    null,
                    (game, info) => {
                        let u = game.userByPk(info.command.uid);
                        info.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                        info.targets.clear();
                        let card = game.cardByPk(info.command.params);
                        info.cards.delete(card);
                    }
                ));
            }
        }

        if (stateO) {
            m.addTransition(new FSM.Transition(stateO.pk, 'CANCEL', '_'));
            m.addTransition(new FSM.Transition(stateO.pk, 'OK', '_', null,
                (game, info) => {
                    info.result = new R.CardTargetResult().set(U.toArray(info.cards), U.toArray(info.targets));
                }
            ));
            if (stateO.pk === 'O') {
                if (stateT) {
                    m.addTransition(new FSM.Transition('O', 'TARGET', 'O',
                        targetValidator,
                        (game, info) => {
                            let u = game.userByPk(info.command.uid);
                            let target = game.userByPk(info.command.params);
                            if (targetCount === ST.SINGLE && info.targets.size > 0) {
                                info.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                                info.targets.clear();
                            }
                            info.targets.add(target);
                        }
                    ));
                    m.addTransition(new FSM.Transition('O', 'UNTARGET', stateT.pk, null,
                        (game, info) => {
                            let target = game.userByPk(info.command.params);
                            info.targets.delete(target);
                        }
                    ));
                }
                if (stateC) {
                    m.addTransition(new FSM.Transition('O', 'CARD',
                        (game, info) => {
                            return (stateT.pk === 'CT') ? 'CT' : 'C';
                        },
                        cardValidator,
                        (game, info) => {
                            let u = game.userByPk(info.command.uid);
                            let card = game.cardByPk(info.command.params);
                            if (cardCount === ST.SINGLE) {
                                info.cards.forEach((c) => u.reply(`UNSELECT CARD ${c.pk}`));
                                info.cards.clear();
                            }
                            info.targets.forEach((t) => u.reply(`UNSELECT TARGET ${t.id}`));
                            info.targets.clear();
                            info.cards.add(card);
                        }
                    ));
                    m.addTransition(new FSM.Transition('O', 'UNCARD',
                        (game, info) => {
                            return (cardCount !== ST.ONE_OR_MORE || info.cards.size < 1) ? 'C' : 'CT';
                        },
                        null,
                        (game, info) => {
                            let u = game.userByPk(info.command.uid);
                            info.targets.forEach((t) => u.reply(`UNSELECT TARGET ${t.id}`));
                            info.targets.clear();
                            let card = game.cardByPk(info.command.params);
                            info.cards.delete(card);
                        }
                    ));

                }
            }
            if (stateO.pk === 'TO') {
                m.addTransition(new FSM.Transition('TO', 'TARGET', 'TO',
                    targetValidator,
                    (game, info) => {
                        let target = game.userByPk(info.command.params);
                        info.targets.add(target);
                    }
                ));
                m.addTransition(new FSM.Transition('TO', 'UNTARGET',
                    (game, info) => {
                        return (info.targets.size < 1) ? stateT.pk : 'TO';
                    },
                    null,
                    (game, info) => {
                        let target = game.userByPk(info.command.params);
                        info.targets.delete(target);
                    }
                ));
                if (stateC) {
                    m.addTransition(new FSM.Transition('TO', 'CARD',
                        (game, info) => {
                            return (stateT.pk === 'CT') ? 'CT' : 'C';
                        },
                        cardValidator,
                        (game, info) => {
                            let u = game.userByPk(info.command.uid);
                            if (cardCount === ST.SINGLE) {
                                info.cards.forEach((card) => u.reply(`UNSELECT CARD ${card.pk}`));
                                info.cards.clear();
                            }
                            info.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                            info.targets.clear();
                            let card = game.cardByPk(info.command.params);
                            info.cards.add(card);
                        }
                    ));
                    m.addTransition(new FSM.Transition('TO', 'UNCARD',
                        (game, info) => {
                            return (stateT.pk === 'CT' && info.cards.size > 0) ? 'CT' : 'C';
                        },
                        null,
                        (game, info) => {
                            let u = game.userByPk(info.command.uid);
                            info.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                            info.targets.clear();
                            let card = game.cardByPk(info.command.params);
                            info.cards.delete(card);
                        }
                    ));
                }
            }
            if (stateO.pk === 'CO') {
                m.addTransition(new FSM.Transition('CO', 'CARD', 'CO',
                    cardValidator,
                    (game, info) => {
                        let card = game.cardByPk(info.command.params);
                        info.cards.add(card);
                    }
                ));
                m.addTransition(new FSM.Transition('CO', 'UNCARD',
                    (game, info) => {
                        return (info.cards.size < 1) ? 'C' : 'CO';
                    },
                    null,
                    (game, info) => {
                        let card = game.cardByPk(info.command.params);
                        info.cards.delete(card);
                    }
                ));
            }
        }

        return m;
    }
}


const factory = new MachineFactory();


module.exports.get = (name, game, ctx, opt = {}) => {
    return factory[name](game, ctx, opt);
};

