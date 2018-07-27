const C = require('./constants');

module.exports = {
    join: (game, sender, params) => {
        if (sender.seatNum === null) {
            sender.seatNum = game.seat++;
            sender.name = params[0];

            game.sortedUsers = Array.from(
                Object.keys(game.users),
                (k) => game.users[k]
            ).sort((a, b) => a.seatNum - b.seatNum);
        }
        game.broadcast(`TABLE ${sender.seatNum} ${sender.name}`, sender);
        game.broadcastUserInfo(sender);
        game.resendUserInfo(sender);
        sender.restore();
        if(game.lastPopupMsg) {
            let {msg, self} = game.lastPopupMsg;
            sender.reply(`POPUP ${msg}`, (self && (self.id === sender.id)));
        }
    },

    ready: (game, sender, params) => {
        sender.state = C.USER_STATE.READY;
        game.broadcast(`READY ${sender.seatNum}`, sender);
        game.startIfReady();
    },

    unready: (game, sender, params) => {
        sender.state = C.USER_STATE.CONNECTED;
        game.broadcast(`UNREADY ${sender.seatNum}`, sender);
    },

    figure: (game, sender, params) => {
    },

    card: (game, sender, params) => {
        console.log(`|[i] CARD: ${game.cardByPk(params).name}`);
        sender.reply(`SELECT CARD ${params}`);
    },

    uncard: (game, sender, params) => {
        sender.reply(`UNSELECT CARD ${params}`);
    },

    skill: (game, sender, params) => {
        console.log(`|[i] SKILL: ${sender.figure.skills[params[0]].name}`);
        sender.reply(`SELECT SKILL ${params}`);
    },

    target: (game, sender, params) => {
        console.log(`|[i] TARGET: ${game.userByPk(params).figure.name}`);
        sender.reply(`SELECT TARGET ${params}`);
    },

    untarget: (game, sender, params) => {
        sender.reply(`UNSELECT TARGET ${params}`);
    },

    y: (game, sender, params) => {
    },

    n: (game, sender, params) => {
    },

    card_candidate: (game, sender, params) => {
    },

    ok: (game, sender, params) => {
    },

    cancel: (game, sender, params) => {
    },

    pass: (game, sender, params) => {
    },
};
