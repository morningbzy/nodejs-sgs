const R = require('../../common/results');
const FSM = require('../../common/stateMachines');


class ShaInitStage {
    static* start(game, ctx) {
        if (ctx.skipShaInitStage) {
            return yield Promise.resolve(R.success);
        }

        const u = ctx.sourceUser;

        console.log('SHA-INIT-STAGE');
        yield u.on('useSha', game, ctx);

        if (ctx.phaseContext.shaCount < 1) {
            console.log(`|<!> Use too many Sha`);
            return yield Promise.resolve(R.abort);
        }

        // let targetCount = 1;  // TODO: How many targets are required
        ctx.targets = new Set();

        let result = yield game.waitFSM(u, FSM.get('requireSingleTarget', game, {
            cancelOnUncard: true,
            targetValidator: (command, ctx) => {
                let target = game.userByPk(command.params);
                return game.inAttackRange(u, target);
            }
        }), ctx);

        if (result.success) {
            ctx.targets.add(result.get());
            game.message([ctx.sourceUser, '对', ctx.targets, '使用', ctx.sourceCards,]);
            yield game.removeUserCards(ctx.sourceUser, ctx.sourceCards);
        }

        return yield Promise.resolve(result);
    }
}

class ShaValidateStage {
    static* start(game, ctx) {
        console.log('SHA-VALIDATE-STAGE');
        const u = ctx.sourceUser;
        let shaAble = true;
        if (!shaAble) {
            return yield Promise.resolve(R.abort);
        }
        ctx.shanAble = new Map();

        // 指定目标时
        yield u.on('shaTarget', game, ctx);

        // 成为目标时
        for (let t of ctx.targets) {
            yield t.on('beShaTarget', game, ctx);
        }

        // 指定目标后
        yield u.on('afterShaTarget', game, ctx);

        // 成为目标后
        for (let t of ctx.targets) {
            yield t.on('afterBeShaTarget', game, ctx);
        }

        ctx.damage = 1;
        return yield Promise.resolve(R.success);
    }
}

class ShaExecuteStage {
    static* start(game, ctx) {
        console.log('SHA-EXECUTE-STAGE');

        const u = ctx.sourceUser;
        const targets = ctx.targets;
        for (let target of targets) {
            ctx.hit = true;  // 命中
            ctx.shaTarget = target;
            ctx.exDamage = 0;

            if (!ctx.shanAble.has(target) || ctx.shanAble.get(target)) {
                let result = yield target.on('requireShan', game, ctx);
                if (result.success) {
                    if (result instanceof R.CardResult) {
                        let cards = result.get();
                        game.message([target, '使用了', cards]);
                        yield game.removeUserCards(target, cards, true);
                    }

                    yield target.on('usedShan', game, ctx);
                    ctx.hit = false;
                    yield u.on('shaBeenShan', game, ctx);
                }
            }

            if (ctx.hit) {
                yield u.on('shaHitTarget', game, ctx);
                yield target.on('damage', game, ctx);
            }
        }

        yield u.on('usedSha', game, ctx);
        return yield Promise.resolve(R.success);
    }
}

const subStages = [
    ShaInitStage,
    ShaValidateStage,
    ShaExecuteStage,
];

class ShaStage {
    static stages(game, ctx) {
        return function* gen() {
            let result;
            for (let s of subStages) {
                result = yield s.start(game, ctx);
                if (result.abort) {
                    ctx.handlingCards.clear();
                    break; // 中止
                }
            }
            return yield Promise.resolve(R.success);
        };
    };

    static* start(game, ctx) {
        console.log('SHA-STAGE');
        return yield this.stages(game, ctx);
    }
}

module.exports = ShaStage;