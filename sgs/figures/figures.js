const C = require('../constants');
const R = require('../common/results');
const U = require('../utils');
const FSM = require('../common/fsm');
const cardManager = require('../cards');
const Skill = require('../skills');
const sgsCards = require('../cards/cards');
const EventListener = require('../common/eventListener');
const {SimpleContext, SkillContext} = require('../context');
const Damage = require('../common/damage');

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
        console.log(`|[F] CHANGE SKILL STATE ${skill.name}: ${state}`);
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
        console.log(`|[F] ON ${this.name} ${event}`);
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

    targetableOf(game, ctx, something) {
        return true;
    }
}

// 魏 -----

// WEI001【曹操】 魏，男，4血 【奸雄】【护驾】
class CaoCao extends FigureBase {
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

// WEI002【司马懿】 魏，男，3血 【反馈】【鬼才】
class SiMaYi extends FigureBase {
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
        const t = ctx.i.damage.srcUser;
        if (t) {
            let cardCandidates = t.cardCandidates({
                includeJudgeCards: false,
            });
            u.reply(`CARD_CANDIDATE ${'请选择一张牌'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
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
            yield game.removeUserCards(t, card);
            game.addUserCards(u, card);
            game.message([u, '从', t, '处获得1张牌']);
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
        if (ctx.i.damage.srcUser) {
            let command = yield game.waitConfirm(this.owner, `是否使用技能【反馈】`);
            if (command.cmd === C.CONFIRM.Y) {
                return yield this.triggerSkill(this.skills.WEI002s01, game, ctx);
            }
        }
    }

    * beforeJudgeEffect(game, ctx) {
        let command = yield game.waitConfirm(this.owner, `是否打出一张手牌代替判定牌？`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.triggerSkill(this.skills.WEI002s02, game, ctx);
        }
        return yield Promise.resolve(R.fail);
    }
}

// WEI003【夏侯惇】 魏，男，4血 【刚烈】
class XiaHouDun extends FigureBase {
    constructor(game) {
        super();
        this.name = '夏侯惇';
        this.country = C.COUNTRY.WEI;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            WEI003s01: new Skill(this, {
                pk: 'WEI001s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '刚烈',
                desc: '当你受到伤害后，你可以判定，若结果不为红桃，来源选择一项：' +
                '1、弃置两张手牌；2、受到你造成的1点伤害。',
                handler: 's1',
            }),
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        const t = ctx.i.damage.srcUser;
        let result = yield game.doJudge(u, card => C.CARD_SUIT.HEART !== card.suit);
        game.message([u, '判定【刚烈】为', result.get(), '判定', result.success ? '生效' : '未生效']);
        if (result.success) {
            let choice = '1';  // Default
            let choices = [
                `弃置两张手牌`,
                `受到来自${this.name}的1点伤害`,
            ];

            // 有2张以上的手牌，才可以选择，否则直接选2
            if (t.cards.size >= 2) {
                let command = yield game.waitChoice(t, `请选择`, choices);
                t.reply(`CLEAR_CANDIDATE`);
                choice = command.params[0];
            }

            game.message([t, '选择: ', choices[parseInt(choice)]]);

            if (choice === '0') {
                let cardCandidates = t.cardCandidates({
                    includeJudgeCards: false,
                    includeEquipments: false,
                    showHandCards: true,
                });

                t.reply(`CARD_CANDIDATE ${'请选择2张牌'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
                let command = yield game.wait(t, {
                    validCmds: ['CARD_CANDIDATE'],
                    validator: (command) => {
                        const pks = command.params;
                        return pks.length === 2;
                    },
                });
                t.reply(`CLEAR_CANDIDATE`);
                t.popRestoreCmd('CARD_CANDIDATE');

                let cards = game.cardsByPk(command.params);
                game.message([t, '弃置了2张手牌', cards]);
                yield game.removeUserCards(t, cards, true);
            } else {
                let damage = new Damage(u, null, 1, C.DAMAGE_TYPE.NORMAL);
                let simpleCtx = new SimpleContext(game, {damage}).linkParent(ctx);
                game.message([t, '因', u, '的【刚烈】受到1点伤害']);
                yield t.on('damage', game, simpleCtx);
            }
        }
    }

    * damage(game, ctx) {
        const t = ctx.i.damage.srcUser;
        if (t) {
            let command = yield game.waitConfirm(this.owner, `是否对 ${t.figure.name} 使用技能【刚烈】`);
            if (command.cmd === C.CONFIRM.Y) {
                return yield this.triggerSkill(this.skills.WEI003s01, game, ctx);
            }
        }
    }
}

// WEI004【张辽】 魏，男，4血 【突袭】
class ZhangLiao extends FigureBase {
    constructor(game) {
        super();
        this.name = '张辽';
        this.country = C.COUNTRY.WEI;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            WEI004s01: new Skill(this, {
                pk: 'WEI004s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '突袭',
                desc: '摸牌阶段开始时，你可以放弃摸牌并选择至多两名有手牌的其他角色。' +
                '若如此做，你获得这些角色的各一张手牌。',
                handler: 's1',
                fsmOpt: {
                    cardCount: ST.NONE,
                    targetCount: ST.ONE_OR_MORE,
                    targetValidator: [
                        FSM.BASIC_VALIDATORS.notMeTargetValidator,
                        FSM.BASIC_VALIDATORS.buildCountExceededValidator('targets', 2),
                    ]
                }
            }),
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        let result = yield this.skills.WEI004s01.init(game, ctx);
        if (result.success) {
            let targets = result.get().target;
            for (let t of targets) {
                let cardCandidates = t.cardCandidates({
                    includeEquipments: false,
                    includeJudgeCards: false,
                });
                u.reply(`CARD_CANDIDATE 请选择${t.figure.name}一张手牌 ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
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
                game.message([u, '获得', t, '的一张牌']);
                yield game.removeUserCards(t, card, true);
                game.addUserCards(u, card);
            }

            ctx.phaseCtx.skipPhase = true;
        }
    }

    * roundDrawCardPhaseStart(game, phaseCtx) {
        const u = this.owner;
        let command = yield game.waitConfirm(u, `是否发动技能【突袭】？`);
        if (command.cmd === C.CONFIRM.Y) {
            yield this.triggerSkill(this.skills.WEI004s01, game, phaseCtx);
        }
    }
}

// WEI005【许褚】 魏，男，4血 【裸衣】
class XuChu extends FigureBase {
    constructor(game) {
        super();
        this.name = '许褚';
        this.country = C.COUNTRY.WEI;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            WEI005s01: new Skill(this, {
                pk: 'WEI005s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '裸衣',
                desc: '摸牌阶段，你可以少摸一张牌。若如此做，直到回合结束，当你使用【杀】或【决斗】' +
                '对目标造成伤害时，此伤害+1。',
                handler: 's1',
            }),
        };
    }

    * roundDrawCardPhaseStart(game, phaseCtx) {
        const u = this.owner;
        let command = yield game.waitConfirm(u, `是否发动技能【裸衣】？`);
        phaseCtx.roundCtx.i.WEI005s01 = false;
        if (command.cmd === C.CONFIRM.Y) {
            phaseCtx.i.drawCardCount -= 1;
            phaseCtx.roundCtx.i.WEI005s01 = true;
        }
    }

    * shaHitTarget(game, ctx) {
        const u = this.owner;
        if (ctx.roundCtx.i.WEI005s01) {
            game.message([u, '的技能【裸衣】生效，【杀】伤害+1']);
            ctx.i.exDamage += 1;
        }
    }
}

// WEI006【郭嘉】 魏，男，3血 【天妒】【遗计】
class GuoJia extends FigureBase {
    constructor(game) {
        super();
        this.name = '郭嘉';
        this.country = C.COUNTRY.WEI;
        this.gender = C.GENDER.MALE;
        this.hp = 3;
        this.skills = {
            WEI006s01: new Skill(this, {
                pk: 'WEI006s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '天妒',
                desc: '每当你的判定牌生效后，你可以获得此牌。',
                handler: 's1',
            }),
            WEI006s02: new Skill(this, {
                pk: 'WEI006s02',
                style: C.SKILL_STYLE.NORMAL,
                name: '遗计',
                desc: '每当你受到1点伤害后，你可以观看牌顶的两张牌，然后将其中一张牌' +
                '交给一名角色，再将另一张牌交给一名角色。',
                handler: 's2',
            }),
        };
    }

    * s2(game, ctx) {
        const u = this.owner;
        let cards = game.cardManager.shiftCards(2);
        let cardCandidates = game.cardManager.asCandidates(cards);

        u.reply(`CARD_CANDIDATE ${'请选择一张牌交给一名角色'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
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

        u.reply(`ALERT 请选择目标，将【${card.name}】分给他...`, true, true);
        let fsmOpt = {
            targetValidator: FSM.BASIC_VALIDATORS.buildCountExceededValidator('targets', 1),
        };
        let result = yield game.waitFSM(u, FSM.get('requireSingleTarget', game, ctx, fsmOpt), ctx);
        u.reply('CLEAR_ALERT');
        u.popRestoreCmd('ALERT');

        let t = result.get();
        game.message([u, '分给了', t, '一张牌']);
        game.addUserCards(t, card);

        card = cards[0].pk === card.pk ? cards[1] : cards[0];

        u.reply(`ALERT 请选择目标，将另一张【${card.name}】分给他...`, true, true);
        fsmOpt = {
            targetValidator: FSM.BASIC_VALIDATORS.buildCountExceededValidator('targets', 1),
        };
        result = yield game.waitFSM(u, FSM.get('requireSingleTarget', game, ctx, fsmOpt), ctx);
        u.reply('CLEAR_ALERT');
        u.popRestoreCmd('ALERT');

        t = result.get();
        game.message([u, '分给了', t, '一张牌']);
        game.addUserCards(t, card);
    }

    * judge(game, ctx) {
        const u = this.owner;
        let command = yield game.waitConfirm(u, `是否发动技能【天妒】？`);
        if (command.cmd === C.CONFIRM.Y) {
            const card = ctx.i.judgeCard;
            game.message([u, '发动技能【天妒】，获得了判定牌', card]);
            game.addUserCards(u, card);
        }
    }

    * damage(game, ctx) {
        let count = ctx.i.actualDamage;
        while (count > 0) {
            console.log('|[DEBUG] ===== ', count);
            let command = yield game.waitConfirm(this.owner, `是否使用技能【遗计】`);
            if (command.cmd !== C.CONFIRM.Y) {
                break;
            }
            yield this.triggerSkill(this.skills.WEI006s02, game, ctx);
            count--;
        }
    }
}

// WEI007【甄姬】 魏，女，3血 【倾国】【洛神】
class ZhenJi extends FigureBase {
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

// 蜀 -----

// SHU001【刘备】 蜀，男，4血 【仁德】【激将】
class LiuBei extends FigureBase {
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

// SHU002【关羽】 蜀，男，4血 【武圣】
class GuanYu extends FigureBase {
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
                        return ctx.i.requireCard ? ST.NONE : ST.ONE_OR_MORE;
                    },
                    cardValidator: [
                        FSM.BASIC_VALIDATORS.ownCardValidator,
                        FSM.BASIC_VALIDATORS.buildCardSuitValidator(C.CARD_SUIT.RED),
                    ],
                    targetValidator: [
                        FSM.BASIC_VALIDATORS.notMeTargetValidator,
                        (command, info) => {
                            let u = info.sourceUser;
                            let targetCount = 1;
                            let weapon = u.getEquipCard('weapon');
                            // 方天画戟
                            if (weapon instanceof sgsCards.FangTianHuaJi && weapon.effect(u, info.cards)) {
                                targetCount = 3;
                            }
                            return info.targets.size < targetCount;
                        },
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
            game.message([u, '使用技能【武圣】把', cards, '当作【杀】对', targets, '使用']);
        } else {
            result = new R.CardResult().set(fakeCard);
            game.message([u, '使用技能【武圣】把', cards, '当作【杀】使用']);
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

// SHU003【张飞】 蜀，男，4血 【咆哮】
class ZhangFei extends FigureBase {
    constructor(game) {
        super();
        this.name = '张飞';
        this.pk = ZhangFei.pk;
        this.country = C.COUNTRY.SHU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            SHU003s01: new Skill(this, {
                pk: 'SHU003s01',
                style: C.SKILL_STYLE.SUODING,
                name: '咆哮',
                desc: '锁定技，你使用【杀】无次数限制。',
                handler: 's1',
            }),
        };
    }

    * useSha(game, ctx) {
        if (ctx.phaseCtx.i.shaCount > 0) {
            game.message([this.owner, '发动技能【咆哮】使用【杀】']);
        }
    }
}

// SHU004【诸葛亮】 蜀，男，3血 【观星】【空城】
class ZhuGeLiang extends FigureBase {
    constructor(game) {
        super();
        this.name = '诸葛亮';
        this.pk = ZhuGeLiang.pk;
        this.country = C.COUNTRY.SHU;
        this.gender = C.GENDER.MALE;
        this.hp = 3;
        this.skills = {
            SHU004s01: new Skill(this, {
                pk: 'SHU004s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '观星',
                desc: '准备阶段开始时，你可以观看牌堆顶的X张牌（X为全场角色' +
                '数且至多为5）并改变其中任意数量的牌的顺序置于牌堆顶并将其余' +
                '牌置于牌堆底。',
                handler: 's1',
            }),
            SHU004s02: new Skill(this, {
                pk: 'SHU004s02',
                style: C.SKILL_STYLE.SUODING,
                name: '空城',
                desc: '锁定技，若你没有手牌，你不是【杀】和【决斗】的合法目标。',
                handler: 's2',
            }),
        };
    }

    targetableOf(game, ctx, something) {
        if (something.type === C.TARGETABLE_TYPE.CARD
            && something.instance instanceof sgsCards.Sha
            || something.instance instanceof sgsCards.JueDou) {
            return this.owner.cards.size !== 0;
        }
        return super.targetableOf(game, ctx, something);
    }

    * s1(game, ctx) {
        const u = this.owner;
        let cardCount = Math.min(5, game.usersInState(C.USER_STATE.ALIVE).length);
        let cards = game.cardManager.shiftCards(cardCount);
        let cardCandidates = game.cardManager.asCandidates(cards);

        u.reply(`CARD_CANDIDATE ${'请先拖动排序，然后选中放在牌堆顶部的牌（第一张选中将放在最顶部），不选的牌放在牌堆底部。'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
        let command = yield game.wait(u, {
            validCmds: ['CARD_CANDIDATE'],
            validator: (command) => {
                const pks = command.params;
                return pks.length <= cardCount;
            },
        });
        u.reply(`CLEAR_CANDIDATE`);
        u.popRestoreCmd('CARD_CANDIDATE');

        // 置入牌堆顶
        command.params.reverse().forEach(pk =>
            game.cardManager.unshiftCards(game.cardByPk(pk))
        );

        // 置入牌堆底
        cards.forEach(card =>
            !command.params.includes(card.pk) && game.cardManager.pushCards(card)
        );
    }

    * roundPreparePhaseStart(game, phaseCtx) {
        const u = this.owner;
        let command = yield game.waitConfirm(u, `是否发动技能【观星】？`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.triggerSkill(this.skills.SHU004s01, game, phaseCtx);
        }
    }
}

// SHU005【赵云】 蜀，男，4血 【龙胆】
class ZhaoYun extends FigureBase {
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
                        return ctx.i.requireCard ? ST.NONE : ST.ONE_OR_MORE;
                    },
                    cardValidator: (command, info) => {
                        const skill = (info.parentCtx instanceof SkillContext)
                            ? info.parentCtx.skill
                            : info.parentCtx.i.sourceUser.figure.skills.SHU005s01;
                        const {originClass} = skill.info;
                        let card = game.cardByPk(command.params);
                        return (this.owner.hasCard(card) && card instanceof originClass);
                    },
                    targetValidator: [
                        FSM.BASIC_VALIDATORS.notMeTargetValidator,
                        (command, info) => {
                            let u = info.sourceUser;
                            let targetCount = 1;
                            let weapon = u.getEquipCard('weapon');
                            // 方天画戟
                            if (weapon instanceof sgsCards.FangTianHuaJi && weapon.effect(u, info.cards)) {
                                targetCount = 3;
                            }
                            return info.targets.size < targetCount;
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

// SHU006【马超】 蜀，男，4血 【马术】【铁骑】
class MaChao extends FigureBase {
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

// SHU007【黄月英】 蜀，女，3血 【集智】【奇才】
class HuangYueYing extends FigureBase {
    constructor(game) {
        super();
        this.name = '黄月英';
        this.pk = HuangYueYing.pk;
        this.country = C.COUNTRY.SHU;
        this.gender = C.GENDER.FEMALE;
        this.hp = 3;
        this.skills = {
            SHU007s01: new Skill(this, {
                pk: 'SHU007s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '集智',
                desc: '每当你使用非延时类锦囊牌时，你可以摸一张牌。',
                handler: 's1',
            }),
            SHU007s02: new Skill(this, {
                pk: 'SHU007s02',
                style: C.SKILL_STYLE.SUODING,
                name: '奇才',
                desc: '锁定技，你使用锦囊牌无距离限制。',
                handler: 's2',
            }),
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        game.dispatchCards(u, 1);
        game.message([u, '发动【集智】，获得一张牌']);
    }

    * useScrollCard(game, ctx) {
        const u = this.owner;
        let command = yield game.waitConfirm(u, `是否发动技能【集智】？`);
        if (command.cmd === C.CONFIRM.Y) {
            return yield this.triggerSkill(this.skills.SHU007s01, game, ctx);
        }
    }
}

// 吴 -----

// WU001【孙权】 吴，男，4血 【制衡】【救援】
class SunQuan extends FigureBase {
    constructor(game) {
        super();
        this.name = '孙权';
        this.pk = SunQuan.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            WU001s01: new Skill(this, {
                pk: 'WU001s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '制衡',
                desc: '出牌阶段限一次，你可以弃置任意张牌，摸等量的牌。',
                handler: 's1',
                fsmOpt: {
                    cardCount: ST.ONE_OR_MORE,
                    targetCount: ST.NONE,
                }
            }),
            WU001s02: new Skill(this, {
                pk: 'WU001s02',
                style: C.SKILL_STYLE.ZHUGONG,
                name: '救援',
                desc: '主公技，锁定技，其他吴势力角色对处于濒死状态的你使用桃回复的体力+1。',
                handler: 's2',
            }),
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        let cards = ctx.i.cards;
        let count = cards.length;

        game.message([u, `使用技能【制衡】，换掉了${count} 张牌`]);

        yield game.removeUserCards(u, cards);
        game.addUserCards(u, game.cardManager.shiftCards(count));

        ctx.phaseCtx.i.s1_param = false;  // 出牌阶段限一次【制衡】
        return yield Promise.resolve(R.success);
    }

    * roundPlayPhaseStart(game, phaseCtx) {
        phaseCtx.i.s1_param = true;  // 是否可用【制衡】
    }

    * play(game, ctx) {
        this.changeSkillState(this.skills.WU001s01, ctx.phaseCtx.i.s1_param ? C.SKILL_STATE.ENABLED : C.SKILL_STATE.DISABLED);
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        phaseCtx.i.s1_param = false;  // 是否可用【制衡】
        this.changeSkillState(this.skills.WU001s01, C.SKILL_STATE.DISABLED);
    }
}

// WU002【甘宁】 吴，男，4血 【奇袭】
class GanNing extends FigureBase {
    constructor(game) {
        super();
        this.name = '甘宁';
        this.pk = GanNing.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            WU002s01: new Skill(this, {
                pk: 'WU002s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '奇袭',
                desc: '你可以将一张黑色牌当【过河拆桥】使用。',
                handler: 's1',
                fsmOpt: {
                    cardCount: ST.SINGLE,
                    targetCount: ST.SINGLE,
                    cardValidator: [
                        FSM.BASIC_VALIDATORS.ownCardValidator,
                        FSM.BASIC_VALIDATORS.buildCardSuitValidator(C.CARD_SUIT.BLACK),
                    ],
                },
            }),
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        let cards = ctx.i.cards;
        let targets = ctx.i.targets;
        let fakeCard = cardManager.fakeCards(cards, {asClass: sgsCards.GuoHeChaiQiao});
        game.message([u, '把', cards, '当作', fakeCard, '使用']);
        return yield Promise.resolve(new R.CardTargetResult().set(fakeCard, targets));
    }

    * roundPlayPhaseStart(game, phaseCtx) {
        this.changeSkillState(this.skills.WU002s01, C.SKILL_STATE.ENABLED);
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        this.changeSkillState(this.skills.WU002s01, C.SKILL_STATE.DISABLED);
    }
}

// WU003【吕蒙】 吴，男，4血 【克己】
class LvMeng extends FigureBase {
    constructor(game) {
        super();
        this.name = '吕蒙';
        this.pk = LvMeng.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            WU003s01: {
                pk: 'WU003s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '吕蒙',
                desc: '若你未于出牌阶段内使用或打出过【杀】，你可以跳过弃牌阶段。',
                handler: 's1',
            },
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        u.phases.RoundDiscardPhase = 0;
    }

    * playedSha(game, ctx) {
        ctx.phaseCtx.i.playedSha = true;
    }

    * roundPlayPhaseStart(game, phaseCtx) {
        phaseCtx.i.playedSha = false;  // 出牌阶段是否使用或打出过【杀】
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        if (!phaseCtx.i.playedSha) {
            let command = yield game.waitConfirm(this.owner, `是否使用技能【克己】`);
            if (command.cmd === C.CONFIRM.Y) {
                return yield this.triggerSkill(this.skills.WU003s01, game, phaseCtx);
            }
        }
    }
}

// WU004【黄盖】 吴，男，4血 【苦肉】
class HuangGai extends FigureBase {
    constructor(game) {
        super();
        this.name = '黄盖';
        this.pk = HuangGai.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            WU004s01: new Skill(this, {
                pk: 'WU004s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '苦肉',
                desc: '出牌阶段，你可以失去1点体力，然后摸两张牌。',
                handler: 's1',
                fsmOpt: {
                    cardCount: ST.NONE,
                    targetCount: ST.NONE,
                }
            }),
        };
    }

    * s1(game, ctx) {
        const u = this.owner;
        game.message([u, '发动技能【苦肉】']);
        ctx.i.looseHp = 1;
        yield u.on('looseHp', game, ctx);
        if (u.state === C.USER_STATE.ALIVE) {
            game.message([u, '通过技能【苦肉】获得两张牌']);
            game.addUserCards(u, game.cardManager.shiftCards(2));
        }
        return yield Promise.resolve(R.success);
    }

    * roundPlayPhaseStart(game, phaseCtx) {
        this.changeSkillState(this.skills.WU004s01, C.SKILL_STATE.ENABLED);
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        this.changeSkillState(this.skills.WU004s01, C.SKILL_STATE.DISABLED);
    }
}

// WU005【周瑜】 吴，男，3血 【英姿】【反间】
class ZhouYu extends FigureBase {
    constructor(game) {
        super();
        this.name = '周瑜';
        this.pk = ZhouYu.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.MALE;
        this.hp = 3;
        this.skills = {
            WU005s01: new Skill(this, {
                pk: 'WU005s01',
                style: C.SKILL_STYLE.NORMAL,
                name: '英姿',
                desc: '摸牌阶段，你可以额外摸一张牌。',
                handler: 's1',
            }),
            WU005s02: new Skill(this, {
                pk: 'WU005s02',
                style: C.SKILL_STYLE.NORMAL,
                name: '反间',
                desc: '出牌阶段，你可以令一名其他角色选择一种花色后获得你的一张手牌并展示' +
                '之，若此牌的花色与其所选的不同，你对其造成1点伤害。每阶段限一次。',
                handler: 's2',
                fsmOpt: {
                    cardCount: ST.NONE,
                    targetCount: ST.SINGLE,
                    targetValidator: [FSM.BASIC_VALIDATORS.notMeTargetValidator,],
                }
            }),
        };
    }

    * s1(game, ctx) {
        ctx.phaseCtx.i.drawCardCount += 1;
    }

    * s2(game, ctx) {
        const u = this.owner;
        let t = U.toSingle(ctx.i.targets);

        game.message([u, '对', t, '发动技能【反间】']);
        let choice = '0';  // Default
        let choices = [
            `黑桃`,
            `红桃`,
            `梅花`,
            `方块`,
        ];

        let command = yield game.waitChoice(t, `请选择`, choices);
        t.reply(`CLEAR_CANDIDATE`);
        choice = command.params[0];
        game.message([t, '选择: ', choices[parseInt(choice)]]);

        let cardCandidates = u.cardCandidates({
            includeEquipments: false,
            includeJudgeCards: false,
        });
        t.reply(`CARD_CANDIDATE ${'请选择一张牌'} ${JSON.stringify(cardCandidates, U.jsonReplacer)}`, true, true);
        command = yield game.wait(t, {
            validCmds: ['CARD_CANDIDATE'],
            validator: (command) => {
                const pks = command.params;
                return pks.length === 1;
            },
        });
        t.reply(`CLEAR_CANDIDATE`);
        t.popRestoreCmd('CARD_CANDIDATE');

        let card = game.cardByPk(command.params);
        game.message([t, '获得', u, '的一张牌', card]);
        yield game.removeUserCards(u, card, true);
        game.broadcastPopup(`CARD ${t.figure.name} 反间-展示 ${card.toJsonString()}`);

        if (card.suit === C.CARD_SUIT.SPADE && parseInt(choice) === 0
            || card.suit === C.CARD_SUIT.HEART && parseInt(choice) === 1
            || card.suit === C.CARD_SUIT.CLUB && parseInt(choice) === 2
            || card.suit === C.CARD_SUIT.DIAMOND && parseInt(choice) === 3) {
            game.message([t, '所选花色', choices[parseInt(choice)], '与得到的牌', card, '花色相同']);
        } else {
            game.message([t, '所选花色', choices[parseInt(choice)], '与得到的牌', card, '花色不同']);
            let damage = new Damage(u, null, 1, C.DAMAGE_TYPE.NORMAL);
            let simpleCtx = new SimpleContext(game, {damage}).linkParent(ctx);
            game.message([u, '因【反间】对', t, '造成1点伤害']);
            yield t.on('damage', game, simpleCtx);
        }

        ctx.phaseCtx.i.s2_param = false;  // 是否可用【反间】
        return yield Promise.resolve(R.success);
    }

    * roundDrawCardPhaseStart(game, phaseCtx) {
        const u = this.owner;
        let command = yield game.waitConfirm(u, `是否发动技能【英姿】？`);
        if (command.cmd === C.CONFIRM.Y) {
            yield this.triggerSkill(this.skills.WU005s01, game, phaseCtx);
        }
    }

    * roundPlayPhaseStart(game, phaseCtx) {
        phaseCtx.i.s2_param = true;  // 是否可用【反间】
    }

    * play(game, ctx) {
        const u = this.owner;
        if (ctx.phaseCtx.i.s2_param && u.cards.size >= 1) {
            this.changeSkillState(this.skills.WU005s02, C.SKILL_STATE.ENABLED);
        } else {
            this.changeSkillState(this.skills.WU005s02, C.SKILL_STATE.DISABLED);
        }
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        this.changeSkillState(this.skills.WU005s02, C.SKILL_STATE.DISABLED);
    }
}

// WU006【大乔】 吴，女，3血 【国色】【流离】
class DaQiao extends FigureBase {
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

// WU007【陆逊】 吴，男，3血 【谦逊】【连营】
class LuXun extends FigureBase {
    constructor(game) {
        super();
        this.name = '陆逊';
        this.pk = LuXun.pk;
        this.country = C.COUNTRY.WU;
        this.gender = C.GENDER.MALE;
        this.hp = 3;
        this.skills = {
            WU007s01: new Skill(this, {
                pk: 'WU007s01',
                style: C.SKILL_STYLE.SUODING,
                name: '谦逊',
                desc: '锁定技，你不能成为【乐不思蜀】或【顺手牵羊】的目标。',
                handler: 's1',
            }),
            WU007s02: new Skill(this, {
                pk: 'WU007s02',
                style: C.SKILL_STYLE.NORMAL,
                name: '连营',
                desc: '当你失去手牌后，若你没有手牌，则你可以摸一张牌。',
                handler: 's2',
            }),
        };
    }

    targetableOf(game, ctx, something) {
        if (something.type === C.TARGETABLE_TYPE.CARD
            && something.instance instanceof sgsCards.LeBuSiShu
            || something.instance instanceof sgsCards.ShunShouQianYang) {
            return false;
        }
        return super.targetableOf(game, ctx, something);
    }

    * s2(game, ctx) {
        const u = this.owner;
        game.dispatchCards(u, 1);
        game.message([u, '发动技能【连营】，获得一张牌']);
    }

    * removeHandCards(game, ctx) {
        const u = this.owner;
        if (u.cards.size === 0) {
            let command = yield game.waitConfirm(u, `是否使用技能【连营】`);
            if (command.cmd === C.CONFIRM.Y) {
                yield this.triggerSkill(this.skills.WU007s02, game, ctx);
            }
        }
    }
}

// WU011【小乔】 吴，女，3血 【天香】【红颜】
class XiaoQiao extends FigureBase {
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
                ctx.i.ignoreDamage = true;
            }
        }
    }

    * judge(game, ctx) {
        ctx.i.judgeCard = this.filterCard(ctx.i.judgeCard);
    }
}

// WU008【孙尚香】 吴，女，3血 【结姻】【枭姬】
class SunShangXiang extends FigureBase {
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

// WU013【周泰】 吴，男，4血 【不屈】【激愤】
class ZhouTai extends FigureBase {
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

// 群 -----

// QUN002【吕布】 群，男，4血 【无双】
class LvBu extends FigureBase {
    constructor(game) {
        super();
        this.name = '吕布';
        this.pk = LvBu.pk;
        this.country = C.COUNTRY.QUN;
        this.gender = C.GENDER.MALE;
        this.hp = 4;
        this.skills = {
            QUN002s01: {
                pk: 'QUN002s01',
                style: C.SKILL_STYLE.SUODING,
                name: '无双',
                desc: '锁定技，当你使用【杀】指定一个目标后，该角色需依次使用两张【闪】' +
                '才能抵消此【杀】；当你使用【决斗】指定一个目标后，或成为一名角色使用' +
                '【决斗】的目标后，该角色每次响应此【决斗】需依次打出两张【杀】。',
                handler: 's1',
            },
        };
    }

    * afterShaTarget(game, ctx) {
        const u = this.owner;

        for (let t of ctx.i.targets) {
            game.message([u, '指定', t, '为【杀】的目标，触发技能【无双】，需要打出两张【闪】。']);
            ctx.i.shanAble.set(t, 2);
        }
    }
}


CaoCao.pk = 'WEI001';
SiMaYi.pk = 'WEI002';
XiaHouDun.pk = 'WEI003';
ZhangLiao.pk = 'WEI004';
XuChu.pk = 'WEI005';
GuoJia.pk = 'WEI006';
ZhenJi.pk = 'WEI007';

LiuBei.pk = 'SHU001';
GuanYu.pk = 'SHU002';
ZhangFei.pk = 'SHU003';
ZhuGeLiang.pk = 'SHU004';
ZhaoYun.pk = 'SHU005';
MaChao.pk = 'SHU006';
HuangYueYing.pk = 'SHU007';

SunQuan.pk = 'WU001';
GanNing.pk = 'WU002';
LvMeng.pk = 'WU003';
HuangGai.pk = 'WU004';
ZhouYu.pk = 'WU005';
DaQiao.pk = 'WU006';
LuXun.pk = 'WU007';
SunShangXiang.pk = 'WU008';
XiaoQiao.pk = 'WU011';
ZhouTai.pk = 'WU013';

LvBu.pk = 'QUN002';

let figures = {
    CaoCao,
    SiMaYi,
    XiaHouDun,
    ZhangLiao,
    XuChu,
    GuoJia,
    ZhenJi,

    LiuBei,
    GuanYu,
    ZhangFei,
    ZhuGeLiang,
    ZhaoYun,
    MaChao,
    HuangYueYing,

    SunQuan,
    GanNing,
    LvMeng,
    HuangGai,
    ZhouYu,
    DaQiao,
    LuXun,
    XiaoQiao,
    SunShangXiang,
    ZhouTai,

    LvBu,
};

let figureNames = new Set();
let figurePks = new Set();

Object.keys(figures).map((k) => {
    figureNames.add(k);
    figurePks.add(figures[k].pk);
    exports[k] = figures[k];
    exports[figures[k].pk] = figures[k];
});

exports.figureNames = figureNames;
exports.figurePks = figurePks;
