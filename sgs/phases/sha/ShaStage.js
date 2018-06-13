class ShaInitStage {
    static* start(game, u, ctx) {
        console.log('SHA-INIT-STAGE');
        let targetCount = 1;  // TODO: How many targets are required

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

        if (command.cmd === 'CANCEL') {
            return yield Promise.resolve('cancel');
        }
        let targetPks = command.params;
        ctx.sourceUser = u;
        ctx.targets = game.usersByPk(targetPks);
        ctx.damage = 1;
    }
}

class ShaValidateStage {
    static* start(game, u, ctx) {
        console.log('SHA-VALIDATE-STAGE');
        let shaAble = true;
        if (shaAble) {
            game.removeUserCards(ctx.sourceUser, ctx.sourceCards);
        } else {
            return yield Promise.resolve('cancel');
        }
    }
}

class ShaExecuteStage {
    static* start(game, u, ctx) {
        console.log('SHA-EXECUTE-STAGE');
        const targets = ctx.targets;

        // TODO: SHAN-able?
        let shanAble = true;
        if (shanAble) {
            for (let target of targets) {
                let result = yield target.on('requireShan', game, ctx);
                if (result) {
                    //
                } else {
                    yield target.on('damage', game, ctx);
                }
            }
        }
        game.discardCards(ctx.sourceCards);
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
                if (result === 'cancel') {
                    // 中止
                    break;
                }
            }
            return yield Promise.resolve(result);
        };
    };

    static* start(game, u, ctx) {
        console.log('SHA-STAGE');
        return yield this.stages(game, u, ctx);
    }
}

module.exports = ShaStage;