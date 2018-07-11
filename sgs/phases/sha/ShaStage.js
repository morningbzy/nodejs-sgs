const R = require('../../common/results');
const FSM = require('../../common/stateMachines');


class ShaInitStage {
    static* start(game, u, ctx) {
        if (ctx.skipShaInitStage) {
            return yield Promise.resolve(R.success);
        }

        console.log('SHA-INIT-STAGE');
        let result = yield u.on('useSha', game, ctx);
        return yield Promise.resolve(result);
    }
}

class ShaSelectTargetStage {
    static* start(game, u, ctx) {
        if (ctx.skipShaInitStage) {
            return yield Promise.resolve(R.success);
        }
        console.log('SHA-SELECT-TARGET-STAGE');

        let targetCount = 1;  // TODO: How many targets are required
        ctx.targets = new Set();

        game.lockUserCards(u, ctx.sourceCards);
        let result = yield game.waitFSM(u, FSM.get('requireSingleTarget', game, {
            cancelOnUncard: true,
            targetValidator: (command, ctx) => {
                let target = game.userByPk(command.params);
                return game.inAttackRange(u, target);
            }
        }), ctx);
        game.unlockUserCards(u, ctx.sourceCards);

        if (result.success) {
            ctx.targets.add(result.get());
            game.message([ctx.sourceUser, '对', ctx.targets, '使用', ctx.sourceCards,]);
            game.removeUserCards(ctx.sourceUser, ctx.sourceCards);
            yield u.on('usedSha', game, ctx);
        }

        return yield Promise.resolve(result);
    }
}

class ShaValidateStage {
    static* start(game, u, ctx) {
        console.log('SHA-VALIDATE-STAGE');
        let shaAble = true;
        if (!shaAble) {
            return yield Promise.resolve(R.abort);
        }
        ctx.shanAble = new Map();

        yield u.on('shaTarget', game, ctx);

        for (let t of ctx.targets) {
            yield t.on('beShaTarget', game, ctx);
        }

        ctx.damage = 1;
        return yield Promise.resolve(R.success);
    }
}

class ShaExecuteStage {
    static* start(game, u, ctx) {
        console.log('SHA-EXECUTE-STAGE');
        const targets = ctx.targets;
        // TODO: SHAN-able?
        for (let target of targets) {
            if (!ctx.shanAble.has(target) || ctx.shanAble.get(target)) {
                let result = yield target.on('requireShan', game, ctx);
                if (result.success) {
                    if (result instanceof R.CardResult) {
                        let cards = result.get();
                        game.message([target, '使用了', cards]);
                        game.removeUserCards(target, cards);
                        game.discardCards(cards);
                    }

                    ctx.shanPlayer = target;
                    yield u.on('usedShan', game, ctx);
                    yield u.on('shaBeenShan', game, ctx);
                } else {
                    yield target.on('damage', game, ctx);
                }
            } else {
                yield target.on('damage', game, ctx);
            }
        }

        game.discardCards(ctx.sourceCards);
        return yield Promise.resolve(R.success);
    }
}

const subStages = [
    ShaInitStage,
    ShaSelectTargetStage,
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
                    break; // 中止
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