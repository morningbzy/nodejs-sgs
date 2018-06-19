let co = require('co');

const C = require('./constants');
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
            u.reply(`MSG Invalid CMD`, true);
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
        let waitingTag = C.WAITING_FOR.SOMETHING;
        if (waiting.waitingTag !== undefined) {
            waitingTag = waiting.waitingTag;
        } else {
            for (let k of Object.keys(C.WAITING_FOR)) {
                if (waiting.validCmds.includes(k)) {
                    waitingTag = C.WAITING_FOR[k];
                    break;
                }
            }
        }
        u.waiting = waitingTag;
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
            this.usersInState(C.USER_STATE.READY).length >= 3) {
            this.start();
        }
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
            this.discardCards([old.card]);
        }

        for (let j of user.judgeStack) {
            this.discardCard(j.card);
        }

        if (this.usersNotInState(C.USER_STATE.DEAD).length <= 1) {
            this.state = C.GAME_STATE.ENDING;
        }
    }

    // ----- Card related

    dispatchCards(user, count = 1) {
        let cards = cardManager.shiftCards(count);
        user.addCards(cards);
        this.broadcastUserInfo(user);
    }

    addUserCards(user, cards) {
        user.addCards(cardManager.unfakeCards(cards));
        this.broadcastUserInfo(user);
    }

    lockUserCardPks(user, cardPks) {
        user.reply(`LOCK_CARD ${cardPks.join(' ')}`, true, true);
    }

    lockUserCards(user, cards) {
        this.lockUserCardPks(user, cardManager.unfakeCards(cards).map(x => x.pk));
    }

    unlockUserCardPks(user, cardPks) {
        user.reply(`UNLOCK_CARD ${cardPks.join(' ')}`);
        user.popRestoreCmd();
    }

    unlockUserCards(user, cards) {
        this.unlockUserCardPks(user, cardManager.unfakeCards(cards).map(x => x.pk));
    }

    removeUserCardPks(user, cardPks) {
        user.removeCardPks(cardPks);
        this.broadcastUserInfo(user);
    }

    removeUserCards(user, cards) {
        this.removeUserCardPks(user, cardManager.unfakeCards(cards).map(x => x.pk));
    }

    equipUserCard(user, card) {
        let old = this.unequipUserCard(user, card.equipType);
        if(old) {
            this.discardCards([old.card]);
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
