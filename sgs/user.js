const C = require('./constants');
const cardManager = require('./cards');
const sgsCards = require('./cards/cards');


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
        this.cards = new Set();  // [];
        this.equipments = {
            weapon: null,
            armor: null,
            attackHorse: null,
            defenseHorse: null,
        };
        this.restoreCmds = [];

        this.setResp(messageResp);
    }

    toJson(u) {
        let cards = [];
        (u.id === this.id) && this.cards.forEach((c) => {
            cards.push(c.toJsonString());
        });

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

            cardCount: this.cards.size,
            cards,
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
        for (let card of cards) {
            this.cards.add(card);
        }
    }

    removeCards(cards) {
        for (let card of cards) {
            this.cards.delete(card);
        }
    }

    * on(event, game, si) {
        console.log(`ON ${event}`);
        if (typeof(this[event]) === 'function') {
            return yield this[event](game, si);
        }
    }

    * damage(game, si) {
        console.log(`OH NO ${si.damage}`);
        this.hp -= si.damage;
        game.broadcastUserInfo(this);
        if (this.hp === 0) {
            this.state = C.USER_STATE.DYING;
            // TODO game.userDying();
            return yield this.on('die', game, si);
        }
    }

    * die(game, si) {
        this.state = C.USER_STATE.DEAD;
    }

    * requireShan(game, si) {
        let shan = yield this.figure.on('requireShan', game, si);
        if (!shan && this.equipments.armor) {
            shan = yield this.equipments.armor.on('requireShan', game, si);
        }
        if (!shan) {
            let command = yield game.wait(this, {
                validator: (command) => {
                    if (command.uid !== this.id || !['CANCEL', 'PLAY_CARD'].includes(command.cmd)) {
                        return false;
                    }

                    if (command.cmd === 'CANCEL') {
                        return true
                    }

                    let card = cardManager.getCards(command.params)[0];
                    if (card instanceof sgsCards.Shan) {
                        return true;
                    }
                    return false;
                },
            });

            if (command.cmd === 'CANCEL') {
                shan = false;
            } else {
                game.removeUserCards(this, command.params);
                shan = true;
            }
        }
        return yield Promise.resolve(shan);
    }
};
