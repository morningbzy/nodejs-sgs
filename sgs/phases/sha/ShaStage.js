class ShaInitStage {
    static* start(game, u, si) {
        console.log('SHA-INIT-STAGE');
        let targetCount = 1;  // TODO: How many targets are required

        let command = yield game.wait(u, {
            validator: (command) => {
                if (command.uid !== u.id || command.cmd !== 'TARGET' || command.params.length !== targetCount) {
                    return false;
                }
                // TODO: validate distance & target-able
                // const pks = command.params;
                return true;
            },
        });

        let targetPks = command.params;
        si.source = u;
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
            for (let s of subStages) {
                yield s.start(game, u, si);
            }
        };
    };

    static* start(game, u) {
        console.log('SHA-STAGE');
        let stageInfo = {};
        yield this.stages(game, u, stageInfo);
    }
}

module.exports = ShaStage;