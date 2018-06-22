const R = require('./results');

fsms = {
    SingleCardFSM: {
        _init: 'C',
        C: {
            CARD: {
                next: 'O',
            },
            CANCEL: {
                next: '_',
                action: (game, c, r) => {
                    return R.abort;
                }
            },
        },
        O: {
            UNCARD: {
                next: 'C',
                action: (game, c, r) => {
                    r.set([]);
                    return r;
                }
            },
            OK: {
                next: '_',
                action: (game, c, r) => {
                    let command = r.get();
                    return new R.FsmResult().set(game.cardManager.getCards(command.params)[0]);
                }
            },
            CANCEL: {
                next: '_',
                action: (game, c, r) => {
                    return R.abort;
                }
            },
        }
    },
    SingleTargetFSM: {
        _init: 'T',
        T: {
            TARGET: {
                next: 'O',
            },
            CANCEL: {
                next: '_',
                action: (game, c, r) => {
                    return R.abort;
                }
            },
        },
        O: {
            UNTARGET: {
                next: 'T',
                action: (game, c, r) => {
                    r.set(new Set());
                    return r;
                }
            },
            OK: {
                next: '_',
                action: (game, c, r) => {
                    let command = r.get();
                    console.log(command);
                    console.log(game.usersByPk(command.params));
                    return new R.FsmResult().set(game.usersByPk(command.params));
                }
            },
            CANCEL: {
                next: '_',
                action: (game, c, r) => {
                    return R.abort;
                }
            },
        }
    },
};

function singleCardFSMFactory(validator) {
    let rtn = Object.assign({}, fsms.SingleCardFSM);
    rtn.C.CARD.validator = validator;
    return rtn;
}

function singleTargetFSMFactory(validator) {
    let rtn = Object.assign({}, fsms.SingleTargetFSM);
    rtn.T.TARGET.validator = validator;
    return rtn;
}

fsms.singleCardFSMFactory = singleCardFSMFactory;
fsms.singleTargetFSMFactory = singleTargetFSMFactory;

module.exports = fsms;