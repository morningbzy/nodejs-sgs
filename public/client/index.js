let dbg;

class Debug {
    constructor() {
        this._switch = document.querySelector('#switch');
        this._clean = document.querySelector('#clean');
        this._msg = document.querySelector('#msg');
        this._status = document.querySelector('#status');
        this._send = document.querySelector('#message-send');
        this._input = document.querySelector('#message-input');
        this.game = null;
    }

    init(game) {
        this.game = game;
        this._clean.addEventListener('click', () => {
            this._msg.innerHTML = '';
        });
        this._switch.addEventListener('click', (e) => {
            if (e.target.innerText === '开启') {
                this.on();
            } else {
                this.off();
            }
        });
        this._send.addEventListener('click', () => {
            $.post('/g/cmd',
                {data: this._input.value},
                (resp) => {
                    console.log(resp);
                }
            );
        });
    };

    on() {
        this.game.on();
        this._switch.innerText = '关掉';
        this._status.classList.add('working');
    }

    off() {
        this.game.off();
        this._switch.innerText = '开启';
        this._status.classList.remove('working');
    }

    log(log) {
        this._msg.innerHTML = '<li>' + log + '</li>' + this._msg.innerHTML;
        if($('li', this._msg).length > 100) {
            $('li', this._msg).map((i, el) => i >= 100? $(el).remove(): null);
        }
    }
}

class Game {
    constructor() {
        this._ready = $('#game-action .ready');
        this._cancelReady = $('#game-action .cancel-ready');
        this._table = $('#game-table');

        this.es = null;  // EventSource

        this.init();

        this.cmdQueue = new CommandQueue();
    }

    init() {
        let table = this._table;

        this._ready.on('click', (e) => {
            Cmd.send({cmd: 'READY', params: [],});
        });
        this._cancelReady.on('click', (e) => {
            Cmd.send({cmd: 'UNREADY', params: [],});
        });

        table.on('click', '.sgs-confirm-action a', (e) => {
            let el = $(e.currentTarget);
            let cmd = el.attr('cmd');
            clearInterval(Cmd.confirmInterval);
            Cmd.confirmInterval = null;
            el.parents('.alert').alert('close');
            Cmd.send({cmd: cmd, params: [],});
        });
        table.on('click', '.sgs-player:not(.sgs-dead) .sgs-player-card', (e) => {
            if ((WAITING_FOR.TARGET + WAITING_FOR.UNTARGET) & Cmd.waitingTag) {
                let el = $(e.currentTarget);
                let pk = el.parents('[pk]').attr('pk');
                Cmd.send({
                    cmd: el.hasClass('selected') ? 'UNTARGET' : 'TARGET',
                    params: [pk,],
                });
            }
        });
        table.on('click', '#sgs-card-panel .sgs-card, #sgs-player-panel .sgs-equipment:not(.disabled)', (e) => {
            e.stopPropagation();
            if ((WAITING_FOR.CARD + WAITING_FOR.UNCARD) & Cmd.waitingTag) {
                let el = $(e.currentTarget);
                let pk = $(e.currentTarget).attr('pk');
                Cmd.send({
                    cmd: el.hasClass('selected') ? 'UNCARD' : 'CARD',
                    params: [pk,],
                });
            }
        });
        table.on('click', '.sgs-skill-enabled', (e) => {
            let pk = $(e.currentTarget).attr('pk');
            Cmd.send({cmd: 'SKILL', params: [pk],});
        });
        table.on('click', '.sgs-action:not(.disabled)', (e) => {
            let action = $(e.currentTarget).attr('action');
            Cmd.send({cmd: action, params: [],});
        });
        table.on('click', '#sgs-candidate-panel .sgs-card', (e) => {
            let el = $(e.currentTarget);
            el.toggleClass(selectedCardClass);
        });
        table.on('click', '#sgs-table-modal .sgs-table-modal-ok', (e) => {
            let pks = [];
            $('#sgs-candidate-panel .selected').each((i, el) => pks.push($(el).attr('pk')));
            Cmd.send({
                cmd: 'CARD_CANDIDATE',
                params: pks,
            });
        })
    }

    on() {
        const cmdQueue = this.cmdQueue;

        $.get('/g', (resp) => {
            dbg.log(resp);
            // 1. 声明EventSource
            this.es = new EventSource('/g/msg');
            // 2. 监听数据
            this.es.onmessage = function (e) {
                let items = e.data.split(' ');
                let marker = items[0].substr(0, 1);
                let cmd = items[0].substr(1);
                let params = items.slice(1);

                // dbg.log(`CMD: ${cmd} Params: ${params}`);
                if (cmd !== 'HB') {
                    dbg.log(e.data);
                    cmdQueue.publish(cmd.toLowerCase(), params, marker);
                }
            };
            this.es.onerror = function (e) {
                $.get('/g');
            };
        });
    }

    off() {
        this.es.close();
    }
}

$(document).ready(() => {
    dbg = new Debug();
    const game = new Game();
    dbg.init(game);
    dbg.on();
});
