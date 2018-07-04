RESULT_STATE = {
    ABORT: 1,
    FAIL: 2,
    SUCCESS: 3,
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
}

class CardResult extends ResultBase {
    constructor() {
        super();
    }

    set(card) {
        if (Array.isArray(card)) {
            console.log(`|<!> CardResult can only set Card, but receive ${card}`);
        }
        this._resultObj = card;
        return this;
    }
}

// class CardsResult extends ResultBase {
//     constructor() {
//         super();
//     }
//
//     set(cards) {
//         this._resultObj = Array.isArray(cards) ? cards : Array.from([cards]);
//         return this;
//     }
// }

class CardTargetResult extends ResultBase {
    constructor() {
        super();
    }

    set(card, target) {
        this._resultObj = {card, target};
        return this;
    }
}

class JudgeResult extends ResultBase {
    constructor(result) {
        super(result ? RESULT_STATE.SUCCESS : RESULT_STATE.FAIL);
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

module.exports = {
    SuccessResult,
    FailResult,
    AbortResult,
    TargetResult,
    CardResult,
    CardTargetResult,
    JudgeResult,
    FsmResult,
    Fsm2Result,

    success: new SuccessResult(),
    fail: new FailResult(),
    abort: new AbortResult(),
    judge: (result) => new JudgeResult(result),
};