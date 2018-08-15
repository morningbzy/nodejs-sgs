const C = require('../constants');
const R = require('../common/results');
const U = require('../utils');
const FSM = require('../common/fsm');
const cardManager = require('../cards');
const Skill = require('../skills');
const sgsCards = require('../cards/cards');
const EventListener = require('../common/eventListener');
const {SkillContext} = require('../context');

const ST = C.SELECT_TYPE;


class FigureBase extends EventListener {
    constructor(game) {
        super();
        this.pk = this.constructor.pk;
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
                delete info.figure;
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

    // 主动使用技能
    * useSkill(skill, game, ctx) {
        console.log(`|[F] USE SKILL ${skill.name}`);
        const oleState = skill.state;
        this.changeSkillState(skill, C.SKILL_STATE.FIRING);
        let result = yield this[skill.handler](game, ctx);
        this.changeSkillState(skill, oleState);
        return yield Promise.resolve(result);
    }

    // 被动出发技能
    * triggerSkill(skill, game, ctx) {
        console.log(`|[F] TRIGGER SKILL ${skill.name}`);
        const oleState = skill.state;
        this.changeSkillState(skill, C.SKILL_STATE.FIRING);
        let result = yield this[skill.handler](game, ctx);
        this.changeSkillState(skill, oleState);
        return yield Promise.resolve(result);
    }

    * on(event, game, ctx) {
        console.log(`|<F> ON ${this.name} ${event}`);
        return yield super.on(event, game, ctx);
    }

    distanceFrom(game, ctx, info) {
        return 0;
    }

    distanceTo(game, ctx, info) {
        return 0;
    }

    attackRange(game, ctx, info) {
        return 0;
    }

    filterCard(card) {
        return card;
    }
}


// 魏
class CaoCao extends FigureBase {
// 【曹操】 魏，男，4血 【奸雄】【护驾】
    constructor(game) {
        super();
        this.name = '曹操';
        this.country = C.COUNTRY.WEI;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            WEI001s01: new Skill(this, {
                pk: 'WEI001s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '奸雄',
                desc: '你可以立即获得对你成伤害的牌。',
                handler: 's1',
            }),
            WEI001s02: new Skill(this, {
                pk: 'WEI001s02',
                style: C.SKILL_STYLE.ZHUGONG,
                name: '护驾',
                desc: '【主公技】当你需要使用（或打出）一张【闪】时，'
                + '你可以发动护驾。所有“魏”势力角色按行动顺序依次选择是'
                + '否打出一张【闪】“提供”给你（然后视为由你使用或打出），'
                + '直到有一名角色或没有任何角色决定如此做时为止。',
                handler: 's2',
            }),
        };
    }

    * s1(game, ctx) {
        let cards = U.toArray(ctx.i.damage.srcCard);
        for (let card of cards) {
            if (ctx.phaseCtx.allHandlingCards().includes(card)) {
                game.message([this.owner, '获得了', cardManager.unfakeCard(card)]);
                game.addUserCards(this.owner, card);
                ctx.handlingCards.delete(card);
            }
        }
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
                    if (result instanceof R.CardResult) {
                        let card = result.get();
                        game.message([u, '替曹操打出了', card]);
                        yield game.removeUserCards(u, card, true);
                    } else {
                        game.message([u, '替曹操打出了【闪】']);
                    }

                    return yield Promise.resolve(result);
                }
            }
        }
        return yield Promise.resolve(R.fail);
    }

    * damage(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否使用技能【奸雄】？`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.triggerSkill(this.skills.WEI001s01, game, ctx);
        }
        return yield Promise.resolve(R.success);
    }

    * requireShan(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否使用技能【护驾】？`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.triggerSkill(this.skills.WEI001s02, game, ctx);
        }
        return yield Promise.resolve(R.fail);
    }
}


class SiMaYi extends FigureBase {
// 【司马懿】 魏，男，3血 【反馈】【鬼才】
    constructor(game) {
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

    // 【反馈】
    * s1(game, ctx) {
        const u = this.owner;
        if (ctx.i.sourceUser) {
            let cardCandidates = ctx.i.sourceUser.cardCandidates({
                includeJudgeCards: false,
            });
            u.reply(`CARD_CANDIDATE ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
            let command = yield game.wait(u, {
                validCmds: ['CARD_CANDIDATE'],
                validator: (command) => {
                    const pks = command.params;
                    return pks.length === 1;
                },
            });
            u.reply(`CLEAR_CANDIDATE`);
            u.popRestoreCmd('CARD_CANDIDATE');

            let card = game.cardByPk(command.params);
            yield game.removeUserCards(ctx.i.sourceUser, card);
            game.addUserCards(u, card);
            game.message([u, '从', ctx.i.sourceUser, '处获得1张牌']);
        }
        return yield Promise.resolve(R.success);
    }

    // 【鬼才】
    * s2(game, ctx) {
        let result = yield this.owner.requireCard(game, ctx, sgsCards.CardBase);
        if (result.success) {
            game.discardCards(ctx.i.judgeCard);
            ctx.handlingCards.delete(ctx.i.judgeCard);

            ctx.i.judgeCard = result.get();
            yield game.removeUserCards(this.owner, ctx.i.judgeCard);
            ctx.handlingCards.add(ctx.i.judgeCard);
            game.broadcastPopup(`INSTEAD ${this.name} ${ctx.i.judgeCard.toJsonString()}`);
            game.message([this.owner, '使用', ctx.i.judgeCard, '替换了判定牌']);
        }
        return yield Promise.resolve(result);
    }

    * damage(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否使用技能【反馈】`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.triggerSkill(this.skills.WEI002s01, game, ctx);
        }
        return yield Promise.resolve(R.fail);
    }

    * beforeJudgeEffect(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否打出一张手牌代替判定牌？`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.triggerSkill(this.skills.WEI002s02, game, ctx);
        }
        return yield Promise.resolve(R.fail);
    }
}


class ZhenJi extends FigureBase {
// 【甄姬】 魏，女，3血 【倾国】【洛神】
    constructor(game) {
        super();
        this.name = '甄姬';
        this.country = C.COUNTRY.WEI;
        this.gender = C.GENDER.FEMALE;
        this.hp = 3;

        this.skills = {
            WEI007s01: new Skill(this, {
                pk: 'WEI007s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '倾国',
                desc: '你可以将一张黑色的手牌当【闪】使用或打出。',
                handler: 's1',
                fsmOpt: {
                    cardCount: ST.SINGLE,
                    targetCount: ST.NONE,
                    cardValidator: (command, info) => {
                        let card = game.cardByPk(command.params);
                        return (this.owner.hasCard(card)
                            && [C.CARD_SUIT.SPADE, C.CARD_SUIT.CLUB].includes(card.suit));
                    },
                },
            }),
            WEI007s02: new Skill(this, {
                pk: 'WEI007s02',
                style: C.SKILL_STYLE.NORMAL,
                name: '洛神',
                desc: '准备阶段开始时，你可以进行判定，若结果为黑色，你获得生效' +
                '后的判定牌且你可以重复此流程。',
                handler: 's2',
            }),
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        let cards;
        let result = yield ctx.skill.init(game, ctx);
        if (result.success) {
            cards = result.get().card;
        } else {
            return yield Promise.resolve(R.fail);
        }

        let fakeCard = cardManager.fakeCards(cards, {asClass: sgsCards.Shan});
        game.message([u, '使用技能【倾国】把', cards, '当作', fakeCard, '使用']);
        return yield Promise.resolve(new R.CardResult().set(fakeCard));
    }

    * s2(game, ctx) {
        const u = this.owner;
        game.message([u, '发动了【洛神】']);
        let result = yield game.doJudge(u,
            (card) => [C.CARD_SUIT.SPADE, C.CARD_SUIT.CLUB].includes(card.suit)
        );
        game.message([u, '判定【洛神】为', result.get(), '判定', result.success ? '生效' : '未生效']);
        if (result.success) {
            let card = result.get();
            ctx.handlingCards.delete(card);
            game.addUserCards(u, card);
            game.message([u, '获得卡牌', card]);
        }
        return result;
    }

    * roundPreparePhaseStart(game, phaseCtx) {
        const u = this.owner;
        let more = true;
        while (more) {
            let command = yield game.waitConfirm(u, `是否发动技能【洛神】？`);
            if (command.cmd === C.CONFIRM.Y) {
                let result = yield this.triggerSkill(this.skills.WEI007s02, game, phaseCtx);
                more = result.success;
            } else {
                more = false;
            }

        }
    }

    * requireShan(game, ctx) {
        this.changeSkillState(this.skills.WEI007s01, C.SKILL_STATE.ENABLED);
    }

    * unrequireShan(game, ctx) {
        this.changeSkillState(this.skills.WEI007s01, C.SKILL_STATE.DISABLED);
    }
}


// 蜀
class LiuBei extends FigureBase {
// 【刘备】 蜀，男，4血 【仁德】【激将】
    constructor(game) {
        super();
        this.name = '刘备';
        this.pk = LiuBei.pk;
        this.country = C.COUNTRY.SHU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            SHU001s01: new Skill(this, {
                pk: 'SHU001s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '仁德',
                desc: '出牌阶段，你可以将至少一张手牌交给一名其他角色，'
                + '若你在此阶段内给出的牌首次达到两张，你回复1点体力。',
                handler: 's1',
                fsmOpt: {
                    cardCount: ST.ONE_OR_MORE,
                    targetCount: ST.SINGLE,
                }
            }),
            SHU001s02: new Skill(this, {
                pk: 'SHU001s02',
                style: C.SKILL_STYLE.ZHUGONG,
                name: '激将',
                desc: '【主公技】每当你需要使用或打出一张【杀】时，你可以令'
                + '其他蜀势力角色选择是否打出一张【杀】（视为由你使用或打出）。',
                handler: 's2',
                fsmOpt: {
                    cardCount: ST.NONE,
                    targetCount: (ctx) => {
                        return ST.SINGLE + (ctx.i.requireCard ? ST.NONE : ST.SINGLE);
                    },
                    targetValidator: (command, info) => {
                        let target = game.userByPk(command.params);
                        if (info.targets.size < 1 || info.parentCtx.i.requireCard) {
                            return (command.uid !== target.id
                                && target.figure.country === C.COUNTRY.SHU);
                        } else {
                            return (command.uid !== target.id
                                && game.inAttackRange(info.sourceUser, target));
                        }
                    },
                }
            }),
        };
    }

    // 仁德
    * s1(game, ctx) {
        const u = this.owner;
        let cards = ctx.i.cards;
        let target = U.toSingle(ctx.i.targets);

        game.message([u, '使用技能【仁德】，将', cards, '交给', target]);

        yield game.removeUserCards(u, cards);
        game.addUserCards(target, cards);

        if (ctx.phaseCtx.i.s1_param < 2 && (ctx.phaseCtx.i.s1_param + cards.length) >= 2) {
            ctx.i.heal = 1;
            yield u.on('heal', game, ctx);
        }
        ctx.phaseCtx.i.s1_param += cards.length;
        return yield Promise.resolve(R.success);
    }

    // 激将
    * s2(game, ctx) {
        const u = this.owner;
        let targets = U.toArray(ctx.i.targets);
        if (targets.length <= 0) {
            let result = yield ctx.skill.init(game, ctx);
            if (result.success) {
                targets = result.get().target;
            } else {
                return yield Promise.resolve(R.fail);
            }
        }

        u.reply('UNSELECT ALL');
        let target = targets.shift();
        let shaTarget = targets;
        let result;

        if (shaTarget.length > 0) {
            game.message([u, '使用技能【激将】，请', target, '为其出【杀】，对', shaTarget, '使用。']);
        } else {
            game.message([u, '使用技能【激将】，请', target, '为其出【杀】。']);
        }
        let command = yield game.waitConfirm(target, `刘备使用技能【激将】，是否为其出【杀】？`);
        if (command.cmd === C.CONFIRM.Y) {
            result = yield target.on('requireSha', game, ctx);
            if (result.success) {
                let cards = result.get();
                game.message([target, '替', u, '打出了', cards]);
                yield game.removeUserCards(target, cards);
                if (shaTarget.length > 0) {
                    result = yield Promise.resolve(new R.CardTargetResult().set(cards, shaTarget));
                } else {
                    result = yield Promise.resolve(new R.CardResult().set(cards));
                }
                this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.DISABLED);
            } else {
                result = R.fail;
            }
        } else {
            result = R.fail;
        }
        return yield Promise.resolve(result);
    }

    * roundPlayPhaseStart(game, phaseCtx) {
        phaseCtx.i.s1_param = 0;  // 本阶段【仁德】送出的牌数
        this.changeSkillState(this.skills.SHU001s01, C.SKILL_STATE.ENABLED);
        this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.ENABLED);
    }

    * play(game, ctx) {
        if (ctx.phaseCtx.i.shaCount < ctx.i.sourceUser.getShaLimit()) {
            this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.ENABLED);
        } else {
            this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.DISABLED);
        }
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        this.changeSkillState(this.skills.SHU001s01, C.SKILL_STATE.DISABLED);
        this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.DISABLED);
    }

    * requireSha(game, ctx) {
        this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.ENABLED);
    }

    * unrequireSha(game, ctx) {
        this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.DISABLED);
    }
}


class GuanYu extends FigureBase {
// 【关羽】 蜀，男，4血
// 【武圣】
    constructor(game) {
        super();
        this.name = '关羽';
        this.pk = GuanYu.pk;
        this.country = C.COUNTRY.SHU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            SHU002s01: new Skill(this, {
                pk: 'SHU002s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '武圣',
                desc: '你可以将你的任意一张红色牌当【杀】使用或打出。',
                handler: 's1',
                fsmOpt: {
                    cardCount: ST.SINGLE,
                    targetCount: (ctx) => {
                        return ctx.i.requireCard ? ST.NONE : ST.SINGLE;
                    },
                    cardValidator: [
                        FSM.BASIC_VALIDATORS.ownCardValidator,
                        FSM.BASIC_VALIDATORS.buildCardSuitValidator('RED'),
                    ],
                    targetValidator: [
                        FSM.BASIC_VALIDATORS.notMeTargetValidator,
                        (command, info) => {
                            let u = info.sourceUser;
                            let target = info.game.userByPk(command.params);
                            return info.game.inAttackRange(u, target, info.parentCtx, {
                                planToRemove: info.cards,
                            });
                        },
                    ],
                },
            }),
        };
    }

    * s1(game, ctx) {
        if (!ctx.i.cards) {
            let result = yield ctx.skill.init(game, ctx);
            if (result.success) {
                ctx.i.cards = U.toArray(result.get().card);
                ctx.i.targets = result.get().target;
            } else {
                return yield Promise.resolve(R.fail);
            }
        }
        const u = this.owner;
        let cards = ctx.i.cards;
        let fakeCard = cardManager.fakeCards(cards, {asClass: sgsCards.Sha});
        let result;
        let targets = ctx.i.targets;
        if (targets.length > 0) {
            result = new R.CardTargetResult().set(fakeCard, targets);
            game.message([u, '使用技能【武圣】把', cards, '当作', fakeCard, '对', targets, '使用']);
        } else {
            result = new R.CardResult().set(fakeCard);
            game.message([u, '使用技能【武圣】把', cards, '当作', fakeCard, '使用']);
        }

        // yield game.removeUserCards(u, cards);
        this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.DISABLED);
        return yield Promise.resolve(result);
    }

    * roundPlayPhaseStart(game, phaseCtx) {
        this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.ENABLED);
    }

    * play(game, ctx) {
        if (ctx.phaseCtx.i.shaCount < ctx.i.sourceUser.getShaLimit()) {
            this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.ENABLED);
        } else {
            this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.DISABLED);
        }
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.DISABLED);
    }

    * requireSha(game, ctx) {
        this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.ENABLED);
    }

    * unrequireSha(game, ctx) {
        this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.DISABLED);
    }
}


class ZhaoYun extends FigureBase {
// 【赵云】 蜀，男，4血
// 【龙胆】
    constructor(game) {
        super();
        this.name = '赵云';
        this.pk = ZhaoYun.pk;
        this.country = C.COUNTRY.SHU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            SHU005s01: new Skill(this, {
                pk: 'SHU005s01',
                style: C.SKILL_STYLE.SUODING,
                name: '龙胆',
                desc: '你可以将一张【杀】当【闪】，一张【闪】当【杀】使用或打出。',
                handler: 's1',
                fsmOpt: {
                    cardCount: ST.SINGLE,
                    targetCount: (ctx) => {
                        return ctx.i.requireCard ? ST.NONE : ST.SINGLE;
                    },
                    cardValidator: (command, info) => {
                        const skill = (info.parentCtx instanceof SkillContext)
                            ? info.parentCtx.skill
                            : info.parentCtx.i.sourceUser.figure.skills.SHU005s01;
                        const {originClass} = skill.info;
                        let card = game.cardByPk(command.params);
                        return (this.owner.hasCard(card) && card instanceof originClass);
                    },
                },
            }),
        };
    }

    * s1(game, ctx) {
        if (!ctx.i.cards) {
            let result = yield ctx.skill.init(game, ctx);
            if (result.success) {
                ctx.i.cards = U.toArray(result.get().card);
                ctx.i.targets = result.get().target;
            } else {
                return yield Promise.resolve(R.fail);
            }
        }
        const u = this.owner;
        let cards = ctx.i.cards;
        let fakeClass = ctx.skill.info.fakeClass;
        let fakeCard = cardManager.fakeCards(cards, {asClass: fakeClass});
        let result;
        let targets = ctx.i.targets;
        if (targets.length > 0) {
            result = new R.CardTargetResult().set(fakeCard, targets);
            game.message([u, '使用技能【龙胆】把', cards, '当作', fakeCard, '对', targets, '使用']);
        } else {
            result = new R.CardResult().set(fakeCard);
            game.message([u, '使用技能【龙胆】把', cards, '当作', fakeCard, '使用']);
        }
        ctx.skill.info = null;
        this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.DISABLED);
        return yield Promise.resolve(result);
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        this.skills.SHU005s01.info = null;
        this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.DISABLED);
    }

    * play(game, ctx) {
        if (ctx.phaseCtx.i.shaCount < ctx.i.sourceUser.getShaLimit()) {
            this.skills.SHU005s01.info = {originClass: sgsCards.Shan, fakeClass: sgsCards.Sha};
            this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.ENABLED);
        } else {
            this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.DISABLED);
        }
    }

    * requireSha(game, ctx) {
        this.skills.SHU005s01.info = {originClass: sgsCards.Shan, fakeClass: sgsCards.Sha};
        this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.ENABLED);
    }

    * requireShan(game, ctx) {
        this.skills.SHU005s01.info = {originClass: sgsCards.Sha, fakeClass: sgsCards.Shan};
        this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.ENABLED);
    }

    * unrequireSha(game, ctx) {
        this.skills.SHU005s01.info = null;
        this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.DISABLED);
    }

    * unrequireShan(game, ctx) {
        this.skills.SHU005s01.info = null;
        this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.DISABLED);
    }
}


class MaChao extends FigureBase {
// 【马超】 蜀，男，4血
// 【马术】
// 【铁骑】
    constructor(game) {
        super();
        this.name = '马超';
        this.pk = MaChao.pk;
        this.country = C.COUNTRY.SHU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            SHU006s01: {
                pk: 'SHU006s01',
                style: C.SKILL_STYLE.SUODING,
                name: '马术',
                desc: '锁定技，你计算与其他角色的距离-1。',
                handler: 's1',
            },
            SHU006s02: {
                pk: 'SHU006s02',
                style: C.SKILL_STYLE.NORMAL,
                name: '铁骑',
                desc: '当你使用【杀】指定一个目标后，你可以判定，若结果为' +
                '红色，该角色不能使用【闪】相应此【杀】。',
                handler: 's2',
            },
        };
    }

    distanceFrom(game, ctx, info) {
        return -1;
    }

    * s2(game, ctx) {
    }

    * afterShaTarget(game, ctx) {
        const u = this.owner;

        for (let t of ctx.i.targets) {
            let command = yield game.waitConfirm(u, `指定${t.figure.name}为【杀】的目标，是否发动技能【铁骑】？`);
            if (command.cmd === C.CONFIRM.Y) {
                game.message([u, '指定', t, '为【杀】的目标，发动技能【铁骑】。']);
                let result = yield game.doJudge(u,
                    (card) => [C.CARD_SUIT.HEART, C.CARD_SUIT.DIAMOND].includes(card.suit)
                );
                game.message([u, '判定【铁骑】为', result.get(), '，判定', result.success ? '生效' : '未生效']);
                ctx.i.shanAble.set(t, !result.success);
            }
        }
        return yield Promise.resolve(R.success);
    }
}


// 吴
class DaQiao extends FigureBase {
// 【大乔】 吴，女，3血 【国色】【流离】
    constructor(game) {
        super();
        this.name = '大乔';
        this.pk = DaQiao.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.FEMALE;
        this.hp = 3;
        this.skills = {
            WU006s01: new Skill(this, {
                pk: 'WU006s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '国色',
                desc: '出牌阶段，你可以将你任意方块花色的牌当【乐不思蜀】'
                + '使用。',
                handler: 's1',
                fsmOpt: {
                    cardCount: ST.SINGLE,
                    targetCount: ST.SINGLE,
                    cardValidator: [
                        FSM.BASIC_VALIDATORS.ownCardValidator,
                        FSM.BASIC_VALIDATORS.buildCardSuitValidator(C.CARD_SUIT.DIAMOND),
                    ],
                },
            }),
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
        const u = this.owner;
        let cards = ctx.i.cards;
        let targets = ctx.i.targets;
        let fakeCard = cardManager.fakeCards(cards, {asClass: sgsCards.LeBuSiShu});
        game.message([u, '把', cards, '当作', fakeCard, '使用']);
        return yield Promise.resolve(new R.CardTargetResult().set(fakeCard, targets));
    }

    * s2(game, ctx) {
        const u = this.owner;
        let result = yield game.waitFSM(u, FSM.get('requireSingleCardAndTarget', game, ctx, {
            cardValidator: FSM.BASIC_VALIDATORS.ownCardValidator,
            targetValidator: (command) => {
                let target = game.userByPk(command.params);
                return target !== ctx.i.sourceUser && game.inAttackRange(u, target);
            }
        }), ctx);

        u.reply('UNSELECT ALL');

        if (result.success) {
            let card = result.get().card;
            let target = result.get().target;

            yield game.removeUserCards(u, card, true);

            let targets = U.toSet(ctx.i.targets);
            targets.delete(u);
            targets.add(target);
            ctx.i.targets = U.toArray(targets);
            if (ctx.i.shanAble.has(u)) {
                ctx.i.shanAble.set(target, ctx.i.shanAble.get(u));
                ctx.i.shanAble.delete(u);
            }
            game.message([u, '弃置了', card, '将【杀】的目标转移给', target]);
            return yield Promise.resolve(R.success);
        } else {
            return yield Promise.resolve(R.fail);
        }
    }

    * roundPlayPhaseStart(game, phaseCtx) {
        this.changeSkillState(this.skills.WU006s01, C.SKILL_STATE.ENABLED);
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        this.changeSkillState(this.skills.WU006s01, C.SKILL_STATE.DISABLED);
    }

    * beShaTarget(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否使用技能【流离】`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.triggerSkill(this.skills.WU006s02, game, ctx);
        }
        return yield Promise.resolve(R.fail);
    }
}


class XiaoQiao extends FigureBase {
// 【小乔】 吴，女，3血
// 【天香】
// 【红颜】
    constructor(game) {
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

    filterCard(card) {
        if (C.CARD_SUIT.SPADE === card.suit) {
            return cardManager.fakeCards(card, {asSuit: C.CARD_SUIT.HEART});
        } else {
            return card;
        }
    }

    * s1(game, ctx) {
        const u = this.owner;

        let result = yield game.waitFSM(u, FSM.get('requireSingleCardAndTarget', game, ctx, {
            cardValidator: (command) => {
                let card = game.cardByPk(command.params);
                return (u.hasCard(card) && [C.CARD_SUIT.SPADE, C.CARD_SUIT.HEART].includes(card.suit));
            }
        }), ctx);

        if (result.success) {
            let card = result.get().card;
            let t = result.get().target;

            yield game.removeUserCards(u, card, true);
            game.message([u, '弃置了', card, '将伤害转移给', t]);

            yield t.on('damage', game, ctx);
            game.dispatchCards(t, t.maxHp - t.hp);
            game.message([t, '受到', ctx.i.damage.value, '点伤害，并获得了', t.maxHp - t.hp, '张牌']);

            return yield Promise.resolve(R.success);
        } else {
            return yield Promise.resolve(R.fail);
        }
    }

    * beforeDamage(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否使用技能【天香】`);
        if (command.cmd === C.CONFIRM.Y) {
            let result = yield this.triggerSkill(this.skills.WU011s01, game, ctx);
            if (result.success) {
                return yield Promise.resolve(R.abort);
            }
        }
        return yield Promise.resolve(R.fail);
    }

    * judge(game, ctx) {
        ctx.i.judgeCard = this.filterCard(ctx.i.judgeCard);
    }
}


class SunShangXiang extends FigureBase {
// 【孙尚香】 吴，女，3血
// 【结姻】
// 【枭姬】
    constructor(game) {
        super();
        this.name = '孙尚香';
        this.pk = SunShangXiang.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.FEMALE;
        this.hp = 3;
        this.skills = {
            WU008s01: new Skill(this, {
                pk: 'WU008s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '结姻',
                desc: '出牌阶段，你可以弃置两张手牌并选择一名已受伤的男性角色，' +
                '令你与其各回复1点体力。每阶段限用一次。',
                handler: 's1',
                fsmOpt: {
                    cardCount: 2,
                    targetCount: ST.SINGLE,
                    cardValidator: (command) => {
                        let card = game.cardByPk(command.params);
                        return this.owner.hasCard(card);
                    },
                    targetValidator: (command) => {
                        const t = game.userByPk(command.params);
                        return (t.gender === C.GENDER.MALE && t.hp < t.maxHp);
                    }
                },
            }),
            WU008s02: {
                pk: 'WU008s02',
                style: C.SKILL_STYLE.NORMAL,
                name: '枭姬',
                desc: '当你失去装备区里的一张装备牌时，你可以摸两张牌。',
                handler: 's2',
            },
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        let cards = ctx.i.cards;
        let target = U.toSingle(ctx.i.targets);
        ctx.i.heal = 1;

        yield game.removeUserCards(u, cards, true);
        game.message([u, '使用技能【结姻】，弃置手牌', cards, '与', target, '各回复1点体力']);
        yield u.on('heal', game, ctx);
        yield target.on('heal', game, ctx);

        ctx.phaseCtx.i.usedWU008s01 = true;

        return yield Promise.resolve(R.success);
    }

    * play(game, ctx) {
        this.changeSkillState(this.skills.WU008s01, C.SKILL_STATE.DISABLED);

        if (!ctx.phaseCtx.i.usedWU008s01) {
            for (let u of game.userRound()) {
                if (u.gender === C.GENDER.MALE && u.hp < u.maxHp) {
                    this.changeSkillState(this.skills.WU008s01, C.SKILL_STATE.ENABLED);
                    break;
                }
            }
        }
    }

    * roundPlayPhaseStart(game, phaseCtx) {
        phaseCtx.i.usedWU008s01 = false;
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        this.changeSkillState(this.skills.WU008s01, C.SKILL_STATE.DISABLED);
    }

    * unequip(game, ctx) {
        const u = this.owner;
        let command = yield game.waitConfirm(u, `是否发动技能【枭姬】？`);
        if (command.cmd === C.CONFIRM.Y) {
            game.dispatchCards(u, 2);
            game.message([u, '发动技能【枭姬】获得2张牌']);
        }
    }
}


class ZhouTai extends FigureBase {
// 【周泰】 吴，男，4血 【不屈】【激愤】
    constructor(game) {
        super();
        this.name = '周泰';
        this.pk = ZhouTai.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            WU013s01: {
                pk: 'WU013s01',
                style: C.SKILL_STYLE.SUODING,
                name: '不屈',
                desc: '锁定技，当你处于濒死状态时，亮出牌堆顶的一张牌并' +
                '置于你的武将牌上，若此牌的点数与你武将牌上已有的牌点数' +
                '均不同，则你回复至1体力。若出现相同点数，将此牌置入弃牌' +
                '堆；只要你的武将牌上有牌，你的手牌上限便与这些牌数量相等。',
                handler: 's1',
            },
            WU013s02: {
                pk: 'WU013s02',
                style: C.SKILL_STYLE.SUODING,
                name: '激愤',
                desc: '当一名角色的手牌被其他角色弃置或获得时，你可以失去' +
                '1点体力，然后其摸两张牌。',
                handler: 's2',
            },
        };
    }

    maxHandCards() {
        return this.owner.markers.length || this.owner.hp;
    }

    * s1(game, ctx) {
        const u = this.owner;
        let card = U.toSingle(game.cardManager.shiftCards(1));
        game.broadcastPopup(`CARD ${this.name} 不屈牌 ${card.toJsonString()}`);
        game.message([u, `获得不屈牌`, card]);

        if (!u.markers.map(marker => marker.number).includes(card.number)) {
            yield game.pushUserMarker(u, card);
            yield game.changeUserProperty(u, 'hp', 1);
            u.state = C.USER_STATE.ALIVE;
            game.broadcastUserInfo(u);
            game.message([u, '新增不屈牌', card, '，并回复至1体力']);
        } else {
            game.message([u, '的不屈牌', card, '已有相同点数']);
            game.discardCards(card);
        }
    }

    * dying(game, ctx) {
        yield this.s1(game, ctx);
    }
}

CaoCao.pk = 'WEI001';
SiMaYi.pk = 'WEI002';
ZhenJi.pk = 'WEI007';

LiuBei.pk = 'SHU001';
GuanYu.pk = 'SHU002';
ZhaoYun.pk = 'SHU005';
MaChao.pk = 'SHU006';

DaQiao.pk = 'WU006';
SunShangXiang.pk = 'WU008';
XiaoQiao.pk = 'WU011';
ZhouTai.pk = 'WU013';

figures = {
    CaoCao,
    SiMaYi,
    ZhenJi,

    LiuBei,
    GuanYu,
    ZhaoYun,
    MaChao,

    DaQiao,
    XiaoQiao,
    SunShangXiang,
    ZhouTai,
};

Object.keys(figures).map((k) => {
    exports[k] = figures[k];
    exports[figures[k].pk] = figures[k];
});
