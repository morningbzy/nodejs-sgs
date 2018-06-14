const C = require('./constants');
const R = require('./common/results');
const cardManager = require('./cards');
const sgsCards = require('./cards/cards');
const EventListener = require('./common/eventListener');


module.exports = class extends EventListener {
    constructor(sessionId, messageResp) {
        super();
        this.id = sessionId;
        this.state = C.USER_STATE.CREATED;

        this.name = '';
        this.resp = null;
        this.seatNum = null;
        this.role = null;
        this.figure = null;
        this.hp = 0;
        this.maxHp = 0;
        this.waiting = C.WAITING_FOR.NOTHING;
        this.faceUp = true;

        this.showFigure = false;
        this.cards = new Map();  // [];
        this.equipments = {
            weapon: null,
            armor: null,
            attackHorse: null,
            defenseHorse: null,
        };
        this.restoreCmds = [];

        this.shaCount = 1;
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
            maxHp: this.showFigure ? this.maxHp : 0,
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
        figure.owner = this;
        this.hp = figure.hp;
        this.maxHp = figure.hp;
    }

    addCards(cards) {
        for (let card of cards) {
            this.cards.set(card.pk, card);
        }
    }

    removeCardPks(cardPks) {
        for (let pk of cardPks) {
            this.cards.delete(pk);
        }
    }

    hasCard(card) {
        return this.cards.has(card.pk);
    }

    hasCardPk(cardPk) {
        return this.cards.has(cardPk);
    }

    * on(event, game, ctx = {}) {
        console.log(`|<U> ON ${this.name}(${this.figure.name}) ${event}`);
        return yield super.on(event, game, ctx);
    }

    * play(game, ctx) {
        let result = yield this.figure.on('play', game, ctx);
        if (!result && this.equipments.armor) {
            result = yield this.equipments.armor.on('play', game, ctx);
        }
        if (!result) {
        }
        return yield Promise.resolve(result);
    }

    * useSha(game, ctx) {
        if (this.shaCount < 1) {
            return yield Promise.resolve(R.abort);
        }
        return yield Promise.resolve(R.success);
    }

    * usedSha(game, ctx) {
        this.shaCount--;
    }

    * useTao(game, ctx) {
        if (this.hp < this.maxHp) {
            ctx.heal = 1;
            yield this.on('heal', game, ctx);
            game.removeUserCards(ctx.sourceUser, ctx.sourceCards);
            game.discardCards(ctx.sourceCards);
        }
    }

    * damage(game, ctx) {
        console.log(`<U> HP - ${ctx.damage}`);
        this.hp -= ctx.damage;
        game.broadcastUserInfo(this);

        if (this.hp === 0) {
            // TODO game.userDying();
            yield this.on('dying', game, ctx);
        }

        if (this.state === C.USER_STATE.ALIVE) {
            yield this.figure.on('demage', game, ctx);
        }
    }

    * heal(game, ctx) {
        console.log(`<U> HP + ${ctx.heal}`);
        this.hp += ctx.heal;
        game.broadcastUserInfo(this);
        yield this.figure.on('heal', game, ctx);

        if (this.state === C.USER_STATE.DYING && this.hp > 0) {
            this.state = C.USER_STATE.ALIVE;
            game.broadcastUserInfo(this);
        }
    }

    * dying(game, ctx) {
        this.state = C.USER_STATE.DYING;
        game.broadcastUserInfo(this);

        // TODO require Tao
        for (let u of game.userRound()) {
            while(this.state === C.USER_STATE.DYING) {
                // 同一个人可以出多次桃救
                let command = yield game.waitConfirm(u, `${this.figure.name}濒死，是否为其出【桃】？`);
                if (command.cmd === C.CONFIRM.Y) {
                    let result = yield u.on('requireTao', game, ctx);
                    if (result.success) {
                        let cards = result.get().cards;
                        game.removeUserCards(u, cards);
                        game.discardCards(cards);
                        ctx.heal = 1;
                        yield this.on('heal', game, ctx);
                    }
                } else {
                    break;
                }
            }

            if (this.state === C.USER_STATE.ALIVE) {
                break;
            }
        }

        if (this.hp <= 0) {
            yield this.on('die', game, ctx);
        }
    }

    * die(game, ctx) {
        this.state = C.USER_STATE.DEAD;
        game.userDead(this);
    }

    * _requireCard(game, cardClass) {
        let command = yield game.wait(this, {
            validCmds: ['CANCEL', 'CARD'],
            validator: (command) => {
                if (command.cmd === 'CANCEL') {
                    return true;
                }
                let card = cardManager.getCards(command.params)[0];
                if (card instanceof cardClass) {
                    return true;
                }
                return false;
            },
        });

        let result;
        if (command.cmd === 'CANCEL') {
            result = R.fail;
        } else {
            let cards = cardManager.getCards(command.params);
            game.removeUserCards(this, cards);
            result = new R.CardResult();
            result.set(cards);
        }
        return yield Promise.resolve(result);
    }

    * requireSha(game, ctx) {
        let result = yield this.figure.on('requireSha', game, ctx);
        if (!result.abort && result.fail && this.equipments.armor) {
            result = yield this.equipments.armor.on('requireSha', game, ctx);
        }
        if (!result.abort && result.fail) {
            result = yield this._requireCard(game, sgsCards.Sha);
        }
        return yield Promise.resolve(result);
    }

    * requireShan(game, ctx) {
        let result = yield this.figure.on('requireShan', game, ctx);
        if (!result.abort && result.fail && this.equipments.armor) {
            result = yield this.equipments.armor.on('requireShan', game, ctx);
        }
        if (!result.abort && result.fail) {
            result = yield this._requireCard(game, sgsCards.Shan);
        }
        return yield Promise.resolve(result);
    }

    * requireTao(game, ctx) {
        let result = yield this.figure.on('requireTao', game, ctx);
        if (!result.abort && result.fail && this.equipments.armor) {
            result = yield this.equipments.armor.on('requireTao', game, ctx);
        }
        if (!result.abort && result.fail) {
            result = yield this._requireCard(game, sgsCards.Tao);
        }
        return yield Promise.resolve(result);
    }
};
