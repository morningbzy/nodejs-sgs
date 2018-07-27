const C = require('../constants');
const FSM = require('../common/fsm');

class Skill {
    constructor(figure, opt) {
        this.figure = figure;
        for (let k of Object.keys(opt)) {
            this[k] = opt[k];
        }
    }

    * init(game, ctx) {
        let u = this.figure.owner;
        let defaultOpt = {
            u,
            cardValidator: FSM.BASIC_VALIDATORS.handCardValidator,
            targetValidator: FSM.BASIC_VALIDATORS.notMeTargetValidator,
        };
        let opt = Object.assign(defaultOpt, this.fsmOpt);
        return yield game.waitFSM(u, FSM.get('requireCardsAndTargets', game, ctx, opt), ctx);
    }
}

exports = module.exports = Skill;