let co = require('co');

const C = require('./constants');
const R = require('./common/results');
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

        this.zhugong;  // User
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
            u.reply(`TOAST 操作无效`, true);
            console.log(`|<!> invalid command!`);
            console.log(`+--------------------`);
            console.log(``);
            return;
        }

        const handler = cmdHandler[cmd.toLowerCase()];
        if (typeof(handler) === 'function') {
            handler(this, u, params);
        } else {
            console.log(`|<!> No command handler is found!`);
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
                console.log(`|<!> Waiting: validator failed!`);
            }
        } else {
            console.log(`|<!> Waiting: [${waiting.u.seatNum}]${waiting.u.name} - ${waiting.validCmds}!`);
        }
        this.waitingStack.push(waiting);
        return {valid: false};
    }

    wait(u, waiting) {
        let waitingTag = C.WAITING_FOR.NOTHING;
        for (let k of waiting.validCmds) {
            waitingTag += C.WAITING_FOR[k] || 0;
        }
        console.log(`|[i] Waiting for CMD: ${waiting.validCmds} @ ${waitingTag}`);
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

    waitConfirm(u, text) {
        u.reply(`CONFIRM ${text}`, true, true);
        return this.wait(u, {
            validCmds: ['Y', 'N'],
            waitingTag: C.WAITING_FOR.CONFIRM,
            value: (command) => {
                u.popRestoreCmd();
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
        let game = this;
        fsm.start();
        while (!fsm.done) {
            let state = fsm.current;
            console.log(`|= * ${state.pk}`);
            let validCmds = state.getValidCmds();
            console.log(`|= * Wating ${validCmds}`);
            let command;

            if (state.subMachine) {
                console.log(`|= _SUB`);
                let result = yield state.subMachine(game, ctx, fsm.context);
                console.log(result.nextCmd);
                command = new Command(u.pk, result.command, []);
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

        u.reply('UNSELECT ALL');
        console.log(`|=F= FSM Done: ${fsm.result.get()}`);
        return fsm.result;
    }

    * waitFSM__old(u, fsm, ctx) {  // Finite state machine
        console.log(`|=F= FSM Start`);
        let game = this;
        let cs = fsm._init;  // Current state
        let fsmResult = new R.FsmResult();
        while (cs !== '_') {
            console.log(`|= * ${cs}`);
            let state = fsm[cs];
            let validCmds = Object.keys(state);
            let nextCmd = null;

            if (state._SUB) {
                console.log(`|= _SUB`);
                let result = yield state._SUB(game, ctx, fsmResult);
                nextCmd = result.nextCmd;
                console.log(`|= _SUB < ${nextCmd}`);

                if (result.result.success) {
                    fsmResult.set(result.result.get());
                    console.log(`|= _SUB < ${result.result.constructor.name}`);
                }
            } else {
                console.log(`|= command`);
                let command = yield this.wait(u, {
                    validCmds: validCmds,
                    validator: (command) => {
                        return state[command.cmd].validator ? state[command.cmd].validator(command) : true;
                    },
                });
                nextCmd = command.cmd;
                console.log(`|= command < ${nextCmd}`);

                if (state[nextCmd].action) {
                    fsmResult = state[nextCmd].action(game, command, fsmResult);
                } else {
                    fsmResult.set(command);
                }

                if (fsmResult.success) {
                    console.log(`|= command < ${fsmResult.get().toString()}`);
                }
            }
            cs = state[nextCmd].next;
        }

        u.reply('UNSELECT ALL');
        console.log(`|=F= FSM Done: ${fsmResult.success}`);
        return yield Promise.resolve(fsmResult);
    }

    broadcast(msg, self, addToResoreCmd = false) {
        for (let k in this.users) {
            let u = this.users[k];
            u.reply(msg, (self && (self.id === u.id)), addToResoreCmd);
        }
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
            this.usersInState(C.USER_STATE.READY).length >= 5) {
            this.start();
        }
    }

    cardByPk(pk) {
        return cardManager.getCard(pk);
    }

    cardsByPk(pks) {
        return new Set(cardManager.getCards(pks));
    }

    userByPk(pk) {
        return this.users[Array.isArray(pk) ? pk[0] : pk];
    }

    usersByPk(pks) {
        return new Set(Array.from(pks, (pk) => this.users[pk]));
    }

    usersNotInState(states) {
        states = Array.isArray(states) ? states : [states];
        return Object.keys(this.users).filter(
            (k) => !states.includes(this.users[k].state)
        );
    }

    usersInState(states) {
        states = Array.isArray(states) ? states : [states];
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

    userDead(user) {
        let cardPks = user.cards.keys();
        this.removeUserCardPks(user, cardPks);
        this.discardCardPks(cardPks);

        for (let k in C.EQUIP_TYPE) {
            let old = this.unequipUserCard(user, C.EQUIP_TYPE[k]);
            if (old) {
                this.discardCards(old);
            }
        }

        for (let j of user.judgeStack) {
            this.discardCards(j.card);
        }

        if (this.usersNotInState(C.USER_STATE.DEAD).length <= 1) {
            this.state = C.GAME_STATE.ENDING;
        }
    }

    // ----- Utils
    distanceOf(from, to, ctx = {}) {
        let t, i = 0;
        for (let u of this.userRound(from)) {
            if (u.id === to.id) {
                t = i;
            }
            i++;
        }
        let exFrom = from.distanceFrom(this, ctx);
        let exTo = to.distanceTo(this, ctx);
        // console.log(t);
        // console.log(i);
        // console.log(exFrom);
        // console.log(exTo);
        console.log(`|>>${Math.min(t, i - t) + exFrom + exTo}<<`);
        return Math.min(t, i - t) + exFrom + exTo;
    }

    userAttackRange(u, ctx) {
        console.log(`|<<${u.attackRange(this, ctx)}>>`);
        return u.attackRange(this, ctx);
    }

    inAttackRange(from, to, ctx = {}) {
        return this.userAttackRange(from) >= this.distanceOf(from, to, ctx);
    }

    // ----- Card related

    dispatchCards(user, count = 1) {
        let cards = cardManager.shiftCards(count);
        user.addCards(cards);
        this.broadcastUserInfo(user);
    }

    addUserCards(user, cards) {
        cards = Array.isArray(cards) ? cards : Array.from([cards]);
        user.addCards(cardManager.unfakeCards(cards));
        this.broadcastUserInfo(user);
    }

    lockUserCardPks(user, cardPks) {
        // user.reply(`LOCK_CARD ${cardPks.join(' ')}`, true, true);
    }

    lockUserCards(user, cards) {
        cards = Array.isArray(cards) ? cards : Array.from([cards]);
        this.lockUserCardPks(user, cardManager.unfakeCards(cards).map(x => x.pk));
    }

    unlockUserCardPks(user, cardPks) {
        // user.reply(`UNLOCK_CARD ${cardPks.join(' ')}`);
        // user.popRestoreCmd();
    }

    unlockUserCards(user, cards) {
        cards = Array.isArray(cards) ? cards : Array.from([cards]);
        this.unlockUserCardPks(user, cardManager.unfakeCards(cards).map(x => x.pk));
    }

    removeUserCardPks(user, cardPks) {
        user.removeCardPks(cardPks);
        this.broadcastUserInfo(user);
    }

    removeUserCards(user, cards) {
        cards = Array.isArray(cards) ? cards : [cards];
        this.removeUserCardPks(user, cardManager.unfakeCards(cards).map(x => x.pk));
    }

    equipUserCard(user, card) {
        let old = this.unequipUserCard(user, card.equipType);
        if (old) {
            this.discardCards(old.card);
        }

        this.removeUserCards(user, [card]);
        user.equipCard(card);
        this.message([user, '装备了', card]);
        this.broadcastUserInfo(user);
    }

    unequipUserCard(user, equipType) {
        let old = user.unequipCard(equipType);
        if (old) {
            this.message([user, '失去了装备', old]);
            this.broadcastUserInfo(user);
            return old;
        }
    }

    discardCardPks(cardPks) {
        cardManager.useCards(cardPks);
    }

    discardCards(cards) {
        cards = Array.isArray(cards) ? cards : [cards];
        this.discardCardPks(cardManager.unfakeCards(cards).map(x => x.pk));
    }

    // ----- Judgement related
    pushUserJudge(user, judgeCard) {
        user.pushJudge(judgeCard);
    }

    getJudgeCard() {
        return cardManager.shiftCards()[0];
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
}, 10000);

module.exports = game;
