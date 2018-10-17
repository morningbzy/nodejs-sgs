const STATUS = {
    READY: 1,  // 队列准备执行下一个动画，如果队列为空，则持续等待
    ANIMATING: 2,  // 正在执行主（入场）动画
    DELAY: 3,  // 正在执行入-出场等待时间
    FINISHING: 4,  // 正在执行出场动画
};

const DEFAULT_DELAY = 10 * 1000;  // 默认入-出场等待时间，10秒

class AnimateQueue {
    constructor() {
        this._q = [];
        this.timer = {};
        this.status = STATUS.READY;
    }

    * execute() {
        for (let o; o = this._q.shift();) {
            let {ani, delay = DEFAULT_DELAY, post} = o;

            yield new Promise((res, rej) => {
                // 执行主（入场）动画
                this.changeStatus(STATUS.ANIMATING);
                if (ani instanceof Function) {
                    ani().queue(na => {
                        na();
                        res();
                    });
                } else {
                    res();
                }
            }).then(() => {
                // 如果队列为空，则执行入-出场等待时间
                if (this._q.length < 1) {
                    this.changeStatus(STATUS.DELAY);
                    return this.wait(delay);
                } else {
                    return;
                }
            }).then(() => {
                // 执行出场动画
                this.changeStatus(STATUS.FINISHING);
                return new Promise((res, rej) => {
                    if (post instanceof Function) {
                        post().queue(na => {
                            na();
                            res();
                        });
                    }
                });
            }).then(() => {
                this.changeStatus(STATUS.READY);
            });
        }
    }

    queue(a) {
        this._q.push(a);
        if (this.status === STATUS.DELAY) {
            this.break();
        } else if (this.status === STATUS.READY) {
            return new Promise((res, rej) => {
                this.run();
                res();
            });
        } else {
            return Promise.resolve();
        }
    }

    run() {
        let it = this.execute();
        let go = function (r) {
            if (r.done) return r.value;
            return r.value.then(
                (v) => {
                    return go(it.next(v));
                },
                (err) => {
                    return go(it.throw(err));
                }
            );
        };

        go(it.next()).then(() => {
            this.changeStatus(STATUS.READY);
        });
    }

    wait(ms) {
        return new Promise((res, rej) => {
            this.timer = {
                timer: setTimeout(res, ms),
                next: res
            };
        });
    }

    break() {
        const {timer, next} = this.timer;
        this.timer = {};
        clearTimeout(timer);
        next();
    }

    changeStatus(s) {
        this.status = s;
    }
}

let aq;

$(document).ready(() => {
    aq = new AnimateQueue();
});
