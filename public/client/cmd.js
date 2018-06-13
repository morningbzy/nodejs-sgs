function getSeat(seatNum) {
    return $(`#game-table .sgs-player[seat-num=${seatNum}]`);
}


function changeSeatStateClass(seatNum, marker, stateClass, remove = false) {
    let el = getSeat(seatNum);
    if (remove) {
        el.removeClass(stateClass);
    } else {
        el.addClass(stateClass);
    }
}

const Cmd = {
    waitingTag: 0,  // 0:NOTHING, 1:SOMETHING, 2:CARD, 3:TARGET

    send: function (cmd) {
        const params = (cmd.params || []).join(' ');
        $.post('/g/cmd', {data: `${cmd.cmd} ${params}`}, (resp) => {
        });
    },

    hb: function (params, marker) {
    },

    clear: function (params, marker) {
        $('#game-table .sgs-cl-self').remove();
        $('#game-table .sgs-cl-children *').remove();

        let rendered = Mustache.render(userTpl, {
            name: null,
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
        $('#sgs-player-panel').prepend(rendered);
        $('#sgs-player-panel').removeClass(waitingClass).removeClass(readyClass);
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
        userInfo.isYou = marker === '*';
        userInfo.dying = () => {
            return userInfo.state === 4;
        };
        userInfo.dead = () => {
            return userInfo.state === 5;
        };
        userInfo.skillStateClass = function() {
            console.log(this.state);
            switch(this.state) {
                case SKILL_STATE.DISABLED:
                    return 'btn-light disabled';
                case SKILL_STATE.ENABLED:
                    return 'btn-light sgs-skill-enabled';
                case SKILL_STATE.FIRING:
                    return 'btn-danger';
            }
            return 'btn-light disabled';
        };

        let el = getSeat(seatNum);
        const rendered = Mustache.render(userTpl, userInfo);
        el.replaceWith(rendered);

        if (userInfo.isYou) {
            userInfo.cards.forEach(card => Cmd.card([card], marker));
        }
        if (userInfo.state === 1) {
            Cmd.ready([seatNum], marker);
        } else if (userInfo.state > 1) {
            Cmd.start();
        }
        if (userInfo.waiting !== 0) {
            Cmd.waiting([seatNum, userInfo.waiting], marker);
        }
        if (userInfo.role !== null) {
            Cmd.role([seatNum, userInfo.role], marker);
        }
    },

    start: function (params, marker) {
        $('#game-table .sgs-player').removeClass(readyClass);
        $('#sgs-player-panel').removeClass(readyClass);
        $('#game-action .ready').addClass('d-none');
        $('#game-action .cancel-ready').addClass('d-none');
    },

    msg: function (params, marker) {
    },

    confirm: function(params, marker) {
        let alertHtml = params.join(' ');
        alertHtml += `<span class="sgs-confirm-action"><a href="#" class="sgs-confirm-action-y alert-link ml-3" cmd="Y">是</a><a href="#" class="sgs-confirm-action-n alert-link ml-3" cmd="N">否</a></span>`;
        Cmd.alert([alertHtml], marker);
    },

    alert: function (params, marker) {
        let alertClass = (marker === '*') ? 'warning' : 'info';
        let alertHtml = params.join(' ');
        let rendered = `<div class="sgs-cl-self alert alert-${alertClass} fade mb-0" role="alert">${alertHtml}</div>`;
        $('#sgs-table .alert').alert('close');
        $(rendered).appendTo('#sgs-table');
        $('#sgs-table .alert:first').addClass('show');
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

        if (marker === '*') {
            Cmd.waitingTag = parseInt(params[1]);
        }
    },

    unwaiting: function (params, marker) {
        let seatNum = params[0];
        Cmd.waitingTag = 0;
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
        let span = Math.min(60, (572 - 90) / $('#sgs-card-panel .sgs-card').length);
        $(rendered).appendTo('#sgs-card-panel');
        $('#sgs-card-panel .sgs-card').each((i, el) => $(el).css('left', i * span));
    },

    lock_card: function (params, marker) {
        for (let pk of params) {
            $(`.sgs-card[pk=${pk}]`).addClass(lockedCardClass);
        }
    },

    unlock_card: function (params, marker) {
        for (let pk of params) {
            $(`.sgs-card[pk=${pk}]`).removeClass(lockedCardClass);
        }
    },

    remove_card: function (params, marker) {
        let pk = params[0];
        $(`.sgs-card[pk=${pk}]`).remove();
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