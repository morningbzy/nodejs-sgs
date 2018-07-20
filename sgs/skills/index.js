const C = require('../constants');

class Skill {
    * init(game, ctx) {
        let u = ctx.sourceUser;
        let opt = {
            u,
            cardValidator: (command) => {

            },
            targetValidator: (command) => {
                let target = game.userByPk(command.params);
                return target.id !== u.id;
            },
            cardCount: ctx.skill.cardCount || C.SELECT_TYPE.SINGLE,
            targetCount: ctx.skill.targetCount || C.SELECT_TYPE.SINGLE,
            initCtx: {
                skill: ctx.skill,
            }
        };
        // [C-T-O]
        const initSkill1 = (game, opt) => {
            let m = new FSM.Machine(game);
            m.setContext(opt.initCtx);
        };

        return yield game.waitFSM(u, initSilkBag(game, opt), ctx);
    }
}

exports = module.exports = Skill;