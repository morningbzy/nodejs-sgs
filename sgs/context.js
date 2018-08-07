const U = require('./utils');


class Context extends Object {
    constructor(game, initValue = {}) {
        super();

        this.game = game;

        this.info = initValue;
        this.i = this.info;  // 'i' is short for info

        this.roundCtx = null;
        this.phaseCtx = null;
        this.parentCtx = null;  // 父Context
        this.children = [];  // 子Context栈
        this.handlingCards = new Set();  // 此上下文中处理区中的牌
    }

    pushChild(ctx) {
        this.children.push(ctx);
        ctx.parentCtx = this;
        ctx.roundCtx = this.roundCtx;
        ctx.phaseCtx = this.phaseCtx;
    }

    popChild(ctx) {
        return this.children.pop(ctx);
    }

    linkParent(ctx) {
        ctx.pushChild(this);
        return this;
    }

    allHandlingCards() {
        let cards = U.toArray(this.handlingCards);
        for(let child of this.children) {
            cards = cards.concat(child.allHandlingCards());
        }
        return cards;
    }
}


class SimpleContext extends Context {

}


class RoundContext extends Context {
    constructor(game, initValue) {
        super(game, initValue);
        this.roundCtx = this;
    }
}


class PhaseContext extends Context {
    constructor(game, initValue) {
        super(game, initValue);
        this.phaseCtx = this;
    }
}


class PlayContext extends Context {
    constructor(game, initValue) {
        super(game, initValue);
    }

}


class CardContext extends Context {
    constructor(game, card, initValue) {
        super(game, initValue);
        this.i.card = card;
    }

}


class SkillContext extends Context {
    constructor(game, skill, initValue) {
        super(game, initValue);
        this.skill = skill;
    }

}


class FSMContext extends Context {
    constructor(game, initValue) {
        super(game, initValue);
    }
}


class JudgeContext extends Context {
    constructor(game, initValue) {
        super(game, initValue);
    }
}

// module.exports.Context = Context;
module.exports.SimpleContext = SimpleContext;
module.exports.RoundContext = RoundContext;
module.exports.PhaseContext = PhaseContext;
module.exports.PlayContext = PlayContext;
module.exports.CardContext = CardContext;
module.exports.SkillContext = SkillContext;
// module.exports.FSMContext = FSMContext;
module.exports.JudgeContext = JudgeContext;
// module.exports.CompareContext = CompareContext;
