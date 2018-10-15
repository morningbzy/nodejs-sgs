const STATUS = {
    WAITING: 1,
    ANIMATING: 2,
    FINISHING: 3,
};


class AnimateQueue {
    constructor(el) {
        this._el = el;
        this._q = [];
        this.status = STATUS.WAITING;
    }

    queue(a, no) {
        let stop = (this._q.length === 0 && this.status === STATUS.FINISHING);
        this._q.push(a);
        if (this.status === STATUS.WAITING) {
            this.next();
        } else if (stop) {
            this.stop().next();
        }
    }

    next() {
        let a = this._q.shift();
        if (a === undefined) {
            return;
        }

        this._el.queue(n => {
            this.status = STATUS.ANIMATING;
            if (a.ani instanceof Function) {
                a.ani().queue(na => {
                    this.changeStatus(STATUS.FINISHING);
                    na();
                    n();
                });
            } else {
                n();
            }
        });

        this._el.queue(n => {
            if (this._q.length === 0) {
                $(this).delay(a.delay || 10000).queue(() => {
                    $(this).dequeue();
                    n();
                });
            } else {
                n();
            }
        });

        this._el.queue(n => {
            if (a.post instanceof Function) {
                a.post().queue(na => {
                    na();
                    n();
                });
            }
        })
        .delay(1)
        .queue(n => {
            this.changeStatus(STATUS.WAITING);
            this.next();
            n();
        });
    }

    stop() {
        this._el.stop();
        this.changeStatus(STATUS.WAITING);
        return this;
    }

    changeStatus(s) {
        this.status = s;
    }
}

let aq;

$(document).ready(() => {
    aq = new AnimateQueue($('#q'));
});
