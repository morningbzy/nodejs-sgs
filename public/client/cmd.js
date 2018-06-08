function getSeat(seatNum) {
    return $(`#game-table .sgs-player[seat-num=${seatNum}]`);
}

const waitingClass = ' bg-warning';
const readyClass = ' bg-success';

function sleep(ms) {
    return new Promise((res, rej) => {
        setTimeout(res, ms);
    });
    // for (let t = Date.now(); Date.now() - t <= ms;) ;
}


function changeSeatStateClass(seatNum, marker, stateClass, remove = false) {
    if (marker === '*') {
        if (remove) {
            $('#player-panel').removeClass(stateClass);
        } else {
            $('#player-panel').addClass(stateClass);
        }
    } else {
        let el = getSeat(seatNum);
        if (remove) {
            el.removeClass(stateClass);
        } else {
            el.addClass(stateClass);
        }
    }
}

const Cmd = {
    send: function (cmd) {
        const params = (cmd.params || []).join(' ');
        $.post('/g/cmd', {data: `${cmd.cmd} ${params}`}, (resp) => {
            console.log(resp);
        });
    },

    hb: function (params, marker) {
    },

    clear: function (params, marker) {
        $('#game-table .sgs-cl-self').remove();
        $('#game-table .sgs-cl-children *').remove();

        let rendered = Mustache.render(userTpl, {
            name: 0,
            role: '?',
            isYou: false,
        });
        for (let i = 0; i < 5; i++) {
            $('#game-table .top').append(rendered);
        }
        $('#game-table .middle').prepend(rendered);
        $('#game-table .middle').append(rendered);

        rendered = Mustache.render(userTpl, {
            name: 0,
            role: '?',
            isYou: true,
        });
        $('#player-panel #sgs-player-panel').prepend(rendered);
        $('#player-panel').removeClass(waitingClass).removeClass(readyClass);
    },

    table: function (params, marker) {
        const total = 8;
        let seatNum = parseInt(params[0]);
        let name = params[1];

        if (marker === '*') {
            $('.is-you').attr('seat-num', seatNum);
            $('.is-you span.name').text(name);
            $('#game-action .ready').removeClass('d-none');

            let i = 2;
            $('#game-table .top .is-other').each((index, el) => {
                $(el).attr('seat-num', (seatNum + i) % total);
                i++;
            });

            i = 1;
            $('#game-table .middle .is-other').each((index, el) => {
                $(el).attr('seat-num', (seatNum + i) % total);
                i += total - 2;
            });
        } else {
            let el = getSeat(seatNum);
            $('span.name', el).text(name);
        }
    },

    connected: function (params, marker) {
        // Clear table
        Cmd.clear(params, marker);

        // -- FOR debug --
        let name = params[0].substr(0, 8);
        Cmd.send({
            cmd: 'JOIN',
            params: [name],
        });
    },

    ready: function (params, marker) {
        let seatNum = params[0];
        changeSeatStateClass(seatNum, marker, readyClass);
        if (marker === '*') {
            $('#game-action .ready').addClass('d-none');
            $('#game-action .cancel-ready').removeClass('d-none');
        }
    },

    unready: function (params, marker) {
        let seatNum = params[0];
        changeSeatStateClass(seatNum, marker, readyClass, true);
        if (marker === '*') {
            $('#game-action .ready').removeClass('d-none');
            $('#game-action .cancel-ready').addClass('d-none');
        }
    },

    user_info: function (params, marker) {
        let seatNum = params[0];
        let userInfo = JSON.parse(params.slice(1).join(' '));

        if (marker === '*') {
            userInfo.isYou = true;
            Cmd.table([seatNum, userInfo.name], marker);
            $('#sgs-card-panel .sgs-card').remove();
            for (let card of userInfo.cards) {
                Cmd.card([card], marker);
            }
        } else {
            userInfo.isYou = false;
        }

        let el = getSeat(seatNum);
        const rendered = Mustache.render(userTpl, userInfo);
        el.replaceWith(rendered);
        if (userInfo.state === 1) {
            Cmd.ready([seatNum], marker);
        } else if (userInfo.state > 1) {
            Cmd.start();
        }
        if (userInfo.waiting) {
            Cmd.waiting([seatNum], marker);
        }
        if (userInfo.role !== null) {
            Cmd.role([seatNum, userInfo.role], marker);
        }
    },

    start: function (params, marker) {
        $('#game-table .sgs-player').removeClass(readyClass);
        $('#player-panel').removeClass(readyClass);
        $('#game-action .ready').addClass('d-none');
        $('#game-action .cancel-ready').addClass('d-none');
    },

    msg: function (params, marker) {
    },

    role: function (params, marker) {
        let seatNum = params[0];
        let el = getSeat(seatNum);
        switch (params[1].toString()) {
            case '0':
                $('.role', el).text('ZG').addClass('badge-danger');
                break;
            case '1':
                $('.role', el).text('ZC').addClass('badge-warning');
                break;
            case '2':
                $('.role', el).text('FZ').addClass('badge-success');
                break;
            case '3':
                $('.role', el).text('NJ').addClass('badge-primary');
                break;
            default:
                $('.role', el).text(params[1]);
        }
    },

    figure_candidate: function (params, marker) {
        let candidates = JSON.parse(params.join(' '));
        const rendered = Mustache.render(figureTpl, {figures: candidates});
        const el = $('#feature-candidate-panel');
        el.html(rendered);

        el.off('click');
        el.on('click', '.figure-candidate', (e) => {
            Cmd.send({
                cmd: 'FIGURE',
                params: [$(e.currentTarget).attr('pk')],
            });
        });
    },

    clear_figure_candidate: function (params, marker) {
        $('#feature-candidate-panel').html('');
    },

    waiting: function (params, marker) {
        let seatNum = params[0];
        changeSeatStateClass(seatNum, marker, waitingClass);
    },

    unwaiting: function (params, marker) {
        let seatNum = params[0];
        changeSeatStateClass(seatNum, marker, waitingClass, true);
    },

    figure: function (params, marker) {
        let seatNum = params[0];
        let el = getSeat(seatNum);
        let figureInfo = JSON.parse(params.slice(1).join(' '));
        $('.sgs-figure .name', el).text(figureInfo.name);
    },

    card: function (params, marker) {
        let cards = [JSON.parse(params.join(' '))];
        let rendered = Mustache.render(cardTpl, {cards});
        let pos = $('#sgs-card-panel .sgs-card').length;
        $(rendered).appendTo('#sgs-card-panel').css('left', pos * 60);
    },

};


class CommandQueue {
    constructor() {
        this.running = false;
        this.queue = [];
    }

    * execute() {
        for (let o; o = this.queue.shift();) {
            yield new Promise((res, rej) => {
                let {cmd, params, marker} = o;
                let method = Cmd[cmd.toLowerCase()];
                if (method) {
                    method(params, marker);
                }
                res();
            });
        }
    }

    publish(cmd, params, marker) {
        this.queue.push({cmd, params, marker,});
        if (!this.running) {
            this.running = true;
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
            this.running = false;
        });
    }
}