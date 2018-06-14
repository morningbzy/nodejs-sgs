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

    set(cards, asClass) {
        this._resultObj = {
            cards: Array.from(cards),
            asClass: asClass,
        };
    }

    get() {
        return this._resultObj;
    }
}

module.exports = {
    SuccessResult,
    FailResult,
    AbortResult,
    CardResult,
    success: new SuccessResult(),
    fail: new FailResult(),
    abort: new AbortResult(),
};