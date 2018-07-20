const R = require('../results');
const U = require('../../utils');


class Machine {
    constructor(game) {
        this.game = game;

        this.states = new Map();
        this.validCmds = new Map();

        this.addState(END_STATE);

        this.init = null;
        this.end = END_STATE;
        this.current = null;

        this.context = {};
        this.result = new R.Fsm2Result();
        this.done = false;
        this.finalHandler = null;
    }

    setEnd(state) {
        this.end = state;
    }

    addState(state, init = false) {
        this.states.set(state.pk, state);

        if (init) {
            this.init = this.getState(state);
        }
    }

    getState(state) {
        return (state instanceof State) ? state : this.states.get(state);
    }

    setFinalHandler(handler) {
        this.finalHandler = handler;
    }

    addTransition(trans) {
        const from = this.getState(trans.from);
        from.addTransition(trans);
    }

    setContext(obj) {
        Object.assign(this.context, obj);
    }

    start() {
        this.current = this.init;
    }

    validate(command) {
        return this.current.validate(command, this.context);
    }

    * intoSub(state, ctx) {
        let command = yield state.subMachine(this.game, ctx, this.context);
        this.result.set(this.context.result);
        return yield Promise.resolve(command);
    }

    next(command) {
        this.context.command = command;
        let trans = this.current.transitions.get(command.cmd);
        if (trans.action) {
            if (trans.action instanceof Function) {
                this.result.set(trans.action(this.game, this.context));
            } else {
                this.result.set(trans.action);
            }
        } else {
            this.result.set(R.abort);
        }
        this.move(trans.to);
    }

    move(toState) {
        if(toState instanceof Function) {
            toState = toState(this.game, this.context);
        }
        this.current = this.getState(toState);
        this.done = (this.current === this.end);
        if (this.done && this.finalHandler) {
            this.result = this.finalHandler(this.result);
        }
    }
}

class State {
    constructor(pk, subMachine){
        this.pk = pk;
        this.subMachine = subMachine;
        this.transitions = new Map();
    }

    addTransition(transition) {
        if (this.transitions.has(transition.cmd)) {
            throw 'Duplicate transition condition!';
        }

        this.transitions.set(transition.cmd, transition);
    }

    getValidCmds() {
        return Array.from(this.transitions.keys());
    }

    validate(command, ctx) {
        let cmd = command.cmd;
        return this.transitions.get(cmd).validate(command, ctx);
    }
}

class Transition {
    constructor(from, cmd, to, validator, action) {
        this.from = from;
        this.cmd = cmd;
        this.to = to;
        this.conditions = [];
        this.action = action;

        this.addValidator(validator);
    }

    addValidator(validator) {
        if (validator) {
            this.conditions.push(validator);
        }
    }

    validate(command, ctx) {
        for (let cond of this.conditions) {
            if (false === Boolean(cond(command, ctx))) {
                return false;
            }
        }
        return true;
    }
}


const END_STATE = new State('_');

module.exports = {
    Machine, State, Transition,
};