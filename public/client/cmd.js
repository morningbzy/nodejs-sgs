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
    confirmInterval: null,  // confirm countdown progress bar

    send: function (cmd, cb) {
        const params = (cmd.params || []).join(' ');
        $.post('/g/cmd', {data: `${cmd.cmd} ${params}`}, cb);
    },

    hb: function (params, marker) {
    },

    clear: function (params, marker) {
        $('.sgs-cl-self').remove();
        $('.sgs-cl-children *').remove();

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

        Cmd.unmodal();
        Cmd.clear_popup();
        Cmd.clear_alert();
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
        userInfo.skillStateClass = function () {
            switch (this.state) {
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
        const rendered = Mustache.render(userTpl, userInfo, {
            equipments: equipmentTpl,
            judgeStack: judgeCardsTpl,
            userMarkers: markersTpl,
        });
        el.replaceWith(rendered);

        if (userInfo.isYou) {
            userInfo.cards.forEach(card => Cmd.card([card], marker));
        }
        if (userInfo.state === 1) {
            Cmd.ready([seatNum], marker);
        } else if (userInfo.state > 1) {
            Cmd.start();
        }
        if (userInfo.waiting) {
            Cmd.waiting([
                seatNum,
                userInfo.waiting.waitingTag,
            ], marker);
        }
        if (userInfo.role !== null) {
            Cmd.role([seatNum, userInfo.role], marker);
        }

        el = getSeat(seatNum);
        $(".sgs-player-marker", el).popover({
            html: true,
            placement: "right",
            trigger: "hover"
        });
    },

    start: function (params, marker) {
        $('#game-table .sgs-player').removeClass(readyClass);
        $('#sgs-player-panel').removeClass(readyClass);
        $('#game-action .ready').addClass('d-none');
        $('#game-action .cancel-ready').addClass('d-none');
    },

    msg: function (params, marker) {
        let msgHtml = `<li>${params.join(' ')}</li>`;
        $(msgHtml).appendTo('#sgs-message-list');
        $('#game-message').scrollTop($('#sgs-message-list').outerHeight());
    },

    popup: function (params, marker) {
        let msgType = params.shift(0);
        let msgEl = $('#sgs-popup-msg');

        switch (msgType) {
            case POPUP_MSG_TYPE.JUDGE: {
                aq.queue({
                    ani: () => {
                        return msgEl.queue(function () {
                            let cards = [JSON.parse(params.join(' '))];
                            let rendered = Mustache.render(cardTpl, {cards});
                            $('.sgs-popup-msg-footer', msgEl).removeClass('invisible').text('判定牌');
                            $('.sgs-popup-msg-body', msgEl).html(rendered);
                            $(this).dequeue();
                        }).fadeIn(200).delay(300);
                    },
                    post: () => {
                        Cmd.clear_popup([], marker);
                        return msgEl;
                    },
                });
                break;
            }
            case POPUP_MSG_TYPE.INSTEAD: {
                let title = params.shift();
                let cards = [JSON.parse(params.join(' '))];
                let rendered = Mustache.render(cardTpl, {cards});
                let arrow = '<div class="p-3 text-black-50" style="font-size: 3rem;">'
                    + '<i class="fas fa-angle-double-left"></i>'
                    + '</div>';

                aq.queue({
                    ani: () => {
                        $('.sgs-popup-msg-header', msgEl).removeClass('invisible').text(title);
                        $(arrow).appendTo($('.sgs-popup-msg-body', msgEl));
                        $(rendered).appendTo($('.sgs-popup-msg-body', msgEl));
                        return msgEl.delay(500);
                    },
                });
                break;
            }
            case POPUP_MSG_TYPE.CARD: {
                aq.queue({
                    ani: () => {
                        return msgEl.queue(function () {
                            let header = params.shift();
                            let footer = params.shift();
                            let cards = [JSON.parse(params.join(' '))];
                            let rendered = Mustache.render(cardTpl, {cards});
                            $('.sgs-popup-msg-header', msgEl).removeClass('invisible').text(header);
                            $('.sgs-popup-msg-footer', msgEl).removeClass('invisible').text(footer);
                            $('.sgs-popup-msg-body', msgEl).html(rendered);
                            $(this).dequeue();
                        }).fadeIn(200).delay(300);
                    },
                    post: () => {
                        Cmd.clear_popup([], marker);
                        return msgEl;
                    },
                });
                break;
            }
            case POPUP_MSG_TYPE.RICH_CONTENT: {
                aq.queue({
                    ani: () => {
                        return msgEl.queue(function () {
                            let data = JSON.parse(params.join(' '));
                            let header = data.header;
                            let footer = data.footer;
                            let info = data.info;
                            let rendered = Mustache.render(skillInfoTpl, {info});
                            if (header !== null) $('.sgs-popup-msg-header', msgEl).removeClass('invisible').text(header);
                            if (footer !== null) $('.sgs-popup-msg-footer', msgEl).removeClass('invisible').text(footer);
                            $('.sgs-popup-msg-body', msgEl).html(rendered);
                            $(this).dequeue();
                        }).fadeIn(200).delay(300);
                    },
                    post: () => {
                        Cmd.clear_popup([], marker);
                        return msgEl;
                    },
                });
                break;
            }
        }
    },

    clear_popup: function (params, marker) {
        let msgEl = $('#sgs-popup-msg');
        msgEl.fadeOut(200, () => {
            $('.sgs-popup-msg-header, .sgs-popup-msg-footer', msgEl).addClass('invisible').text('信息');
            $('.sgs-popup-msg-body', msgEl).html('');
        });
    },

    confirm: function (params, marker) {
        let timeout = params.shift();
        let defaultCmd = params.shift();
        let alertHtml = params.join(' ');
        let time = 0;

        alertHtml += '<span class="sgs-confirm-action">'
            + '<a href="#" class="sgs-confirm-action-y alert-link ml-3" cmd="Y">是</a>'
            + '<a href="#" class="sgs-confirm-action-n alert-link ml-3" cmd="N">否</a>'
            + '</span>';
        alertHtml += '<div class="progress">'
            + '<div class="progress-bar bg-danger" role="progressbar"></div>'
            + '</div>';
        Cmd.alert([alertHtml], marker);

        if (timeout > 0) {
            Cmd.confirmInterval = setInterval(() => {
                time += 100;
                let p = time * 100 / timeout;
                $('#sgs-table .progress .progress-bar').css('width', `${p}%`);
                if (p >= 100) {
                    $('#sgs-table .sgs-alert').alert('close');
                    clearInterval(Cmd.confirmInterval);
                    Cmd.confirmInterval = null;
                    Cmd.send({cmd: defaultCmd, params: [],});
                }
            }, 100);
        }
    },

    alert: function (params, marker) {
        let alertClass = (marker === '*') ? 'warning' : 'info';
        let alertHtml = params.join(' ');
        let rendered = `<div class="sgs-alert sgs-cl-self alert alert-${alertClass} fade mb-0 position-absolute w-100" role="alert">${alertHtml}</div>`;
        $('#sgs-table .alert').alert('close');
        $(rendered).appendTo('#sgs-table');
        $('#sgs-table .alert:last').fadeIn(() => $('#sgs-table .alert:last').addClass('show'));
    },

    clear_alert: function (params, marker) {
        $('#sgs-table .alert').alert('close');
    },

    toast: function (params, marker) {
        let priority = params[0];
        let message = params.slice(1).join(' ');
        $.toaster(message, '', priority);
    },

    modal: function (params, marker) {
        const el = $('#sgs-table-modal');
        if (el.css('display') !== 'none') {
            Cmd.unmodal();
        }
        let title = params[0];
        let withFooter = params[1];
        $('.sgs-table-modal-title', el).text(title);
        if (withFooter) {
            $('.sgs-table-modal-footer', el).removeClass('d-none');
        } else {
            $('.sgs-table-modal-footer', el).addClass('d-none');
        }
        el.fadeIn();
    },

    unmodal: function (params, marker) {
        const el = $('#sgs-table-modal');
        el.fadeOut();
        $('.sgs-table-modal-title', el).text('');
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

    choice_candidate: function (params, marker) {
        Cmd.modal([params.shift(), false]);

        let html = '<div class="d-block w-100 h-100 list-group">';
        params.forEach((v, i) => {
            html += `<a href="#" class="sgs-choice list-group-item list-group-item-action" pk="${i}"><b>${i}.</b> ${v}</a>`;
        });
        html += '</div>';

        const el = $('#sgs-candidate-panel');
        el.html(html);

        el.off('click');
        el.on('click', '.sgs-choice', (e) => {
            Cmd.unmodal();
            Cmd.send({
                cmd: 'CHOICE',
                params: [$(e.currentTarget).attr('pk')],
            }, (resp) => {
            });
        });
    },

    figure_candidate: function (params, marker) {
        Cmd.modal(['请选择武将', false]);
        let candidates = JSON.parse(params.join(' '));
        const rendered = Mustache.render(figureTpl, {figures: candidates});
        const el = $('#sgs-candidate-panel');
        el.html(rendered);

        el.off('click');
        el.on('click', '.figure-candidate', (e) => {
            Cmd.send({
                cmd: 'FIGURE',
                params: [$(e.currentTarget).attr('pk')],
            }, (resp) => {
                Cmd.unmodal();
            });
        });
    },

    card_candidate: function (params, marker) {
        const refresh = () => {
            $('#sgs-candidate-panel .sgs-card').each((i, el) => {
                let idx = $(el).attr('data-sort-index');
                $(el).css({
                    position: 'absolute',
                    top: 0,
                    left: idx * span,
                });
            });
        };

        let title = params.shift();
        Cmd.modal([title, true]);
        const el = $('#sgs-candidate-panel');

        let candidates = JSON.parse(params.join(' '));

        candidates.map((c) => {
            if (!c.show) {
                c.card.name = '[手牌]';
                c.card.category = ' ';
                c.card.suit = 'unknown';
                c.card.number = ' ';
            }
        });
        let rendered = Mustache.render(cardTpl, {cards: candidates.map((x) => x.card)});
        el.html(rendered);

        let cardEl = $('#sgs-candidate-panel .sgs-card');
        let span = Math.min(60, (630 - 90) / cardEl.length);
        cardEl.each((i, el) => $(el).attr('data-sort-index', i));
        refresh();

        $('.sgs-faked-card', el).popover({
            html: true,
            placement: 'top',
            trigger: 'hover'
        });
        $('.sgs-card', el).draggable({
            axis: 'x',
            containment: 'parent',
            zIndex: 1,
            opacity: 0.5,
            start: function () {
                el.addClass('ui-draggable-dragging-parent');
            },
            drag: function (event, ui) {
                let pos = Math.min(Math.round(ui.position.left / span), $('.sgs-card', el).length - 1);
                let originPos = parseInt(ui.helper.attr('data-sort-index'));
                $('.sgs-card', el).each((i, c) => {
                    let idx = parseInt($(c).attr('data-sort-index'));
                    if (originPos < idx && idx <= pos) {
                        $(c).attr('data-sort-index', idx - 1);
                    } else if (pos <= i && i < originPos) {
                        $(c).attr('data-sort-index', idx + 1);
                    }
                });
                ui.helper.attr('data-sort-index', pos);
                if (pos === 0) {
                    ui.helper.insertBefore($('.sgs-card[data-sort-index=1]', el));
                } else {
                    ui.helper.insertAfter($(`.sgs-card[data-sort-index=${pos - 1}]`, el));
                }
                refresh();
            },
            stop: function (event, ui) {
                el.removeClass('ui-draggable-dragging-parent');
                refresh();
            },
        });
    },

    clear_candidate: function (params, marker) {
        $('#sgs-candidate-panel').html('');
        Cmd.unmodal();
    },

    waiting: function (params, marker) {
        let seatNum = params[0];
        changeSeatStateClass(seatNum, marker, waitingClass);

        if (marker === '*') {
            Cmd.waitingTag = parseInt(params[1]);
            $('.sgs-action[waiting-tag]').each((i, el) => {
                if (0 === (Cmd.waitingTag & parseInt(WAITING_FOR[$(el).attr('waiting-tag')]))) {
                    $(el).addClass('disabled').removeClass('btn-primary');
                } else {
                    $(el).removeClass('disabled').addClass('btn-primary');
                }
            });
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
        $(rendered).appendTo('#sgs-card-panel');

        let cardEl = $('#sgs-card-panel .sgs-card');
        let span = Math.min(60, (572 - 90) / cardEl.length);
        cardEl.css({
            position: 'absolute',
        }).each((i, el) => $(el).css({left: i * span,}));
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

    judging: function (params, marker) {
        let pk = params[0];
        $(`.sgs-judge-card[pk=${pk}]`).removeClass('badge-dark')
        .addClass('badge-warning');
    },

    select: function (params, marker) {
        let category = params.shift();

        switch (category.toLowerCase()) {
            case 'card':
                for (let pk of params) {
                    $(`#sgs-player-panel [pk=${pk}]`).addClass(selectedCardClass);
                }
                break;
            case 'target':
                $(`.sgs-player[pk=${params[0]}] .sgs-player-card`).addClass(selectedPlayerClass);
                break;
            case 'skill':
                $(`#sgs-skill-panel .sgs-skill[pk=${params[0]}]`).addClass(selectedSkillClass);
                break;
        }
    },

    unselect: function (params, marker) {
        let category = params.shift();

        switch (category.toLowerCase()) {
            case 'all':
                $('.sgs-card.selected').removeClass(selectedCardClass);
                $('.sgs-player .selected').removeClass(selectedPlayerClass);
                $('.sgs-skill.selected').removeClass(selectedSkillClass);
                break;
            case 'card':
                for (let pk of params) {
                    $(`#sgs-player-panel [pk=${pk}]`).removeClass(selectedCardClass);
                }
                break;
            case 'target':
                $(`.sgs-player[pk=${params[0]}] .sgs-player-card`).removeClass(selectedPlayerClass);
                break;
            case 'skill':
                $(`#sgs-skill-panel .sgs-skill[pk=${params[0]}]`).removeClass(selectedSkillClass);
                break;
        }
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
                let result;
                if (method) {
                    result = method(params, marker);
                }
                if (result instanceof Promise) {
                    result.then(() => res());
                } else {
                    res();
                }
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