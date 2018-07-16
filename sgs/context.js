class Context extends Object {
    constructor(initValue) {
        super();

        if(initValue instanceof Object) {
            Object.keys(initValue).forEach(k => this[k] = initValue[k]);
        }

        this.handlingCards = new Set();
        // 结算中的牌
    }
}

module.exports = Context;
