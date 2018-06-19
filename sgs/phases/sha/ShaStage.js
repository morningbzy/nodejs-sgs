const R = require('../../common/results');


class ShaInitStage {
    static* start(game, u, ctx) {
        if(ctx.skipShaInitStage) {
            return yield Promise.resolve(R.success);
        }

        console.log('SHA-INIT-STAGE');
        let result = yield u.on('useSha', game, ctx);
        if (result.abort) {
            return yield Promise.resolve(result);
        }

        let targetCount = 1;  // TODO: How many targets are required

        game.lockUserCards(u, ctx.sourceCards);
        let command = yield game.wait(u, {
            validCmds: ['CANCEL', 'TARGET'],
            validator: (command) => {
                if (command.cmd === 'CANCEL') {
                    return true;
                }
                if (command.params.length !== targetCount) {
                    return false;
                }
                // TODO: validate distance & target-able
                // const pks = command.params;
                return true;
            },
        });
        game.unlockUserCards(u, ctx.sourceCards);

        if (command.cmd === 'CANCEL') {
            return yield Promise.resolve(R.abort);
        }
        let targetPks = command.params;
        ctx.targets = game.usersByPk(targetPks);

        for(let t of ctx.targets) {
            yield t.on('beShaTarget', game, ctx);
        }

        ctx.damage = 1;
        return yield Promise.resolve(R.success);
    }
}

class ShaValidateStage {
    static* start(game, u, ctx) {
        console.log('SHA-VALIDATE-STAGE');
        let shaAble = true;
        if (shaAble) {
            game.removeUserCards(ctx.sourceUser, ctx.sourceCards);
        } else {
            return yield Promise.resolve(R.abort);
        }
        return yield Promise.resolve(R.success);
    }
}

class ShaExecuteStage {
    static* start(game, u, ctx) {
        console.log('SHA-EXECUTE-STAGE');
        const targets = ctx.targets;

        yield u.on('usedSha', game, ctx);

        // TODO: SHAN-able?
        let shanAble = true;
        if (shanAble) {
            for (let target of targets) {
                let result = yield target.on('requireShan', game, ctx);
                if(result.success) {
                    if(result instanceof R.CardResult) {
                        let cards = result.get().cards;
                        game.removeUserCards(target, cards);
                        game.discardCards(cards);
                    }

                    ctx.shanPlayer = target;
                    yield u.on('usedShan', game, ctx);
                    yield u.on('shaBeenShan', game, ctx);
                } else {
                    yield target.on('damage', game, ctx);
                }
            }
        }

        game.discardCards(ctx.sourceCards);
        return yield Promise.resolve(R.success);
    }
}

const subStages = [
    ShaInitStage,
    ShaValidateStage,
    ShaExecuteStage,
];

class ShaStage {
    static stages(game, u, ctx) {
        return function* gen() {
            let result;
            for (let s of subStages) {
                result = yield s.start(game, u, ctx);
                if (result.abort) {
                    // 中止
                    break;
                }
            }
            return yield Promise.resolve(R.success);
        };
    };

    static* start(game, u, ctx) {
        console.log('SHA-STAGE');
        return yield this.stages(game, u, ctx);
    }
}

module.exports = ShaStage;