const R = require('./results');


class EventListener {
    * on(event, game, ctx) {
        console.log(`|<E> ON ${this.name || this.constructor.name} ${event}`);
        let result = R.fail;
        if (typeof(this[event]) === 'function') {
            result = yield this[event](game, ctx);
            if (result === undefined || result === null) {
                result = R.fail;
            }
        }
        return yield Promise.resolve(result);
    }
}


module.exports = EventListener;