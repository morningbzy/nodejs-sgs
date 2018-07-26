const U = require('../utils');

RESULT_STATE = {
    ABORT: 1,
    FAIL: 2,
    SUCCESS: 3,
    UNIMPLEMENTED: 4,
};

class ResultBase {
    constructor(initState = RESULT_STATE.SUCCESS) {
        this._status = initState;
        this._resultObj = null;
        this.updateState();
    }

    updateState() {
        this.abort = this._status === RESULT_STATE.ABORT;
        this.fail = this._status === RESULT_STATE.FAIL;
        this.success = this._status === RESULT_STATE.SUCCESS;
    }

    getStatus() {
        return this._status;
    }

    setStatus(status) {
        this._status = status;
        this.updateState();
    }

    get() {
        return this._resultObj;
    }
}

class SuccessResult extends ResultBase {
    constructor() {
        super();
        this._resultObj = 'success';
    }
}

class FailResult extends ResultBase {
    constructor() {
        super(RESULT_STATE.FAIL);
        this._resultObj = 'fail';
    }
}

class AbortResult extends ResultBase {
    constructor() {
        super(RESULT_STATE.ABORT);
        this._resultObj = 'abort';
    }
}

class TargetResult extends ResultBase {
    constructor() {
        super();
    }

    set(target) {
        if (Array.isArray(target)) {
            console.log(`|<!> TargetResult can only set Target, but receive ${target}`);
        }
        this._resultObj = target;
        return this;
    }

    toString() {
        return `[TargetResult: ${this._resultObj}]`;
    }
}

class CardResult extends ResultBase {
    constructor(initState = RESULT_STATE.SUCCESS) {
        super(initState);
    }

    set(card) {
        if (Array.isArray(card)) {
            console.log(`|<!> CardResult can only set Card, but receive ${card}`);
        }
        this._resultObj = U.toSingle(card);
        return this;
    }

    toString() {
        return `[CardResult: ${this._resultObj}]`;
    }
}

class CardTargetResult extends ResultBase {
    constructor() {
        super();
    }

    set(card, target) {
        this._resultObj = {card, target};
        return this;
    }

    toString() {
        let cardStr = U.toArray(this._resultObj.card).map(c => c.toString()).join(',');
        let targetStr = U.toArray(this._resultObj.target).map(t => t.toString()).join(',');
        return `[CardTargetResult: ${cardStr} -> ${targetStr}]`;
    }
}

class JudgeResult extends ResultBase {
    constructor(card, result) {
        super(result ? RESULT_STATE.SUCCESS : RESULT_STATE.FAIL);
        this._resultObj = card;
    }
}

// 用于状态机内部状态转换间的结果传递
class FsmResult extends ResultBase {
    constructor() {
        super();
    }

    set(key, value) {
        if (value === undefined) {
            this._resultObj = key;
        } else {
            this._resultObj[key] = value;
        }
        return this;
    }
}

class Fsm2Result extends ResultBase {
    constructor() {
        super();
        this._resultObj = [];
    }

    set(value) {
        if (value) {
            this._resultObj.push(value);
            if (value instanceof ResultBase) {
                this.setStatus(value.getStatus());
            }
        }
        return this;
    }
}

class DistanceResult extends SuccessResult {
    constructor(distance) {
        super();
        this._resultObj = distance;
    }
}


module.exports = {
    RESULT_STATE,

    ResultBase,
    SuccessResult,
    FailResult,
    AbortResult,
    TargetResult,
    CardResult,
    CardTargetResult,
    JudgeResult,
    FsmResult,
    Fsm2Result,
    DistanceResult,

    // Shortcuts
    success: new SuccessResult(),
    fail: new FailResult(),
    abort: new AbortResult(),
    judge: (card, result) => new JudgeResult(card, result),
    distance: (x) => new DistanceResult(x),
};