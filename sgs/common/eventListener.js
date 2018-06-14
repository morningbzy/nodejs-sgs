const R = require('./results');


class EventListener {
    * on(event, game, ctx) {
        if (typeof(this[event]) === 'function') {
            return yield this[event](game, ctx);
        } else {
            return yield Promise.resolve(R.fail);
        }
    }
}


module.exports = EventListener;