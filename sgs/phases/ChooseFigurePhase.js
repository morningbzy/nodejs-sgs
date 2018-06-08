const C = require('../constants');
const Phase = require('./phase');
let Figures = require('../figures/figures');


module.exports = class extends Phase {
    constructor(game) {
        super(game);
    }

    static* start(game) {
        game.state = C.GAME_STATE.CHOOSING_FIGURE;
        let figures = [new (Figures.CaoCao)(), new (Figures.GuanYu)()];
        const zhugong = game.zhugong;

        zhugong.reply(`FIGURE_CANDIDATE ${JSON.stringify(figures.map((f) => f.toJson()))}`, true, true);
        game.broadcast('MSG Waiting for ZG...');

        let figurePk = yield game.wait(zhugong, {
            validator: (uid, cmd, params) => {
                if (uid !== zhugong.id || cmd !== 'FIGURE') {
                    return false;
                }
                const pk = params[0];
                if(figures.map((f) => f.pk).indexOf(pk) === -1) {
                    return false;
                }
                return true;
            },
            value: (uid, cmd, params) => {
                return params[0];
            },
        });

        zhugong.setFigure(new Figures.figureSet[figurePk]());
        zhugong.showFigure = true;
        zhugong.reply(`CLEAR_FIGURE_CANDIDATE`);
        zhugong.popRestoreCmd();
        game.broadcastUserInfo(zhugong);
        zhugong.state = C.USER_STATE.ALIVE;

        for(let u of game.userRound(zhugong, true)) {
            figures = [new (Figures.SiMaYi)(), new (Figures.GuanYu)()];
            u.reply(`FIGURE_CANDIDATE ${JSON.stringify(figures.map((f) => f.toJson()))}`, true, true);
            figurePk = yield game.wait(u, {
                validator: (uid, cmd, params) => {
                    if (uid !== u.id || cmd !== 'FIGURE') {
                        return false;
                    }
                    return true;
                },
                value: (uid, cmd, params) => {
                    return params[0];
                },
            });
            u.setFigure(new Figures.figureSet[figurePk]());
            u.reply(`CLEAR_FIGURE_CANDIDATE`);
            u.popRestoreCmd();
            u.reply(`USER_INFO ${u.seatNum} ${u.toJsonString(u)}`, true);
        }

        for(let u of game.userRound(zhugong, true)) {
            u.showFigure = true;
            game.broadcastUserInfo(u);
            u.state = C.USER_STATE.ALIVE;
        }
    }
};
