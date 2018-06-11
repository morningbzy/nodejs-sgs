let co = require('co');

const C = require('./constants');
const User = require('./user');
const cmdHandler = require('./cmd');
const cardManager = require('./cards');


class Command {
    constructor(uid, cmd, params) {
        this.uid = uid;
        this.cmd = cmd;
        this.params = params;
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
        this.roundOwner;  //  Whose round it is, now.
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
    }

    validateCmd(command) {
        if (this.waitingStack.length <= 0 || command.cmd === 'JOIN') {
            return {valid: true};
        }
        const waiting = this.waitingStack.pop();
        const validator = waiting.validator;
        if (validator === undefined || validator(command)) {
            return {valid: true, waiting};
        }
        this.waitingStack.push(waiting);
        return {valid: false};
    }

    wait(u, waiting) {
        u.waiting = true;
        this.broadcast(`WAITING ${u.seatNum}`, u);
        return new Promise((res, rej) => {
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
            u.waiting = false;
        }
    }

    broadcast(msg, self, addToResoreCmd = false) {
        for (let k in this.users) {
            let u = this.users[k];
            u.reply(msg, (self && (self.id === u.id)), addToResoreCmd);
        }
    }

    broadcastUserInfo(user) {
        for (let u of this.userRound()) {
            u.reply(`USER_INFO ${user.seatNum} ${user.toJsonString(u)}`, user.id === u.id);
        }
    }

    resendUserInfo(user) {
        for (let _u of this.userRound(user)) {
            user.reply(`USER_INFO ${_u.seatNum} ${_u.toJsonString(user)}`, user.id === _u.id);
        }
    }

    startIfReady() {
        if (this.usersNotInState([C.USER_STATE.READY]).length === 0 &&
            this.usersInState([C.USER_STATE.READY]).length >= 3) {
            this.start();
        }
    }

    usersByPk(pks) {
        return Array.from(pks, (pk) => this.users[pk]);
    }

    usersNotInState(states) {
        return Object.keys(this.users).filter(
            (k) => !states.includes(this.users[k].state)
        );
    }

    usersInState(states) {
        return Object.keys(this.users).filter(
            (k) => states.includes(this.users[k].state)
        );
    }

    userRound(start = this.zhugong, shift = false) {
        const index = this.sortedUsers.indexOf(start);
        let round = this.sortedUsers.slice(index).concat(this.sortedUsers.slice(0, index));
        if (shift) {
            round.shift();
        }
        return round;
    }

    dispatchCards(user, count = 1) {
        let cards = cardManager.shiftCards(count);
        user.addCards(cards);
        this.broadcastUserInfo(user);
    }

    removeUserCards(user, cardPks) {
        let cards = cardManager.getCards(cardPks);
        user.removeCards(cards);
        this.broadcastUserInfo(user);
    }

    discardCards(cardPks) {
        cardManager.useCards(cardPks);
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
setInterval(() => {
    game.broadcast(`HB`);
}, 10000);

module.exports = game;
