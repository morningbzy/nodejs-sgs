class ShaInitStage {
    static* start(game, u, si) {
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

        if(command.cmd === 'CANCEL') {
            return yield Promise.resolve('cancel')
        }
        let targetPks = command.params;
        si.sourceUser = u;
        si.targets = game.usersByPk(targetPks);
        si.damage = 1;
    }
}

class ShaValidateStage {
    static* start(game, u, si) {
        console.log('SHA-VALIDATE-STAGE');
    }
}

class ShaExecuteStage {
    static* start(game, u, si) {
        console.log('SHA-EXECUTE-STAGE');
        const targets = si.targets;

        // TODO: SHAN-able?
        let shanAble = true;
        if (shanAble) {
            for (let target of targets) {
                let shan = yield target.on('requireShan', game, si);
                if (shan) {
                    //
                } else {
                    yield target.on('damage', game, si);
                }
            }
        }

        game.removeUserCards(si.sourceUser, si.sourceCards);
        game.discardCards(si.sourceCards);
    }
}

const subStages = [
    ShaInitStage,
    ShaValidateStage,
    ShaExecuteStage,
];

class ShaStage {
    static stages(game, u, si) {
        return function* gen() {
            let result;
            for (let s of subStages) {
                result = yield s.start(game, u, si);
                if(result === 'cancel') {
                    // 中止
                    break;
                }
            }
            return yield Promise.resolve(result);
        };
    };

    static* start(game, u, si) {
        console.log('SHA-STAGE');
        return yield this.stages(game, u, si);
    }
}

module.exports = ShaStage;