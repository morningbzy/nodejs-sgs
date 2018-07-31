const C = require('../../constants');
const R = require('../results');
const U = require('../../utils');
const FSMFactory = require('./fsmFactory');


class Machine {
    constructor(game, parentCtx) {
        this.game = game;
        // this.context = new FSMContext(game).linkParent(parentCtx);
        this.info = {
            game,
            parentCtx,
        };

        this.states = new Map();
        this.transitions = new Set();
        this.validCmds = new Map();

        this.initState = null;
        this.currentState = null;
        this.endState = END_STATE;

        this.result = null;
        this.done = false;
        this.finalHandler = (result) => {
            return result instanceof R.ResultBase ? result : R.fail;
        };

        this.addState(END_STATE);  // Add a the EndState which is "_"
    }

    addState(state, init = false) {
        if (this.states.has(state.pk)) {
            console.warn(`|<!> Duplicate State pk: ${state.pk}`);
        }
        this.states.set(state.pk, state);
        this.validCmds.set(state.pk, new Set());

        if (init) {
            if (this.initState !== null) {
                console.warn(`|<!> Duplicate initState ${this.initState.pk} & ${state.pk}(new)`);
            }
            this.initState = this.getState(state);
        }
    }

    getState(state) {
        return (state instanceof State) ? state : this.states.get(state);
    }

    getValidCmds() {
        return U.toArray(this.validCmds.get(this.currentState.pk));
    }

    setFinalHandler(handler) {
        this.finalHandler = handler;
    }

    addTransition(trans) {
        this.transitions.add(trans);
        this.validCmds.get(trans.from).add(trans.cmd);
    }

    setInfo(obj) {
        Object.assign(this.info, obj);
    }

    start() {
        this.currentState = this.initState;
    }

    validate(command) {
        let trans = this.findMatchTransition(command);
        this.info.cachedValidTrans = trans;
        return trans !== null;
    }

    findMatchTransition(command) {
        for (let trans of this.transitions) {
            if (trans.from !== '*' && trans.from !== this.currentState.pk) {
                continue;
            }
            if (trans.match(command, this.info)) {
                return trans;
            }
        }
        return null;
    }

    * intoSub(state) {
        let command = yield state.subMachine(this.info);
        return yield Promise.resolve(command);
    }

    next(command) {
        this.info.command = command;
        let trans = this.info.cachedValidTrans;
        // Action
        if (trans.action instanceof Function) {
            trans.action(this.game, this.info);
        }
        // Move
        let toState = (trans.to instanceof Function) ? trans.to(this.game, this.info) : trans.to;
        this.move(toState);
    }

    move(toStatePk) {
        this.currentState = this.getState(toStatePk);
        this.done = (this.currentState === this.endState);
        if (this.done) {
            this.result = this.finalHandler(this.info.result);
        }
    }
}


class State {
    constructor(pk, subMachine) {
        this.pk = pk;
        this.subMachine = subMachine;
    }
}


class Transition {
    constructor(from, cmd, to, validators, action) {
        this.from = from;
        this.cmd = cmd;
        this.to = to;
        this.conditions = [];
        this.action = action;

        this.addValidators(validators);
    }

    toString() {
        return `${this.from}-${this.cmd}-${this.to}`;
    }

    addValidators(validators) {
        this.conditions.push(...U.toArray(validators));
    }

    match(command, info) {
        if (command.cmd !== this.cmd) {
            return false;
        }

        for (let cond of this.conditions) {
            if (cond instanceof Function && !Boolean(cond(command, info))) {
                return false;
            }
        }
        return true;
    }
}


const END_STATE = new State('_');


module.exports.BASIC_VALIDATORS = {
    handCardValidator: (command, info) => {
        let card = info.game.cardByPk(command.params);
        return info.sourceUser.hasCard(card);
    },

    equipCardValidator: (command, info) => {
        let card = info.game.cardByPk(command.params);
        return info.sourceUser.hasEquipedCard(card);
    },

    ownCardValidator: (command, info) => {
        let card = info.game.cardByPk(command.params);
        return info.sourceUser.hasCard(card) || info.sourceUser.hasEquipedCard(card);
    },

    buildCardSuitValidator: (suit) => {
        let validSuits;
        switch(suit) {
            case 'RED':
                validSuits = [C.CARD_SUIT.HEART, C.CARD_SUIT.DIAMOND];
                break;
            case 'BLACK':
                validSuits = [C.CARD_SUIT.SPADE, C.CARD_SUIT.CLUB];
                break;
            default:
                validSuits = U.toArray(suit);
        }
        return (command, info) => {
            let card = info.game.cardByPk(command.params);
            return validSuits.includes(card.suit);
        };
    },

    notMeTargetValidator: (command, info) => {
        return U.toSingle(command.params) !== info.sourceUser.id;
    },

    enabledSkillValidator: (command, info) => {
        let skill = info.sourceUser.figure.skills[U.toSingle(command.params)];
        return (skill.state === C.SKILL_STATE.ENABLED);
    },

    buildCountExceededValidator: (category, amount) => {
        return (command, info) => {
            return (amount === C.SELECT_TYPE.SINGLE
                || amount < C.SELECT_TYPE.NONE
                || info[category].size < amount);
        };
    }
};


module.exports.BASIC_ACTIONS = {
    cardToContext: (game, info) => {
        info.card = game.cardByPk(info.command.params);
    },
    skillToContext: (game, info) => {
        info.skill = info.sourceUser.figure.skills[U.toSingle(info.command.params)];
    },
    targetToContext: (game, info) => {
        info.target = game.userByPk(info.command.params);
    },
};


module.exports.Machine = Machine;
module.exports.State = State;
module.exports.Transition = Transition;
module.exports.get = FSMFactory.get;
