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
        console.log(`|<F> SKILL ${skill.name}`);
        const oleState = skill.state;
        this.changeSkillState(skill, C.SKILL_STATE.FIRING);
        let result = yield this[skill.handler](game, ctx);
        this.changeSkillState(skill, oleState);
        return result;
    }

    * on(event, game, ctx) {
        console.log(`|<F> ON ${this.name} ${event}`);
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
                desc: '主公技，当你需要使用（或打出）一张【闪】时，'
                + '你可以发动护驾。所有“魏”势力角色按行动顺序依次选择是'
                + '否打出一张【闪】“提供”给你（然后视为由你使用或打出），'
                + '直到有一名角色或没有任何角色决定如此做时为止。',
                handler: 's2',
            },
        };
    }

    * s1(game, ctx) {
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

    * demage(game, ctx) {
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
        result.set(cards, sgsCards.Sha);
        return yield Promise.resolve(result);
    }

    * play(game, ctx) {
        if (this.owner.shaCount > 0) {
            this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.ENABLED);
        } else {
            this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.DISABLED);
        }
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
        game.removeUserCards(ctx.sourceUser, cards);
        game.addUserCards(this.owner, cards);
    }

    * s2(game, ctx) {
        return yield this.owner.requireCard(game, sgsCards.CardBase);
    }

    * demage(game, ctx) {
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


CaoCao.pk = 'WEI001';
GuanYu.pk = 'SHU002';
SiMaYi.pk = 'WEI002';

figures = {
    CaoCao,
    GuanYu,
    SiMaYi,
};

const figureSet = {};

Object.keys(figures).map((k) => {
    figureSet[figures[k].pk] = figures[k];
});

module.exports = Object.assign(figures, {figureSet});
