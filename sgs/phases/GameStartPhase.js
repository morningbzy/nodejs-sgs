const C = require('../constants');
const utils = require('../utils');
const Phase = require('./phase');


class GameStartPhase extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        game.state = C.GAME_STATE.STARTED;
        game.broadcast('START', null, true);
        game.broadcast('MSG 游戏开始，分配身份...');

        let playerCount = game.usersInState([C.USER_STATE.READY]).length;
        let roles = utils.shuffle(C.ROLES_MAPPING[playerCount]);

        for (let uid in game.users) {
            const u = game.users[uid];
            u.state = C.USER_STATE.PREPARING;
            const role = roles.pop();
            u.role = role;
            if (role === C.ROLE.ZHUGONG) {
                game.zhugong = u;
                game.broadcast(`ROLE ${u.seatNum} ${role}`, u, true);
            } else {
                u.reply(`ROLE ${u.seatNum} ${role}`, true, true);
            }
        }
    }
}

GameStartPhase.name = 'GameStartPhase';
module.exports = GameStartPhase;
