const R = require('./results');
const {Context} = require('../context');


class EventListener {
    * on(event, game, ctx) {
        // console.log(`|[E] ON ${this.name || this.constructor.name} ${event}`);
        if(!ctx instanceof Context) {
            console.warn(`|[!] Context of "${event}" is not instance of Context.`);
        }
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