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

    set(cards) {
        this._resultObj = {
            cards: Array.isArray(cards) ? cards : Array.from([cards]),
        };
    }

    get() {
        return this._resultObj;
    }
}

class JudgeResult extends ResultBase {
    constructor(result) {
        super(result ? RESULT_STATE.SUCCESS : RESULT_STATE.FAIL);
    }
}

module.exports = {
    SuccessResult,
    FailResult,
    AbortResult,
    CardResult,
    JudgeResult,
    success: new SuccessResult(),
    fail: new FailResult(),
    abort: new AbortResult(),
    judge: (result) => new JudgeResult(result),
};