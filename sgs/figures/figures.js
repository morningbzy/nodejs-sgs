const C = require('../constants');
const R = require('../common/results');
const utils = require('../utils');
const cardManager = require('../cards');
const sgsCards = require('../cards/cards');
const EventListener = require('../common/eventListener');


class FigureBase extends EventListener {
    constructor() {
        super();
        this.owner = null;
    }

    toJson() {
        return {
            pk: this.pk,
            name: this.name,
            country: this.country,
            hp: this.hp,
            skills: Object.keys(this.skills).map((k) => {
                let info = Object.assign({}, this.skills[k]);
                delete info.handler;
                return info;
            }),
        };
    }

    toJsonString() {
        return JSON.stringify(this.toJson());
    }

    changeSkillState(skill, state) {
        skill.state = state;
        this.owner.reply(`USER_INFO ${this.owner.seatNum} ${this.owner.toJsonString(this.owner)}`, true);
    }

    * useSkill(skill, game, ctx) {
        console.log(`|[F] SKILL ${skill.name}`);
        game.message([this.owner, '使用技能', skill.name]);
        const oleState = skill.state;
        this.changeSkillState(skill, C.SKILL_STATE.FIRING);
        let result = yield this[skill.handler](game, ctx);
        this.changeSkillState(skill, oleState);
        return yield Promise.resolve(result);
    }

    * on(event, game, ctx) {
        console.log(`|[F] ON ${this.name} ${event}`);
        return yield super.on(event, game, ctx);
    }
}


class CaoCao extends FigureBase {
// 【曹操】 魏，男，4血
// 【奸雄】【护驾】
    constructor() {
        super();
        this.name = '曹操';
        this.pk = CaoCao.pk;
        this.country = C.COUNTRY.WEI;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            WEI001s01: {
                pk: 'WEI001s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '奸雄',
                desc: '你可以立即获得对你成伤害的牌。',
                handler: 's1',
            },
            WEI001s02: {
                pk: 'WEI001s02',
                style: C.SKILL_STYLE.ZHUGONG,
                name: '护驾',
                desc: '【主公技】当你需要使用（或打出）一张【闪】时，'
                + '你可以发动护驾。所有“魏”势力角色按行动顺序依次选择是'
                + '否打出一张【闪】“提供”给你（然后视为由你使用或打出），'
                + '直到有一名角色或没有任何角色决定如此做时为止。',
                handler: 's2',
            },
        };
    }

    * s1(game, ctx) {
        game.message([this.owner, '获得了', ctx.sourceCards]);
        game.addUserCards(this.owner, ctx.sourceCards);
        ctx.sourceCards = [];
        return yield Promise.resolve(R.success);
    }

    * s2(game, ctx) {
        for (let u of game.userRound()) {
            if (u.id === this.owner.id
                || u.figure.country !== C.COUNTRY.WEI) {
                continue;
            }

            let command = yield game.waitConfirm(u, `曹操使用技能【护驾】，是否为其出【闪】？`);
            if (command.cmd === C.CONFIRM.Y) {
                let result = yield u.on('requireShan', game, ctx);
                if (result.success) {
                    return yield Promise.resolve(result);
                }
            }
        }
        return yield Promise.resolve(R.fail);
    }

    * damage(game, ctx) {
        return yield this.useSkill(this.skills.WEI001s01, game, ctx);
    }

    * requireShan(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否使用技能【护驾】？`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.useSkill(this.skills.WEI001s02, game, ctx);
        }
        return yield Promise.resolve(R.fail);
    }
}


class LiuBei extends FigureBase {
// 【刘备】 蜀，男，4血
// 【仁德】
// 【激将】
    constructor() {
        super();
        this.name = '刘备';
        this.pk = LiuBei.pk;
        this.country = C.COUNTRY.SHU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            SHU001s01: {
                pk: 'SHU001s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '仁德',
                desc: '出牌阶段，你可以将至少一张手牌交给一名其他角色，'
                + '若你在此阶段内给出的牌首次达到两张，你回复1点体力。',
                handler: 's1',
            },
            SHU001s02: {
                pk: 'SHU001s02',
                style: C.SKILL_STYLE.ZHUGONG,
                name: '激将',
                desc: '【主公技】每当你需要使用或打出一张【杀】时，你可以令'
                + '其他蜀势力角色选择是否打出一张【杀】（视为由你使用或打出）。',
                handler: 's2',
            },
        };
    }

    * s2(game, ctx) {
        const u = this.owner;
        let command = yield game.wait(u, {
            validCmds: ['CANCEL', 'TARGET'],
            validator: (command) => {
                if (command.cmd === 'CANCEL') {
                    return true;
                }
                if (command.params.length !== 1) {
                    return false;
                }

                let targetPks = command.params;
                let targets = game.usersByPk(targetPks);

                if (C.COUNTRY.SHU !== Array.from(targets)[0].figure.country) {
                    return false;
                }

                return true;
            },
        });

        if (command.cmd === 'CANCEL') {
            return yield Promise.resolve(R.abort);
        }

        let targetPks = command.params;
        let target = Array.from(game.usersByPk(targetPks))[0];

        command = yield game.waitConfirm(target, `刘备使用技能【激将】，是否为其出【杀】？`);
        if (command.cmd === C.CONFIRM.Y) {
            let result = yield target.on('requireSha', game, ctx);
            if (result.success) {
                let cards = result.get().cards;
                game.message([target, '替', u, '打出了', cards]);
                game.removeUserCards(target, cards);
                return yield Promise.resolve(result);
            }
        }

        return yield Promise.resolve(R.fail);
    }

    * roundPlayPhaseStart(game, ctx) {
        this.changeSkillState(this.skills.SHU001s01, C.SKILL_STATE.ENABLED);
        this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.ENABLED);
    }

    * play(game, ctx) {
        if (this.owner.shaCount > 0) {
            this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.ENABLED);
        } else {
            this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.DISABLED);
        }
    }

    * roundPlayPhaseEnd(game, ctx) {
        this.changeSkillState(this.skills.SHU001s01, C.SKILL_STATE.DISABLED);
        this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.DISABLED);
    }

    * requireSha(game, ctx) {
        this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.ENABLED);
        let result = R.fail;
        while (result.fail) {
            let u = this.owner;
            let command = yield game.wait(u, {
                waitingTag: C.WAITING_FOR.SOMETHING,
                validCmds: ['CARD', 'SKILL', 'CANCEL'],
                validator: (command) => {
                    switch (command.cmd) {
                        case 'CARD':
                            let card = cardManager.getCards(command.params)[0];
                            if (command.params.length !== 1) {
                                return false;
                            }
                            if (!u.hasCard(card)) {
                                return false;
                            }
                            if (!(card instanceof sgsCards.Sha)) {
                                return false;
                            }
                            break;
                        case 'SKILL':
                            if (command.params[0] !== 'SHU001s02') {
                                return false;
                            }
                            let skill = u.figure.skills.SHU001s02;
                            if (skill.state !== C.SKILL_STATE.ENABLED) {
                                return false;
                            }
                            break;
                    }
                    return true;
                },
            });
            switch (command.cmd) {
                case 'CANCEL':
                    result = R.abort;
                    break;
                case 'CARD':
                    let cards = cardManager.getCards(command.params);
                    game.lockUserCards(u, cards);
                    result = new R.CardResult();
                    result.set(cards);
                    break;
                case 'SKILL':
                    let skill = u.figure.skills[command.params[0]];
                    result = yield u.figure.useSkill(skill, game, ctx);
                    break;
            }
        }
        this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.DISABLED);
        return yield Promise.resolve(result);
    }
}

class GuanYu extends FigureBase {
// 【关羽】 蜀，男，4血
// 【武圣】
    constructor() {
        super();
        this.name = '关羽';
        this.pk = GuanYu.pk;
        this.country = C.COUNTRY.SHU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            SHU002s01: {
                pk: 'SHU002s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '武圣',
                desc: '你可以将你的任意一张红色牌当【杀】使用或打出。',
                handler: 's1',
            },
        };
    }

    * s1(game, ctx) {
        let result;
        const u = this.owner;
        let command = yield game.wait(u, {
            waitingTag: C.WAITING_FOR.CARD,
            validCmds: ['CARD', 'CANCEL'],
            validator: (command) => {
                switch (command.cmd) {
                    case 'CANCEL':
                        return true;
                    case 'CARD':
                        if (command.params.length !== 1) {
                            return false;
                        }
                        let card = cardManager.getCards(command.params)[0];
                        if (!u.hasCard(card) || ![C.CARD_SUIT.HEART, C.CARD_SUIT.DIAMOND].includes(card.suit)) {
                            return false;
                        }
                        break;
                }
                return true;
            },
        });

        if (command.cmd === 'CANCEL') {
            return yield Promise.resolve(R.fail);
        }

        let cards = cardManager.getCards(command.params);
        game.lockUserCards(u, cards);
        result = new R.CardResult();
        let fakeCard = cardManager.fakeCards(cards, {asClass: sgsCards.Sha});
        result.set(fakeCard);
        game.message([u, '把', cards, '当作', fakeCard, '使用']);
        return yield Promise.resolve(result);
    }

    * roundPlayPhaseStart(game, ctx) {
        this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.ENABLED);
    }

    * play(game, ctx) {
        if (this.owner.shaCount > 0) {
            this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.ENABLED);
        } else {
            this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.DISABLED);
        }
    }

    * roundPlayPhaseEnd(game, ctx) {
        this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.DISABLED);
    }

    * requireSha(game, ctx) {
        this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.ENABLED);
        let result = R.fail;
        while (result.fail) {
            let u = this.owner;
            let command = yield game.wait(u, {
                waitingTag: C.WAITING_FOR.SOMETHING,
                validCmds: ['CARD', 'SKILL', 'CANCEL'],
                validator: (command) => {
                    switch (command.cmd) {
                        case 'CARD':
                            let card = cardManager.getCards(command.params)[0];
                            if (command.params.length !== 1) {
                                return false;
                            }
                            if (!u.hasCard(card)) {
                                return false;
                            }
                            if (!(card instanceof sgsCards.Sha)) {
                                return false;
                            }
                            break;
                        case 'SKILL':
                            if (command.params[0] !== 'SHU002s01') {
                                return false;
                            }
                            let skill = u.figure.skills.SHU002s01;
                            if (skill.state !== C.SKILL_STATE.ENABLED) {
                                return false;
                            }
                            break;
                    }
                    return true;
                },
            });
            switch (command.cmd) {
                case 'CANCEL':
                    result = R.abort;
                    break;
                case 'CARD':
                    let cards = cardManager.getCards(command.params);
                    game.lockUserCards(u, cards);
                    result = new R.CardResult();
                    result.set(cards);
                    break;
                case 'SKILL':
                    let skill = u.figure.skills[command.params[0]];
                    result = yield u.figure.useSkill(skill, game, ctx);
                    break;
            }
        }
        this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.DISABLED);
        return yield Promise.resolve(result);
    }
}


class SiMaYi extends FigureBase {
// 【司马懿】 蜀，男，3血
// 【反馈】
// 【鬼才】
    constructor() {
        super();
        this.name = '司马懿';
        this.pk = SiMaYi.pk;
        this.country = C.COUNTRY.WEI;
        this.gender = C.GENDER.MALE;
        this.hp = 3;
        this.skills = {
            WEI002s01: {
                pk: 'WEI002s0',
                style: C.SKILL_STYLE.NORMAL,
                name: '反馈',
                desc: '你可以立即从对你造成伤害的来源处获得一张牌。',
                handler: 's1',
            },
            WEI002s02: {
                pk: 'WEI002s02',
                style: C.SKILL_STYLE.NORMAL,
                name: '鬼才',
                desc: '在任意角色的判定牌生效前，你可以打出一张手牌代替之。',
                handler: 's2',
            },
        };
    }

    * s1(game, ctx) {
        // TODO equipment card can also be selected
        let cards = utils.shuffle(ctx.sourceUser.cards.values()).slice(0, 1);
        game.message([this.owner, '从', ctx.sourceUser, '处获得', cards.length, '张牌']);
        game.removeUserCards(ctx.sourceUser, cards);
        game.addUserCards(this.owner, cards);
    }

    * s2(game, ctx) {
        let result = yield this.owner.requireCard(game, sgsCards.CardBase);
        if (result.success) {
            ctx.judgeCard = result.get().cards;
            game.message([this.owner, '使用', ctx.judgeCard, '替换了判定牌']);
        }
        return yield Promise.resolve(result);
    }

    * damage(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否使用技能【反馈】`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.useSkill(this.skills.WEI002s01, game, ctx);
        }
        return yield Promise.resolve(R.fail);
    }

    * beforeJudgeEffect(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否打出一张手牌代替判定牌？`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.useSkill(this.skills.WEI002s02, game, ctx);
        }
        return yield Promise.resolve(R.fail);
    }
}


class DaQiao extends FigureBase {
// 【大乔】 吴，女，3血
// 【国色】
// 【流离】
    constructor() {
        super();
        this.name = '大乔';
        this.pk = DaQiao.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.FEMALE;
        this.hp = 3;
        this.skills = {
            WU006s01: {
                pk: 'WU006s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '国色',
                desc: '出牌阶段，你可以将你任意方块花色的牌当【乐不思蜀】'
                + '使用。',
                handler: 's1',
            },
            WU006s02: {
                pk: 'WU006s02',
                style: C.SKILL_STYLE.NORMAL,
                name: '流离',
                desc: '当你成为【杀】的目标时，你可以弃一张牌，'
                + '并将此【杀】转移给你攻击范围内的另一名角色。'
                + '（该角色不得是【杀】的使用者）',
                handler: 's2',
            },
        };
    }

    * s1(game, ctx) {
        let result;
        const u = this.owner;
        let command = yield game.wait(u, {
            validCmds: ['CANCEL', 'CARD'],
            validator: (command) => {
                if (command.cmd === 'CANCEL') {
                    return true;
                }
                let card = cardManager.getCards(command.params)[0];
                if (u.hasCard(card) && [C.CARD_SUIT.DIAMOND].includes(card.suit)) {
                    return true;
                }
                return false;
            },
        });

        if (command.cmd === 'CANCEL') {
            return yield Promise.resolve(R.fail);
        }

        let cards = cardManager.getCards(command.params);
        game.lockUserCards(u, cards);
        result = new R.CardResult();
        let fakeCard = cardManager.fakeCards(cards, {asClass: sgsCards.LeBuSiShu});
        result.set(fakeCard);
        return yield Promise.resolve(result);
    }

    * s2(game, ctx) {
        const u = this.owner;
        let result = yield u.requireCard(game, sgsCards.CardBase);
        if (!result.success) {
            return yield Promise.resolve(R.abort);
        }

        const cards = result.get().cards;
        game.lockUserCards(u, cards);
        let command = yield game.wait(u, {
            validCmds: ['CANCEL', 'TARGET'],
            validator: (command) => {
                if (command.cmd === 'CANCEL') {
                    return true;
                }
                if (command.params.length !== 1) {
                    return false;
                }
                // TODO: validate distance & target-able
                // const pks = command.params;
                return true;
            },
        });
        game.unlockUserCards(u, cards);

        if (command.cmd === 'CANCEL') {
            return yield Promise.resolve(R.abort);
        }

        game.removeUserCards(u, cards);
        game.discardCards(cards);

        let targetPks = command.params;
        ctx.targets.delete(u);
        let newTargets = game.usersByPk(targetPks);
        newTargets.forEach(t => ctx.targets.add(t));
        game.message([u, '弃置了', cards, '将【杀】的目标转移给', newTargets]);

        return yield Promise.resolve(R.success);
    }

    * roundPlayPhaseStart(game, ctx) {
        this.changeSkillState(this.skills.WU006s01, C.SKILL_STATE.ENABLED);
    }

    * roundPlayPhaseEnd(game, ctx) {
        this.changeSkillState(this.skills.WU006s01, C.SKILL_STATE.DISABLED);
    }

    * beShaTarget(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否使用技能【流离】`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.useSkill(this.skills.WU006s02, game, ctx);
        }
        return yield Promise.resolve(R.fail);
    }
}


class XiaoQiao extends FigureBase {
// 【小乔】 吴，女，3血
// 【天香】
// 【红颜】
    constructor() {
        super();
        this.name = '小乔';
        this.pk = XiaoQiao.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.FEMALE;
        this.hp = 3;
        this.skills = {
            WU011s01: {
                pk: 'WU011s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '天香',
                desc: '当你受到伤害时，你可以弃置一张红桃手牌并选择一名'
                + '其他角色。若如此做，你将此伤害转移给该角色，然后其'
                + '摸X张牌（X为该角色已损失的体力值）。',
                handler: 's1',
            },
            WU011s02: {
                pk: 'WU011s02',
                style: C.SKILL_STYLE.SUODING,
                name: '红颜',
                desc: '【锁定技】你的黑桃牌均视为红桃牌。',
                handler: 's2',
            },
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        let command = yield game.wait(u, {
            waitingTag: C.WAITING_FOR.CARD,
            waitingNum: 1,
            validCmds: ['CANCEL', 'CARD'],
            validator: (command) => {
                if (command.cmd === 'CANCEL') {
                    return true;
                }
                let card = cardManager.getCards(command.params)[0];
                if ([C.CARD_SUIT.SPADE, C.CARD_SUIT.HEART].includes(card.suit)) {
                    return true;
                }
                return false;
            },
        });

        if (command.cmd === 'CANCEL') {
            return yield Promise.resolve(R.abort);
        }

        let cards = cardManager.getCards(command.params);
        game.lockUserCards(u, cards);
        command = yield game.wait(u, {
            validCmds: ['CANCEL', 'TARGET'],
            validator: (command) => {
                if (command.cmd === 'CANCEL') {
                    return true;
                }
                if (command.params.length !== 1) {
                    return false;
                }
                return true;
            },
        });
        game.unlockUserCards(u, cards);

        if (command.cmd === 'CANCEL') {
            return yield Promise.resolve(R.abort);
        }

        game.removeUserCards(u, cards);
        game.discardCards(cards);
        let targetPks = command.params;
        ctx.targets = game.usersByPk(targetPks);
        game.message([u, '弃置了', cards, '将伤害转移给', ctx.targets]);

        for (let t of ctx.targets) {
            yield t.on('damage', game, ctx);
            game.dispatchCards(t, t.maxHp - t.hp);
        }

        return yield Promise.resolve(R.success);
    }

    * beforeDamage(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否使用技能【天香】`);
        if (command.cmd === C.CONFIRM.Y) {
            let result = yield this.useSkill(this.skills.WU011s01, game, ctx);
            if (result.success) {
                return yield Promise.resolve(R.abort);
            }
        }
        return yield Promise.resolve(R.fail);
    }

    * judge(game, ctx) {
        if (C.CARD_SUIT.SPADE === ctx.judgeCard.suit) {
            ctx.judgeCard = cardManager.fakeCards([ctx.judgeCard], {asSuit: C.CARD_SUIT.HEART});
        }
    }
}

CaoCao.pk = 'WEI001';
SiMaYi.pk = 'WEI002';

LiuBei.pk = 'SHU001';
GuanYu.pk = 'SHU002';

DaQiao.pk = 'WU006';
XiaoQiao.pk = 'WU011';

figures = {
    CaoCao,
    SiMaYi,

    LiuBei,
    GuanYu,

    DaQiao,
    XiaoQiao,
};

const figureSet = {};

Object.keys(figures).map((k) => {
    figureSet[figures[k].pk] = figures[k];
});

module.exports = Object.assign(figures, {figureSet});
