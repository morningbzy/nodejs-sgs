const C = require('../constants');
const U = require('../utils');
const Phase = require('./phase');
let Figures = require('../figures/figures');


module.exports = class extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        game.state = C.GAME_STATE.CHOOSING_FIGURE;
        const zhugong = game.zhugong;
        let figures = ['WEI001', 'SHU001', 'WU001'];

        zhugong.reply(`FIGURE_CANDIDATE ${JSON.stringify(figures.map(
            (f) => new (Figures[f])(game).toJson())
        )}`, true, true);
        game.broadcast('MSG 等待主公选择武将');

        let command = yield game.wait(zhugong, {
            validCmds: ['FIGURE'],
            validator: (command) => {
                const pk = command.params[0];
                return figures.includes(pk);
            },
        });
        let figurePk = command.params[0];
        zhugong.setFigure(new Figures[figurePk](game));
        zhugong.showFigure = true;
        zhugong.reply(`CLEAR_CANDIDATE`);
        zhugong.popRestoreCmd('FIGURE_CANDIDATE');
        zhugong.state = C.USER_STATE.ALIVE;
        game.message(['主公选择了武将', zhugong]);
        game.broadcastUserInfo(zhugong);

        figures = U.toArray(Figures.figurePks).filter(pk => pk !== figurePk);


        for (let u of game.userRound(zhugong, true)) {
            let figureCandidates = U.shuffle(figures).slice(0, 3);

            u.reply(`FIGURE_CANDIDATE ${JSON.stringify(figureCandidates.map(
                (f) => new (Figures[f])(game).toJson())
            )}`, true, true);
            command = yield game.wait(u, {
                validCmds: ['FIGURE'],
                validator: (command) => {
                    const pk = command.params[0];
                    return figureCandidates.includes(pk);
                },
            });
            figurePk = command.params[0];
            u.setFigure(new Figures[figurePk](game));
            u.reply(`CLEAR_CANDIDATE`);
            u.popRestoreCmd(`FIGURE_CANDIDATE`);
            u.reply(`USER_INFO ${u.seatNum} ${u.toJsonString(u)}`, true);

            figures = figures.filter(pk => pk !== figurePk);
        }

        for (let u of game.userRound(zhugong, true)) {
            u.showFigure = true;
            game.broadcastUserInfo(u);
            u.state = C.USER_STATE.ALIVE;
        }
    }
};
