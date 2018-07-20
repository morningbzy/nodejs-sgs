const C = require('../constants');
const R = require('./results');
const FSM = require('./fsm');


class MachineFactory {
    requireOk(game, opt) {
        let m = new FSM.Machine(game);
        m.addState(new FSM.State('O'), true);
        m.addTransition(new FSM.Transition('O', 'OK', '_', null, R.success));
        m.addTransition(new FSM.Transition('O', 'UNCARD', '_'));
        m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));
        return m;
    }

    requireSingleCard(game, opt) {
        let m = new FSM.Machine(game);
        m.addState(new FSM.State('C'), true);
        m.addState(new FSM.State('O'));

        m.addTransition(new FSM.Transition('C', 'CARD', 'O',
            opt.cardValidator,
            (game, ctx) => {
                ctx.card = game.cardByPk(ctx.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('C', 'CANCEL', '_'));
        m.addTransition(new FSM.Transition('O', 'CARD', 'O',
            opt.cardValidator,
            (game, ctx) => {
                let u = game.userByPk(ctx.command.uid);
                u.reply(`UNSELECT CARD ${ctx.card.pk}`);
                ctx.card = game.cardByPk(ctx.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'UNCARD', 'C', null,
            (game, ctx) => {
                ctx.card = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'OK', '_', null,
            (game, ctx) => {
                return new R.CardResult().set(ctx.card);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));

        m.setFinalHandler((r) => {
            return r.get().pop();
        });
        return m;
    }

    requireSingleTarget(game, opt) {
        let m = new FSM.Machine(game);
        m.addState(new FSM.State('T'), true);
        m.addState(new FSM.State('O'));

        m.addTransition(new FSM.Transition('T', 'TARGET', 'O',
            opt.targetValidator,
            (game, ctx) => {
                ctx.target = game.userByPk(ctx.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('T', 'CANCEL', '_'));
        m.addTransition(new FSM.Transition('O', 'TARGET', 'O',
            opt.targetValidator,
            (game, ctx) => {
                let u = game.userByPk(ctx.command.uid);
                u.reply(`UNSELECT TARGET ${ctx.target.id}`);
                ctx.target = game.userByPk(ctx.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'UNTARGET', 'T', null,
            (game, ctx) => {
                ctx.target = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'OK', '_', null,
            (game, ctx) => {
                return new R.TargetResult().set(ctx.target);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));

        if (opt.cancelOnUncard === true) {
            m.addTransition(new FSM.Transition('T', 'UNCARD', '_'));
            m.addTransition(new FSM.Transition('O', 'UNCARD', '_'));
        }

        m.setFinalHandler((r) => {
            return r.get().pop();
        });
        return m;
    }

    requireSingleCardAndTarget(game, opt) {
        let m = new FSM.Machine(game);
        m.addState(new FSM.State('C'), true);
        m.addState(new FSM.State('T'));
        m.addState(new FSM.State('O'));

        m.addTransition(new FSM.Transition('C', 'CARD', 'T',
            opt.cardValidator,
            (game, ctx) => {
                ctx.card = game.cardByPk(ctx.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('C', 'CANCEL', '_'));

        m.addTransition(new FSM.Transition('T', 'TARGET', 'O',
            opt.targetValidator,
            (game, ctx) => {
                ctx.target = game.userByPk(ctx.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('T', 'CARD', 'T',
            opt.cardValidator,
            (game, ctx) => {
                let u = game.userByPk(ctx.command.uid);
                u.reply(`UNSELECT CARD ${ctx.card.pk}`);
                ctx.card = game.cardByPk(ctx.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('T', 'UNCARD', 'C', null,
            (game, ctx) => {
                ctx.card = null;
            }
        ));
        m.addTransition(new FSM.Transition('T', 'CANCEL', '_'));

        m.addTransition(new FSM.Transition('O', 'TARGET', 'O',
            opt.targetValidator,
            (game, ctx) => {
                let u = game.userByPk(ctx.command.uid);
                u.reply(`UNSELECT TARGET ${ctx.target.id}`);
                ctx.target = game.userByPk(ctx.command.params);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'UNTARGET', 'T', null,
            (game, ctx) => {
                ctx.target = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'CARD', 'T',
            opt.cardValidator,
            (game, ctx) => {
                let u = game.userByPk(ctx.command.uid);
                u.reply(`UNSELECT CARD ${ctx.card.pk}`);
                u.reply(`UNSELECT TARGET ${ctx.target.id}`);
                ctx.card = game.cardByPk(ctx.command.params);
                ctx.target = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'UNCARD', 'C', null,
            (game, ctx) => {
                let u = game.userByPk(ctx.command.uid);
                u.reply(`UNSELECT TARGET ${ctx.target.id}`);
                ctx.card = null;
                ctx.target = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'OK', '_', null,
            (game, ctx) => {
                return new R.CardTargetResult().set(ctx.card, ctx.target);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));

        if (opt.cancelOnUncard === true) {
            m.addTransition(new FSM.Transition('T', 'UNCARD', '_'));
            m.addTransition(new FSM.Transition('O', 'UNCARD', '_'));
        }

        m.setFinalHandler((r) => {
            return r.get().pop();
        });

        return m;
    }

    requireSpecCard(game, opt) {
        const {
            cardClass,
            u,
        } = opt;

        let m = new FSM.Machine(game);
        m.addState(new FSM.State('CSE'), true);
        m.addState(new FSM.State('O'));
        m.addState(new FSM.State('S', function* (game, ctx, fsmContext) {
            let command = fsmContext.command;
            let skill = u.figure.skills[command.params[0]];
            let result = yield u.figure.useSkill(skill, game, ctx);
            let nextCmd = result.success ? 'OK' : 'CANCEL';
            fsmContext.result = result;
            return yield Promise.resolve({
                command: nextCmd,
            });
        }));

        m.addTransition(new FSM.Transition('CSE', 'CARD', 'O',
            (command) => {
                let card = game.cardByPk(command.params);
                return (u.hasCard(card) && card instanceof cardClass);
            },
            (game, ctx) => {
                ctx.card = game.cardByPk(ctx.command.params);
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
            (game, ctx) => {
                ctx.card = null;
            }
        ));
        m.addTransition(new FSM.Transition('O', 'OK', '_', null,
            (game, ctx) => {
                return new R.CardResult().set(ctx.card);
            }
        ));
        m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));
        m.addTransition(new FSM.Transition('S', 'OK', '_', null,
            (game, ctx) => {
                return ctx.result;
            }
        ));
        m.addTransition(new FSM.Transition('S', 'CANCEL', 'CSE'));

        m.setFinalHandler((r) => {
            return r.get().pop();
        });

        return m;
    }

    requireCardsAndTargets(game, opt) {
        const {
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
        let m = new FSM.Machine(game);
        m.setContext(initCtx);

        let stateC, stateT, stateO;
        if (cardCount === C.SELECT_TYPE.NONE) {
            stateC = null;
        } else {
            stateC = new FSM.State('C');
            m.addState(stateC);
        }

        if (targetCount === C.SELECT_TYPE.NONE) {
            stateT = null;
        } else if (cardCount === C.SELECT_TYPE.ONE_OR_MORE) {
            stateT = new FSM.State('CT');
        } else {
            stateT = new FSM.State('T');
        }

        if (targetCount === C.SELECT_TYPE.ONE_OR_MORE) {
            stateO = new FSM.State('TO');
        } else if (cardCount === C.SELECT_TYPE.ONE_OR_MORE && targetCount === C.SELECT_TYPE.None) {
            stateO = new FSM.State('CO');
        } else {
            stateO = new FSM.State('O');
        }

        if (stateC) {
            m.addTransition(new FSM.Transition('C', 'CANCEL', '_'));
            m.addTransition(new FSM.Transition('C', 'CARD',
                (game, ctx) => {
                    const next = stateT ? stateT.pk : stateO.pk;
                    return (cardCount === C.SELECT_TYPE.ONE_OR_MORE
                        || cardCount <= ctx.cards.size) ? next : 'C';
                },
                cardValidator,
                (game, ctx) => {
                    if (cardCount === C.SELECT_TYPE.SINGLE && ctx.cards.size > 0) {
                        ctx.cards.forEach((card) => u.reply(`UNSELECT CARD ${card.pk}`));
                        ctx.cards.clear();
                    }
                    let card = game.cardByPk(ctx.command.params);
                    ctx.cards.add(card);
                }
            ));
            m.addTransition(new FSM.Transition('C', 'UNCARD', 'C', null,
                (game, ctx) => {
                    let card = game.cardByPk(ctx.command.params);
                    ctx.cards.delete(card);
                }
            ));
        }

        if (stateT) {
            m.addTransition(new FSM.Transition(stateT.pk, 'CANCEL', '_'));
            m.addTransition(new FSM.Transition(stateT.pk, 'TARGET',
                (game, ctx) => {
                    const next = stateO.pk;
                    return (targetCount === C.SELECT_TYPE.ONE_OR_MORE
                        || targetCount <= ctx.targets.size) ? next : 'T';
                },
                targetValidator,
                (game, ctx) => {
                    if (targetCount === C.SELECT_TYPE.SINGLE && ctx.targets.size > 0) {
                        ctx.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                        ctx.targets.clear();
                    }
                    let target = game.userByPk(ctx.command.params);
                    ctx.targets.add(target);
                }
            ));
            m.addTransition(new FSM.Transition(stateT.pk, 'UNTARGET', 'T', null,
                (game, ctx) => {
                    let target = game.userByPk(ctx.command.params);
                    ctx.targets.delete(target);
                }
            ));
            if (stateC) {
                m.addTransition(new FSM.Transition('T', 'CARD', 'C',
                    cardValidator,
                    (game, ctx) => {
                        let card = game.cardByPk(ctx.command.params);
                        if (cardCount === C.SELECT_TYPE.SINGLE) {
                            ctx.cards.forEach((c) => u.reply(`UNSELECT CARD ${c.pk}`));
                            ctx.cards.clear();
                        }
                        ctx.targets.forEach((t) => u.reply(`UNSELECT TARGET ${t.id}`));
                        ctx.targets.clear();
                        ctx.cards.add(card);
                    }
                ));
                m.addTransition(new FSM.Transition('T', 'UNCARD', 'C', null,
                    (game, ctx) => {
                        ctx.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                        ctx.targets.clear();
                        let card = game.cardByPk(ctx.command.params);
                        ctx.cards.delete(card);
                    }
                ));
                m.addTransition(new FSM.Transition('CT', 'CARD', 'CT',
                    cardValidator,
                    (game, ctx) => {
                        ctx.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                        ctx.targets.clear();
                        let card = game.cardByPk(ctx.command.params);
                        ctx.cards.add(card);
                    }
                ));
                m.addTransition(new FSM.Transition('CT', 'UNCARD',
                    (game, ctx) => {
                        return (ctx.cards.size <= 1) ? 'C' : 'CT';
                    },
                    null,
                    (game, ctx) => {
                        ctx.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                        ctx.targets.clear();
                        let card = game.cardByPk(ctx.command.params);
                        ctx.cards.delete(card);
                    }
                ));
            }
        }

        if (stateO) {
            m.addTransition(new FSM.Transition(stateO.pk, 'CANCEL', '_'));
            m.addTransition(new FSM.Transition(stateO.pk, 'OK', '_', null,
                (game, ctx) => {
                    return new R.CardTargetResult().set(U.toArray(ctx.cards), U.toArray(ctx.targets));
                }
            ));
            m.addTransition(new FSM.Transition('TO', 'TARGET', 'TO',
                targetValidator,
                (game, ctx) => {
                    let target = game.userByPk(ctx.command.params);
                    ctx.targets.add(target);
                }
            ));
            m.addTransition(new FSM.Transition('TO', 'UNTARGET',
                (game, ctx) => {
                    return (ctx.targets.size <= 1) ? stateT.pk : 'TO';
                },
                null,
                (game, ctx) => {
                    let target = game.userByPk(ctx.command.params);
                    ctx.targets.delete(target);
                }
            ));
            if (stateC) {
                m.addTransition(new FSM.Transition('TO', 'CARD',
                    (game, ctx) => {
                        return (stateT.pk === 'CT') ? 'CT' : 'C';
                    },
                    cardValidator,
                    (game, ctx) => {
                        if (cardCount === C.SELECT_TYPE.SINGLE) {
                            ctx.cards.forEach((card) => u.reply(`UNSELECT CARD ${card.pk}`));
                            ctx.cards.clear();
                        }
                        ctx.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                        ctx.targets.clear();
                        let card = game.cardByPk(ctx.command.params);
                        ctx.cards.add(card);
                    }
                ));
                m.addTransition(new FSM.Transition('TO', 'UNCARD',
                    (game, ctx) => {
                        return (stateT.pk === 'CT' && ctx.cards.size > 1) ? 'CT' : 'C';
                    },
                    null,
                    (game, ctx) => {
                        ctx.targets.forEach((target) => u.reply(`UNSELECT TARGET ${target.id}`));
                        ctx.targets.clear();
                        let card = game.cardByPk(ctx.command.params);
                        ctx.cards.delete(card);
                    }
                ));
                m.addTransition(new FSM.Transition('CO', 'CARD', 'CO',
                    cardValidator,
                    (game, ctx) => {
                        let card = game.cardByPk(ctx.command.params);
                        ctx.cards.add(card);
                    }
                ));
                m.addTransition(new FSM.Transition('CO', 'UNCARD',
                    (game, ctx) => {
                        return (ctx.cards.size <= 1) ? 'C' : 'CO';
                    },
                    null,
                    (game, ctx) => {
                        let card = game.cardByPk(ctx.command.params);
                        ctx.cards.delete(card);
                    }
                ));
            }
        }
    }
}

const factory = new MachineFactory();

fsms = {
    get: (name, game, opt = {}) => {
        return factory[name](game, opt);
    },
    requireOkFSM: {
        _init: 'O',
        O: {
            OK: {
                next: '_',
                action: (game, c, r) => {
                    return R.success;
                },
            },
            UNCARD: {
                next: '_',
                action: (game, c, r) => {
                    return R.abort;
                },
            },
            CANCEL: {
                next: '_',
                action: (game, c, r) => {
                    return R.abort;
                },
            },
        },
    },
    SingleCardFSM: {
        _init: 'C',
        C: {
            CARD: {
                next: 'O',
            },
            CANCEL: {
                next: '_',
                action: (game, c, r) => {
                    return R.abort;
                }
            },
        },
        O: {
            UNCARD: {
                next: 'C',
                action: (game, c, r) => {
                    r.set([]);
                    return r;
                }
            },
            OK: {
                next: '_',
                action: (game, c, r) => {
                    let command = r.get();
                    return new R.FsmResult().set(game.cardByPk(command.params));
                }
            },
            CANCEL: {
                next: '_',
                action: (game, c, r) => {
                    return R.abort;
                }
            },
        }
    },
    SingleTargetFSM: {
        _init: 'T',
        T: {
            TARGET: {
                next: 'O',
            },
            CANCEL: {
                next: '_',
                action: (game, c, r) => {
                    return R.abort;
                }
            },
        },
        O: {
            UNTARGET: {
                next: 'T',
                action: (game, c, r) => {
                    r.set(new Set());
                    return r;
                }
            },
            OK: {
                next: '_',
                action: (game, c, r) => {
                    let command = r.get();
                    return new R.FsmResult().set(game.usersByPk(command.params));
                }
            },
            CANCEL: {
                next: '_',
                action: (game, c, r) => {
                    return R.abort;
                }
            },
        }
    },
};

Object.assign(module.exports, fsms);
Object.assign(module.exports, FSM);
