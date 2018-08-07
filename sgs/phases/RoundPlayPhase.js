const C = require('../constants');
const R = require('../common/results');
const U = require('../utils');
const FSM = require('../common/fsm');
const Phase = require('./phase');
const {PhaseContext, PlayContext, CardContext, SkillContext} = require('../context');


class RoundPlayPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        const u = game.roundOwner;  // 当前回合玩家
        const phaseCtx = new PhaseContext(game);
        let pass = false;  // 结束出牌

        yield u.on('roundPlayPhaseStart', game, phaseCtx);

        while (!pass && u.state !== C.USER_STATE.DEAD && game.state !== C.GAME_STATE.ENDING) {
            u.reply('UNSELECT ALL');

            // 一次出牌结算开始
            const pCtx = new PlayContext(game, {sourceUser: u}).linkParent(phaseCtx);

            yield u.on('play', game, pCtx);

            const requirePlay = (game, parentCtx) => {
                let m = new FSM.Machine(game, parentCtx);
                m.addState(new FSM.State('CSP'), true);
                m.addState(new FSM.State('IC', function* (info) {
                    const {game, sourceUser: u, card} = info;
                    let nextCmd, nextParams = [];
                    let result = yield card.init(game, info.parentCtx);
                    if (result.success && result instanceof R.CardTargetResult) {
                        nextCmd = 'OK';
                        info.card = result.get().card;
                        info.targets = U.toArray(result.get().target);
                    } else if (result.abort && result instanceof R.CardResult) {
                        nextCmd = 'CARD';
                        nextParams = U.toArray(result.get().pk);
                    } else {
                        u.reply('UNSELECT ALL');
                        nextCmd = 'CANCEL';
                    }
                    // TODO change to Command
                    return {uid: u.id, cmd: nextCmd, params: nextParams};
                }));
                m.addState(new FSM.State('EC', function* (info) {
                    const {game, sourceUser: u, card, targets} = info;
                    u.reply('UNSELECT ALL');

                    if (card.faked) {
                        console.log(`|[i] Use card [${Array.from(card.originCards, c => c.name).join(', ')}] as [${card.name}]`);
                    } else {
                        console.log(`|[i] Use card [${card.name}]`);
                    }

                    let cardCtx = new CardContext(game, card, {
                        sourceUser: u,
                        targets
                    }).linkParent(info.parentCtx);
                    // TODO fire '?Target' events
                    // on shaTarget, beShaTarget, afterShaTarget, afterBeShaTarget ...
                    yield game.removeUserCards(u, card);
                    cardCtx.handlingCards.add(card);
                    yield card.start(game, cardCtx);

                    return {uid: u.id, cmd: 'OK', params: []};
                }));
                m.addState(new FSM.State('IS', function* (info) {
                    const {game, sourceUser: u, skill} = info;
                    let nextCmd, nextParams = [];
                    let result = yield skill.init(game, info.parentCtx);
                    if (result.success && result instanceof R.CardTargetResult) {
                        nextCmd = 'OK';
                        info.skill = skill;
                        info.cards = U.toArray(result.get().card);
                        info.targets = U.toArray(result.get().target);
                    } else {
                        u.reply('UNSELECT ALL');
                        nextCmd = 'CANCEL';
                    }
                    // TODO change to Command
                    return {uid: u.id, cmd: nextCmd, params: nextParams};
                }));
                m.addState(new FSM.State('ES', function* (info) {
                    const {game, skill, cards, sourceUser: u, targets} = info;
                    let nextCmd, nextParams = [];

                    u.reply('UNSELECT ALL');
                    let skillCtx = new SkillContext(game, skill, {
                        cards,
                        targets
                    }).linkParent(info.parentCtx);

                    // TODO fire '?Target' events
                    // on shaTarget, beShaTarget, afterShaTarget, afterBeShaTarget ...
                    let result = yield u.figure.useSkill(skill, game, skillCtx);
                    if (result.success) {
                        if (result instanceof R.CardResult) {
                            nextCmd = 'CARD';
                            info.card = result.get();
                        } else if (result instanceof R.CardTargetResult) {
                            nextCmd = 'EXE_CARD';
                            info.card = U.toSingle(result.get().card);
                            info.targets = U.toArray(result.get().target);
                        } else {
                            nextCmd = 'OK';
                        }
                    } else {
                        nextCmd = 'CANCEL';
                    }
                    return {uid: u.id, cmd: nextCmd, params: nextParams};
                }));

                m.addTransition(new FSM.Transition('CSP', 'CARD', 'IC',
                    FSM.BASIC_VALIDATORS.ownCardValidator,
                    FSM.BASIC_ACTIONS.cardToContext
                ));
                m.addTransition(new FSM.Transition('CSP', 'SKILL', 'IS',
                    FSM.BASIC_VALIDATORS.enabledSkillValidator,
                    FSM.BASIC_ACTIONS.skillToContext
                ));
                m.addTransition(new FSM.Transition('CSP', 'PASS', '_', null,
                    (game, info) => {
                        info.result = R.abort;
                    }
                ));

                m.addTransition(new FSM.Transition('IC', 'CARD', 'IC',
                    FSM.BASIC_VALIDATORS.ownCardValidator,
                    FSM.BASIC_ACTIONS.cardToContext
                ));
                m.addTransition(new FSM.Transition('IC', 'OK', 'EC'));
                m.addTransition(new FSM.Transition('IC', 'CANCEL', 'CSP'));

                m.addTransition(new FSM.Transition('EC', 'OK', '_'));

                m.addTransition(new FSM.Transition('IS', 'OK', 'ES'));
                m.addTransition(new FSM.Transition('IS', 'CANCEL', 'CSP'));

                m.addTransition(new FSM.Transition('ES', 'CARD', 'IC'));
                m.addTransition(new FSM.Transition('ES', 'EXE_CARD', 'EC'));
                m.addTransition(new FSM.Transition('ES', 'OK', '_'));
                m.addTransition(new FSM.Transition('ES', 'CANCEL', 'CSP'));

                return m;
            };

            let result = yield game.waitFSM(u, requirePlay(game, pCtx), pCtx);
            u.reply('UNSELECT ALL');

            if (result.abort) {
                pass = true;
            } else {

            }

            // 结算完毕
            game.discardCards(pCtx.allHandlingCards());
        }

        yield u.on('roundPlayPhaseEnd', game, phaseCtx);
        game.discardCards(phaseCtx.allHandlingCards());
    }
}

RoundPlayPhase.name = 'RoundPlayPhase';
module.exports = RoundPlayPhase;
