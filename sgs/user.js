const C = require('./constants');


module.exports = class {
    constructor(sessionId, messageResp) {
        this.id = sessionId;
        this.state = C.USER_STATE.CREATED;

        this.name = '';
        this.resp = null;
        this.seatNum = null;
        this.role = null;
        this.figure = null;
        this.hp = 0;
        this.waiting = false;
        this.faceUp = true;

        this.showFigure = false;
        this.cards = [];
        this.restoreCmds = [];

        this.setResp(messageResp);
    }

    toJson(u) {
        return {
            id: this.id,
            name: this.name,
            seatNum: this.seatNum,

            state: this.state,
            waiting: this.waiting,

            role: (u.id === this.id || this.role === C.ROLE.ZHUGONG || this.state === C.USER_STATE.DEAD) ? this.role : '?',
            figure: ((u.id === this.id || this.showFigure) && this.figure) ? this.figure.toJson() : null,
            hp: this.showFigure ? this.hp : 0,
            faceUp: this.faceUp,

            cardCount: this.cards.length,
            cards: (u.id === this.id) ? this.cards.map((c) => c.toJsonString()) : [],
        };
    }

    toJsonString(u) {
        return JSON.stringify(this.toJson(u));
    }

    setResp(resp) {
        if (this.resp) {
            this.resp.end('data: *DISCONNECTED\n\n');
        }
        this.resp = resp;
        this.reply(`CONNECTED ${this.id}`, true);
    }

    reply(data, selfMarker = true, addToResoreCmd = false) {
        if (data != 'HB') console.log(`| <- ${data}`);
        this.resp.write("data: " + (selfMarker ? '*' : '-') + data + "\n\n");
        if (addToResoreCmd) {
            this.pushRestoreCmd({
                data,
                selfMarker,
            });
        }
    }

    pushRestoreCmd(cmd) {
        this.restoreCmds.push(cmd);
    }

    popRestoreCmd(cmd) {
        this.restoreCmds.pop();
    }

    restore() {
        for (let cmd of this.restoreCmds) {
            this.reply(cmd.data, cmd.selfMarker);
        }
    }

    setFigure(figure) {
        this.figure = figure;
        this.hp = figure.hp;
    }

    addCards(cards) {
        this.cards.push(...cards);
        for (let card of cards) {
            this.reply(`CARD ${card.toJsonString()}`);
        }
    }
};
