const C = require('../constants');
const R = require('../common/results');
const U = require('../utils');
const FSM = require('../common/stateMachines');
const cardManager = require('../cards');
const sgsCards = require('../cards/cards');
const EventListener = require('../common/eventListener');


class FigureBase extends EventListener {
    constructor() {
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
        console.log(`|<F> ON ${this.name} ${event}`);
        return yield super.on(event, game, ctx);
    }

    distanceFrom(game, ctx) {
        return 0;
    }

    distanceTo(game, ctx) {
        return 0;
    }

    attackRange(game, ctx) {
        return 0;
    }
}


class CaoCao extends FigureBase {
// 【曹操】 魏，男，4血
// 【奸雄】【护驾】
    constructor() {
        super();
        this.name = '曹操';
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
        let cards = U.toArray(ctx.sourceCards);
        for (let card of cards) {
            if (ctx.handlingCards.has(card)) {
                game.message([this.owner, '获得了', card]);
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
            return yield this.useSkill(this.skills.WEI001s01, game, ctx);
        }
        return yield Promise.resolve(R.success);
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

    * s1(game, ctx) {
        const u = this.owner;
        const requireCardsAndTargetFSM = () => {
            let m = new FSM.Machine(game);
            m.addState(new FSM.State('CTO'), true);

            m.addTransition(new FSM.Transition('CTO', 'CARD', 'CTO',
                (command) => {
                    let card = game.cardByPk(command.params);
                    return u.hasCard(card);
                },
                (game, ctx) => {
                    if (ctx.cards) {
                        ctx.cards.add(game.cardByPk(ctx.command.params));
                    } else {
                        ctx.cards = U.toSet(game.cardByPk(ctx.command.params));
                    }
                }
            ));
            m.addTransition(new FSM.Transition('CTO', 'UNCARD', 'CTO', null,
                (game, ctx) => {
                    ctx.cards.delete(game.cardByPk(ctx.command.params));
                }
            ));
            m.addTransition(new FSM.Transition('CTO', 'TARGET', 'CTO',
                (command) => {
                    return u.id !== command.params[0];
                },
                (game, ctx) => {
                    if (ctx.target) {
                        u.reply(`UNSELECT TARGET ${ctx.target.id}`);
                    }
                    ctx.target = game.userByPk(ctx.command.params);
                }
            ));
            m.addTransition(new FSM.Transition('CTO', 'UNTARGET', 'CTO', null,
                (game, ctx) => {
                    ctx.target = null;
                }
            ));
            m.addTransition(new FSM.Transition('CTO', 'OK', '_',
                (command, ctx) => {
                    return (ctx.target && ctx.cards && ctx.cards.size > 0);
                },
                (game, ctx) => {
                    return new R.CardTargetResult().set(ctx.cards, ctx.target);
                }
            ));

            m.addTransition(new FSM.Transition('CTO', 'CANCEL', '_'));

            m.setFinalHandler((r) => {
                return r.get().pop();
            });

            return m;
        };
        let result = yield game.waitFSM(u, requireCardsAndTargetFSM(), ctx);
        if (result.success) {
            let cards = Array.from(result.get().card);
            let target = result.get().target;

            game.message([u, '使用技能【仁德】，将', cards, '交给', target]);

            yield game.removeUserCards(u, cards);
            game.addUserCards(target, cards);

            if (this.s1_param < 2 && (this.s1_param + cards.length) >= 2) {
                ctx.heal = 1;
                yield u.on('heal', game, ctx);
            }
            this.s1_param += cards.length;
        }
        return yield Promise.resolve(result);
    }

    * s2(game, ctx) {
        const u = this.owner;
        let result = yield game.waitFSM(u, FSM.get('requireSingleTarget', game, {
            targetValidator: (command) => {
                let targets = game.usersByPk(command.params);
                return (C.COUNTRY.SHU === Array.from(targets)[0].figure.country);
            }
        }), ctx);

        if (!result.success) {
            return yield Promise.resolve(R.abort);
        }

        let target = result.get();
        game.message([u, '使用技能【激将】，请', target, '为其出【杀】。']);
        let command = yield game.waitConfirm(target, `刘备使用技能【激将】，是否为其出【杀】？`);
        if (command.cmd === C.CONFIRM.Y) {
            let result = yield target.on('requireSha', game, ctx);
            if (result.success) {
                let cards = result.get();
                game.message([target, '替', u, '打出了', cards]);
                yield game.removeUserCards(target, cards);
                return yield Promise.resolve(result);
            }
        }

        return yield Promise.resolve(R.fail);
    }

    * roundPlayPhaseStart(game, ctx) {
        this.s1_param = 0;  // 本阶段【仁德】送出的牌数
        this.changeSkillState(this.skills.SHU001s01, C.SKILL_STATE.ENABLED);
        this.changeSkillState(this.skills.SHU001s02, C.SKILL_STATE.ENABLED);
    }

    * play(game, ctx) {
        if (ctx.phaseContext.shaCount > 0) {
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
        const u = this.owner;
        let result = yield game.waitFSM(u, FSM.get('requireSingleCard', game, {
            cardValidator: (command) => {
                let card = game.cardByPk(command.params);
                return (u.hasCard(card) && [C.CARD_SUIT.HEART, C.CARD_SUIT.DIAMOND].includes(card.suit));
            }
        }), ctx);

        if (result.success) {
            let card = result.get();
            let fakeCard = cardManager.fakeCards([card], {asClass: sgsCards.Sha});

            result = new R.CardResult();
            result.set(fakeCard);
            game.message([u, '把', card, '当作', fakeCard, '使用']);
        } else {
            result = R.fail;
        }
        return yield Promise.resolve(result);
    }

    * roundPlayPhaseStart(game, ctx) {
        this.changeSkillState(this.skills.SHU002s01, C.SKILL_STATE.ENABLED);
    }

    * play(game, ctx) {
        if (ctx.phaseContext.shaCount > 0) {
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
    }
}


class ZhaoYun extends FigureBase {
// 【赵云】 蜀，男，4血
// 【龙胆】
    constructor() {
        super();
        this.name = '赵云';
        this.pk = ZhaoYun.pk;
        this.country = C.COUNTRY.SHU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            SHU005s01: {
                pk: 'SHU005s01',
                style: C.SKILL_STYLE.SUODING,
                name: '龙胆',
                desc: '你可以将一张【杀】当【闪】，一张【闪】当【杀】使用或打出。',
                handler: 's1',
            },
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        const {originClass, fakeClass} = ctx.SHU005s01;
        let result = yield game.waitFSM(u, FSM.get('requireSingleCard', game, {
            cardValidator: (command) => {
                let card = game.cardByPk(command.params);
                return (u.hasCard(card) && card instanceof originClass);
            }
        }), ctx);

        if (result.success) {
            let card = result.get();
            let fakeCard = cardManager.fakeCards([card], {asClass: fakeClass});
            result = new R.CardResult().set(fakeCard);
            game.message([u, '把', card, '当作', fakeCard, '使用']);
        } else {
            result = R.fail;
        }
        ctx.SHU005s01 = null;
        return yield Promise.resolve(result);
    }

    * roundPlayPhaseEnd(game, ctx) {
        ctx.SHU005s01 = null;
        this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.DISABLED);
    }

    * play(game, ctx) {
        if (ctx.phaseContext.shaCount > 0) {
            ctx.SHU005s01 = {originClass: sgsCards.Shan, fakeClass: sgsCards.Sha};
            this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.ENABLED);
        } else {
            this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.DISABLED);
        }
    }

    * requireSha(game, ctx) {
        ctx.SHU005s01 = {originClass: sgsCards.Shan, fakeClass: sgsCards.Sha};
        this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.ENABLED);
    }

    * requireShan(game, ctx) {
        ctx.SHU005s01 = {originClass: sgsCards.Sha, fakeClass: sgsCards.Shan};
        this.changeSkillState(this.skills.SHU005s01, C.SKILL_STATE.ENABLED);
    }
}


class MaChao extends FigureBase {
// 【马超】 蜀，男，4血
// 【马术】
// 【铁骑】
    constructor() {
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

    distanceFrom(game, ctx) {
        return -1;
    }

    * s2(game, ctx) {
    }

    * afterShaTarget(game, ctx) {
        const u = this.owner;

        for (let t of ctx.targets) {
            let command = yield game.waitConfirm(u, `指定${t.figure.name}为【杀】的目标，是否发动技能【铁骑】？`);
            if (command.cmd === C.CONFIRM.Y) {
                game.message([u, '指定', t, '为【杀】的目标，发动技能【铁骑】。']);
                let result = yield game.doJudge(u,
                    (card) => [C.CARD_SUIT.HEART, C.CARD_SUIT.DIAMOND].includes(card.suit)
                );
                game.message([u, '判定【铁骑】为', result.get(), '，判定', result.success ? '生效' : '未生效']);
                ctx.shanAble.set(t, !result.success);
            }
        }
        return yield Promise.resolve(R.success);
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
        const u = this.owner;
        if (ctx.sourceUser) {
            let cardCandidates = ctx.sourceUser.cardCandidates({
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
            yield game.removeUserCardsEx(ctx.sourceUser, card);
            game.addUserCards(u, card);
            game.message([u, '从', ctx.sourceUser, '处获得1张牌']);
        }
        return yield Promise.resolve(R.success);
    }

    * s2(game, ctx) {
        let result = yield this.owner.requireCard(game, sgsCards.CardBase, ctx);
        if (result.success) {
            game.discardCards(ctx.judgeCard);
            ctx.handlingCards.delete(ctx.judgeCard);

            ctx.judgeCard = result.get();
            yield game.removeUserCards(this.owner, ctx.judgeCard);
            ctx.handlingCards.add(ctx.judgeCard);
            game.broadcastPopup(`INSTEAD ${this.name} ${ctx.judgeCard.toJsonString()}`);
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
        const u = this.owner;
        let result = yield game.waitFSM(u, FSM.get('requireSingleCard', game, {
            cardValidator: (command) => {
                let card = game.cardByPk(command.params);
                return (u.hasCard(card) && [C.CARD_SUIT.DIAMOND].includes(card.suit));
            }
        }), ctx);

        if (result.success) {
            let card = result.get();
            let fakeCard = cardManager.fakeCards([card], {asClass: sgsCards.LeBuSiShu});

            result = new R.CardResult();
            result.set(fakeCard);
            game.message([u, '把', card, '当作', fakeCard, '使用']);
        } else {
            result = R.fail;
        }
        return yield Promise.resolve(result);
    }

    * s2(game, ctx) {
        const u = this.owner;
        let result = yield game.waitFSM(u, FSM.get('requireSingleCardAndTarget', game, {
            targetValidator: (command) => {
                let target = game.userByPk(command.params);
                return target !== ctx.sourceUser && game.inAttackRange(u, target);
            }
        }), ctx);

        if (result.success) {
            let card = result.get().card;
            let target = result.get().target;

            yield game.removeUserCards(u, card, true);

            ctx.targets.delete(u);
            ctx.targets.add(target);
            if (ctx.shanAble.has(u)) {
                ctx.shanAble.set(target, ctx.shanAble.get(u));
                ctx.shanAble.delete(u);
            }
            game.message([u, '弃置了', card, '将【杀】的目标转移给', target]);
            return yield Promise.resolve(R.success);
        } else {
            return yield Promise.resolve(R.fail);
        }
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

        let result = yield game.waitFSM(u, FSM.get('requireSingleCardAndTarget', game, {
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
            game.message([t, '受到', ctx.damage, '点伤害，并获得了', t.maxHp - t.hp, '张牌']);

            return yield Promise.resolve(R.success);
        } else {
            return yield Promise.resolve(R.fail);
        }
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


class SunShangXiang extends FigureBase {
// 【孙尚香】 吴，女，3血
// 【结姻】
// 【枭姬】
    constructor() {
        super();
        this.name = '孙尚香';
        this.pk = SunShangXiang.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.FEMALE;
        this.hp = 3;
        this.skills = {
            WU008s01: {
                pk: 'WU008s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '结姻',
                desc: '出牌阶段，你可以弃置两张手牌并选择一名已受伤的男性角色，' +
                '令你与其各回复1点体力。每阶段限用一次。',
                handler: 's1',
            },
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
        const skillWU008s01FSM = () => {
            let m = new FSM.Machine(game);

            m.addState(new FSM.State('C'), true);
            m.addState(new FSM.State('T'));
            m.addState(new FSM.State('O'));

            m.addTransition(new FSM.Transition('C', 'CARD_CANDIDATE', 'T',
                (command) => {
                    let cards = game.cardsByPk(command.params);
                    return 2 === U.toArray(cards).filter(
                        c => (u.hasCard(c) || u.hasEquipedCard(c))
                    ).length;
                },
                (game, ctx) => {
                    ctx.cards = U.toSet(game.cardsByPk(ctx.command.params));
                    u.reply(`CLEAR_CANDIDATE`);
                }
            ));
            m.addTransition(new FSM.Transition('C', 'CANCEL', '_'));
            m.addTransition(new FSM.Transition('T', 'TARGET', 'O',
                (command) => {
                    const t = game.userByPk(command.params);
                    return (t.gender === C.GENDER.MALE && t.hp < t.maxHp);
                },
                (game, ctx) => {
                    if (ctx.target) {
                        u.reply(`UNSELECT TARGET ${ctx.target.id}`);
                    }
                    ctx.target = game.userByPk(ctx.command.params);
                }
            ));
            m.addTransition(new FSM.Transition('T', 'UNCARD', 'C2', null,
                (game, ctx) => {
                    ctx.cards.delete(game.cardByPk(ctx.command.params));
                }
            ));
            m.addTransition(new FSM.Transition('T', 'CANCEL', '_'));

            m.addTransition(new FSM.Transition('O', 'OK', '_', null,
                (game, ctx) => {
                    return new R.CardTargetResult().set(ctx.cards, ctx.target);
                }
            ));
            m.addTransition(new FSM.Transition('O', 'UNTARGET', 'T', null,
                (game, ctx) => {
                    ctx.target = null;
                }
            ));
            m.addTransition(new FSM.Transition('O', 'UNCARD', 'C2', null,
                (game, ctx) => {
                    u.reply(`UNSELECT TARGET ${ctx.target.id}`);
                    ctx.target = null;
                    ctx.cards.delete(game.cardByPk(ctx.command.params));
                }
            ));
            m.addTransition(new FSM.Transition('O', 'CANCEL', '_'));

            m.setFinalHandler((r) => {
                return r.get().pop();
            });

            return m;
        };

        let cardCandidates = u.cardCandidates({
            includeJudgeCards: false,
            showHandCards: true,
        });
        u.reply(`CARD_CANDIDATE ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
        let result = yield game.waitFSM(u, skillWU008s01FSM(), ctx);
        u.reply(`CLEAR_CANDIDATE`);
        u.popRestoreCmd('CARD_CANDIDATE');

        if (result.success) {
            let cards = result.get().card;
            let target = result.get().target;
            ctx.heal = 1;

            yield game.removeUserCardsEx(u, cards, true);
            game.message([u, '使用技能【结姻】，弃置手牌', cards, '与', target, '各回复1点体力']);
            yield u.on('heal', game, ctx);
            yield target.on('heal', game, ctx);

            ctx.phaseContext.usedWU008s01 = true;
        }
        return yield Promise.resolve(result);
    }

    * play(game, ctx) {
        this.changeSkillState(this.skills.WU008s01, C.SKILL_STATE.DISABLED);

        if (!ctx.phaseContext.usedWU008s01) {
            for (let u of game.userRound()) {
                if (u.gender === C.GENDER.MALE && u.hp < u.maxHp) {
                    this.changeSkillState(this.skills.WU008s01, C.SKILL_STATE.ENABLED);
                    break;
                }
            }
        }
    }

    * roundPlayPhaseStart(game, ctx) {
        ctx.usedWU008s01 = false;
    }

    * roundPlayPhaseEnd(game, ctx) {
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


CaoCao.pk = 'WEI001';
SiMaYi.pk = 'WEI002';

LiuBei.pk = 'SHU001';
GuanYu.pk = 'SHU002';
ZhaoYun.pk = 'SHU005';
MaChao.pk = 'SHU006';

DaQiao.pk = 'WU006';
SunShangXiang.pk = 'WU008';
XiaoQiao.pk = 'WU011';

figures = {
    CaoCao,
    SiMaYi,

    LiuBei,
    GuanYu,
    ZhaoYun,
    MaChao,

    DaQiao,
    XiaoQiao,
    SunShangXiang,
};

Object.keys(figures).map((k) => {
    exports[k] = figures[k];
    exports[figures[k].pk] = figures[k];
});
