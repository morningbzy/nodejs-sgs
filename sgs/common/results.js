RESULT_STATE = {
    ABORT: 1,
    FAIL: 2,
    SUCCESS: 3,
};

class ResultBase {
    constructor(initState = RESULT_STATE.SUCCESS) {
        this._status = initState;
        this._resultObj = null;
        this.abort;
        this.fail;
        this.success;
        this.updateState();
    }

    updateState() {
        this.abort = this._status === RESULT_STATE.ABORT;
        this.fail = this._status === RESULT_STATE.FAIL;
        this.success = this._status === RESULT_STATE.SUCCESS;
    }

    get() {
        return this._resultObj;
    }
}

class SuccessResult extends ResultBase {
    constructor() {
        super();
    }
}

class FailResult extends ResultBase {
    constructor() {
        super(RESULT_STATE.FAIL);
    }
}

class AbortResult extends ResultBase {
    constructor() {
        super(RESULT_STATE.ABORT);
    }
}

class CardResult extends ResultBase {
    constructor() {
        super();
    }

    set(card) {
        if(Array.isArray(card)) {
            console.log(`|<!> CardResult can only set Card, but receive ${card}`);
        }
        this._resultObj = card;
        return this;
    }
}

class CardsResult extends ResultBase {
    constructor() {
        super();
    }

    set(cards) {
        this._resultObj = Array.isArray(cards) ? cards : Array.from([cards]);
        return this;
    }
}

class JudgeResult extends ResultBase {
    constructor(result) {
        super(result ? RESULT_STATE.SUCCESS : RESULT_STATE.FAIL);
    }
}

class FsmResult extends ResultBase {
    constructor() {
        super();
    }

    set(obj) {
        this._resultObj = obj;
        return this;
    }
}


module.exports = {
    SuccessResult,
    FailResult,
    AbortResult,
    CardResult,
    JudgeResult,
    FsmResult,

    success: new SuccessResult(),
    fail: new FailResult(),
    abort: new AbortResult(),
    judge: (result) => new JudgeResult(result),
};