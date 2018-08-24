let co = require('co');

const C = require('./constants');
const R = require('./common/results');
const U = require('./utils');
const {SimpleContext, JudgeContext} = require('./context');
const User = require('./user');
const cmdHandler = require('./cmd');
const cardManager = require('./cards');
const {buildMessage} = require('./common/message');


class Command {
    constructor(uid, cmd, params) {
        this.uid = uid;
        this.cmd = cmd;
        this.params = params.filter(p => p !== '');
    }
}


class Game {
    constructor() {
        this.state = C.GAME_STATE.PREPARING;
        this.phase = '';
        this.seat = 0;
        this.users = {};  // User.id: User
        this.sortedUsers = [];  // List of User, sorted by seatNum
        this.waitingStack = [];
        this.lastPopupMsg = null;

        this.zhugong = null;  // User
        this.roundOwner = null;  //  Whose round it is, now.

        this.cardManager = cardManager;
    }

    newSession(req, res) {
        console.log(`+----- [-]--- -----`);
        console.log(`| CMD: NEWSESSION`);
        const uid = req.session.id;
        if (uid in this.users) {
            this.users[uid].setResp(res);
        } else {
            this.users[uid] = new User(uid, res);
        }
        console.log(`+------------------`);
    }

    executeCmd(uid, cmd, ...params) {
        let u = this.users[uid];
        console.log(`+----- [${u.seatNum === null ? '?' : u.seatNum}] ${u.name || uid} -----`);
        console.log(`| CMD: ${cmd}`);
        console.log(`| Params: ${params}`);

        let command = new Command(uid, cmd, params);
        const result = this.validateCmd(command);

        if (!result.valid) {
            u.reply(`TOAST danger 操作无效`, true);
            console.log(`|[i] invalid command!`);
            console.log(`+--------------------`);
            console.log(``);
            return;
        }

        const handler = cmdHandler[cmd.toLowerCase()];
        if (typeof(handler) === 'function') {
            handler(this, u, params);
        } else {
            console.warn(`|<!> No command handler for '${cmd}'!`);
        }

        console.log(`+ - - - - - - - - - -`);
        this.unwait(u, result.waiting, command);
        console.log(`+--------------------`);
        console.log(``);
    }

    validateCmd(command) {
        if (this.waitingStack.length <= 0 || command.cmd === 'JOIN') {
            return {valid: true};
        }
        const waiting = this.waitingStack.pop();
        if (waiting.u.id === command.uid && waiting.validCmds.includes(command.cmd)) {
            const validator = waiting.validator;
            if (validator === undefined || validator(command)) {
                return {valid: true, waiting};
            } else {
                console.log(`|[i] Waiting: validator failed!`);
            }
        } else {
            console.log(`|[!] Waiting: [${waiting.u.seatNum}]${waiting.u.name} - ${waiting.validCmds}!`);
        }
        this.waitingStack.push(waiting);
        return {valid: false};
    }

    wait(u, waiting) {
        let waitingTag = C.WAITING_FOR.NOTHING;
        for (let k of waiting.validCmds) {
            if (C.WAITING_FOR[k] === undefined) {
                console.warn(`|<!> Missing C.WAITING_FOR.${k}`);
            }
            waitingTag += C.WAITING_FOR[k] || 0;
        }
        console.log(`|[i] Waiting for ${u.figure ? u.figure.name : u.name} @ ${u.seatNum}, CMD: ${waiting.validCmds} @ ${waitingTag}`);
        u.waiting = {waitingTag};
        this.broadcast(`WAITING ${u.seatNum} ${waitingTag}`, u);
        return new Promise((res, rej) => {
            waiting.u = u;
            waiting.resolve = res;
            waiting.reject = rej;
            this.waitingStack.push(waiting);
        });
    }

    unwait(u, waiting, command) {
        if (waiting && typeof(waiting.resolve) === 'function') {
            if (typeof(waiting.value) === 'function') {
                waiting.resolve(waiting.value(command));
            }
            waiting.resolve(command);
        }
        if (u && waiting) {
            this.broadcast(`UNWAITING ${u.seatNum}`, u);
            u.waiting = C.WAITING_FOR.NOTHING;
        }
    }

    waitConfirm(u, text, timeout = 10000, defaultCmd = 'N') {
        u.reply(`CONFIRM ${timeout} ${defaultCmd} ${text}`, true, true);
        return this.wait(u, {
            validCmds: ['Y', 'N'],
            waitingTag: C.WAITING_FOR.CONFIRM,
            value: (command) => {
                u.popRestoreCmd('CONFIRM');
                return command;
            }
        });
    }

    waitChoice(u, text, choices) {
        u.reply(`CHOICE_CANDIDATE ${text} ${choices.join(' ')}`, true, true);
        return this.wait(u, {
            validCmds: ['CHOICE',],
            waitingTag: C.WAITING_FOR.CHOICE,
            value: (command) => {
                u.popRestoreCmd('CHOICE_CANDIDATE');
                return command;
            }
        });
    }

    waitOk(u) {
        return this.wait(u, {
            validCmds: ['OK', 'CANCEL'],
            waitingTag: C.WAITING_FOR.OK,
            value: (command) => {
                return command.cmd === 'OK';
            }
        });
    }

    * waitFSM(u, fsm, ctx) {
        console.log(`|=F= FSM Start`);
        fsm.setInfo({sourceUser: u});
        fsm.start();
        while (!fsm.done) {
            let state = fsm.currentState;
            console.log(`|= * State -> ${state.pk}`);
            let validCmds = fsm.getValidCmds();
            console.log(`|= * Wating ${validCmds}`);
            let command;

            if (state.subMachine) {
                console.log(`|= = SUB FSM`);
                let result = yield fsm.intoSub(state);
                command = new Command(result.uid, result.cmd, U.toArray(result.params));
                if (!fsm.validate(command)) {
                    console.log(`|= SUB FSM return an invalid command < ${command.cmd}`);
                }
            } else {
                command = yield this.wait(u, {
                    validCmds: validCmds,
                    validator: (command) => {
                        return fsm.validate(command);
                    },
                });
            }
            console.log(`|= command < ${command.cmd}`);
            fsm.next(command);
        }
        console.log(`|=F= FSM Done: ${fsm.result}`);
        return fsm.result;
    }

    broadcast(msg, self, addToResoreCmd = false) {
        for (let k in this.users) {
            let u = this.users[k];
            u.reply(msg, (self && (self.id === u.id)), addToResoreCmd);
        }
    }

    broadcastPopup(msg, self) {
        this.lastPopupMsg = {msg, self};
        this.broadcast(`POPUP ${msg}`, self);
    }

    broadcastClearPopup(self) {
        this.lastPopupMsg = null;
        this.broadcast('CLEAR_POPUP', self);
    }

    broadcastUserInfo(user) {
        for (let k in this.users) {
            let u = this.users[k];
            u.reply(`USER_INFO ${user.seatNum} ${user.toJsonString(u)}`, user.id === u.id);
        }
    }

    message(elements) {
        this.broadcast(`MSG ${buildMessage(elements)}`);
    }

    resendUserInfo(user) {
        // Send ALL user info to one user, especially for the user's reconnecting
        for (let k in this.users) {
            let u = this.users[k];
            user.reply(`USER_INFO ${u.seatNum} ${u.toJsonString(user)}`, user.id === u.id);
        }
    }

    startIfReady() {
        if (this.usersNotInState(C.USER_STATE.READY).length === 0 &&
            this.usersInState(C.USER_STATE.READY).length >= 3) {
            this.start();
        }
    }

    cardByPk(pk) {
        return this.cardManager.getCard(Array.isArray(pk) ? pk[0] : pk);
    }

    cardsByPk(pks) {
        return new Set(this.cardManager.getCards(pks));
    }

    userByPk(pk) {
        return this.users[Array.isArray(pk) ? pk[0] : pk];
    }

    usersByPk(pks) {
        return new Set(Array.from(pks, (pk) => this.users[pk]));
    }

    usersNotInState(states) {
        states = U.toArray(states);
        return Object.keys(this.users).filter(
            (k) => !states.includes(this.users[k].state)
        );
    }

    usersInState(states) {
        states = U.toArray(states);
        return Object.keys(this.users).filter(
            (k) => states.includes(this.users[k].state)
        );
    }

    userRound(start = this.roundOwner, shift = false, filterUndead = true) {
        start = start ? start : this.zhugong;
        const index = this.sortedUsers.indexOf(start ? start : this.zhugong);
        let round = this.sortedUsers.slice(index).concat(this.sortedUsers.slice(0, index));
        if (shift) {
            round.shift();
        }
        if (filterUndead) {
            round = round.filter(u => {
                return ![C.USER_STATE.DEAD].includes(u.state);
            });
        }
        return round;
    }

    initRound(user) {
        this.roundOwner = user;
        user.roundOwner = true;
        this.message([user, '的回合开始']);
        this.broadcastUserInfo(user);
        for (let k of Object.keys(user.phases)) {
            user.phases[k] = 1;
        }
    }

    uninitRound(user) {
        user.roundOwner = false;
        this.message([user, '的回合结束']);
        this.broadcastUserInfo(user);
    }

    * changeUserProperty(user, property, value) {
        user[property] = value;
        game.broadcastUserInfo(user);
    }

    * userDead(user) {
        let cards = user.cards.values();
        yield this.removeUserCards(user, cards, true);

        this.discardCards(user.markers);
        user.markers = [];

        for (let k in C.EQUIP_TYPE) {
            let old = yield this.unequipUserCard(user, C.EQUIP_TYPE[k]);
            if (old) {
                this.discardCards(old);
            }
        }

        for (let card of user.judgeStack) {
            yield this.removeUserJudge(user, card, true);
        }

        if (this.usersNotInState(C.USER_STATE.DEAD).length <= 1) {
            this.state = C.GAME_STATE.ENDING;
        }

        game.broadcastUserInfo(user);
    }

    // -----
    addUserStatus(user, status) {
        user.addStatus(status);
        game.broadcastUserInfo(user);
    }

    removeUserStatus(user, status) {
        user.removeStatus(status);
        game.broadcastUserInfo(user);
    }

    toggleUserStatus(user, status) {
        user.toggleStatus(status);
        game.broadcastUserInfo(user);
    }


    // ----- Utils
    distanceOf(from, to, ctx, info = {}) {
        let t, i = 0;
        for (let u of this.userRound(from)) {
            if (u.id === to.id) {
                t = i;
            }
            i++;
        }
        let exFrom = from.distanceFrom(this, ctx, info);
        let exTo = to.distanceTo(this, ctx, info);
        console.log(`|[R] Distance: ${Math.min(t, i - t) + exFrom + exTo}<<`);
        return Math.min(t, i - t) + exFrom + exTo;
    }

    userAttackRange(u, ctx, info) {
        console.log(`|[R] AttackRange: ${u.attackRange(this, ctx, info)}>>`);
        return u.attackRange(this, ctx, info);
    }

    inAttackRange(from, to, ctx, info = {}) {
        return this.userAttackRange(from, ctx, info) >= this.distanceOf(from, to, ctx, info);
    }

    // ----- Card related

    dispatchCards(user, count = 1) {
        let cards = this.cardManager.shiftCards(count);
        user.addCards(cards);
        this.broadcastUserInfo(user);
    }

    addUserCards(user, cards) {
        cards = U.toArray(cards);
        user.addCards(this.cardManager.unfakeCards(cards));
        this.cardManager.destroyFakeCards(cards);
        this.broadcastUserInfo(user);
    }

    lockUserCardPks(user, cardPks) {
        // user.reply(`LOCK_CARD ${cardPks.join(' ')}`, true, true);
    }

    lockUserCards(user, cards) {
        // cards = Array.isArray(cards) ? cards : Array.from([cards]);
        // this.lockUserCardPks(user, this.cardManager.unfakeCards(cards).map(x => x.pk));
    }

    unlockUserCardPks(user, cardPks) {
        // user.reply(`UNLOCK_CARD ${cardPks.join(' ')}`);
        // user.popRestoreCmd();
    }

    unlockUserCards(user, cards) {
        // cards = Array.isArray(cards) ? cards : Array.from([cards]);
        // this.unlockUserCardPks(user, this.cardManager.unfakeCards(cards).map(x => x.pk));
    }

    * removeUserHandCards(user, cards, discard = false) {
        cards = U.toArray(cards);
        user.removeCardPks(this.cardManager.unfakeCards(cards).map(x => x.pk));
        if (discard) {
            this.discardCards(cards);
        }
        this.broadcastUserInfo(user);
    }

    * removeUserCards(user, cards, discard = false) {
        cards = U.toArray(cards);
        for (let card of new Set([...cards, ...this.cardManager.unfakeCards(cards)])) {
            if (user.hasJudgeCard(card)) {
                yield this.removeUserJudge(user, card, discard);
            } else if (user.hasEquipedCard(card)) {
                yield this.unequipUserCard(user, card.equipType, discard);
            } else {
                yield this.removeUserHandCards(user, card, discard);
            }
        }
    }

    * equipUserCard(user, card) {
        yield this.unequipUserCard(user, card.equipType, true);
        user.equipCard(card);
        this.message([user, '装备了', card]);
        this.broadcastUserInfo(user);
    }

    * unequipUserCard(user, equipType, discard = false) {
        let oldCard = user.getEquipCard(equipType);
        if (oldCard) {
            user.unequipCard(equipType);
            if (user.state === C.USER_STATE.ALIVE) {
                let ctx = new SimpleContext(this, {
                    sourceUser: user,
                    equipCard: oldCard,
                });
                yield user.on('unequip', game, ctx);
            }
            this.broadcastUserInfo(user);
            if (discard) {
                this.discardCards(oldCard);
            }
            return yield Promise.resolve(oldCard);
        }
    }

    * pushUserMarker(user, card) {
        user.pushMarker(card);
        this.broadcastUserInfo(user);
    }

    * removeUserMarker(user, card) {
        user.removeMarker(card);
        this.broadcastUserInfo(user);
    }

    discardCards(cards) {
        this.cardManager.discardCards(cards);
    }

    // ----- Judgement related
    pushUserJudge(user, card) {
        user.pushJudge(card);
        this.broadcastUserInfo(user);
    }

    getJudgeCard() {
        return this.cardManager.shiftCards()[0];
    }

    * removeUserJudge(user, card, discard = false) {
        user.removeJudge(card);
        if (discard) {
            this.discardCards(card);
        }
        this.broadcastUserInfo(user);
    }

    * doJudge(u, judgeFunction) {
        let judgeCard = this.getJudgeCard();

        let context = new JudgeContext(game, {judgeCard});
        context.handlingCards.add(judgeCard);

        game.broadcastPopup(`JUDGE ${judgeCard.toJsonString()}`, u);
        game.message(['判定牌为', context.i.judgeCard]);

        for (let _u of game.userRound()) {
            yield _u.on('beforeJudgeEffect', game, context);
        }

        yield u.on('judge', game, context);  // 目前仅用于小乔的【红颜】
        game.discardCards(context.allHandlingCards());
        game.broadcastClearPopup(u);

        return R.judge(context.i.judgeCard, judgeFunction(context.i.judgeCard));
    }

    // -----

    phases() {
        const game = this;
        return function* gen() {
            const phases = [
                'GameStartPhase',
                'ChooseFigurePhase',
                'InitCardsPhase',
                'RoundsPhase',
            ];

            for (let phaseClass of phases) {
                let p = require(`./phases/${phaseClass}`);
                yield p.start(game);
            }

            return;
        };
    };

    start() {
        return co(this.phases()).catch((a, b) => {
            console.log(a, b);
        });
    }
}

const game = new Game();

// Heartbeat every 10s to keep connection alive
setInterval(() => {
    game.broadcast(`HB`);
}, 30000);

module.exports = game;
