const C = require('./constants');
const R = require('./common/results');
const U = require('./utils');
const {SimpleContext, CardContext} = require('./context');
const FSM = require('./common/fsm');
const sgsCards = require('./cards/cards');
const EventListener = require('./common/eventListener');
const Damage = require('./common/damage');


class User extends EventListener {
    constructor(sessionId, messageResp) {
        super();
        this.id = sessionId;
        this.state = C.USER_STATE.CREATED;

        this.name = '';
        this.resp = null;
        this.seatNum = null;
        this.role = null;
        this.figure = null;
        this.hp = 0;
        this.maxHp = 0;
        this.gender = C.GENDER.UNKNOWN;
        this.waiting = C.WAITING_FOR.NOTHING;
        this.status = new Set();

        this.showFigure = false;
        this.cards = new Map();  // [];
        this.equipments = {
            weapon: null,
            armor: null,
            attackHorse: null,
            defenseHorse: null,
        };
        this.judgeStack = [];
        this.markers = [];
        this.restoreCmds = [];

        this.roundOwner = false;
        this.phases = {
            RoundStartPhase: 1,
            RoundPreparePhase: 1,
            RoundJudgePhase: 1,
            RoundDrawCardPhase: 1,
            RoundPlayPhase: 1,
            RoundDiscardPhase: 1,
            RoundEndPhase: 1,
        };
        this.setResp(messageResp);
    }

    toJson(u) {
        let cards = [];
        (u.id === this.id) && this.cards.forEach((c) => {
            cards.push(c.toJsonString());
        });

        return {
            id: this.id,
            name: this.name,
            seatNum: this.seatNum,

            state: this.state,
            status: U.toArray(this.status),
            waiting: this.waiting,
            roundOwner: this.roundOwner,

            role: (u.id === this.id || this.role === C.ROLE.ZHUGONG || this.state === C.USER_STATE.DEAD) ? this.role : '?',
            figure: ((u.id === this.id || this.showFigure) && this.figure) ? this.figure.toJson() : null,
            hp: this.showFigure ? this.hp : 0,
            maxHp: this.showFigure ? this.maxHp : 0,
            judgeStack: this.judgeStack,
            marker: {
                name: '命',
                size: this.markers.length,
                markers: this.markers,
            },

            cardCount: this.cards.size,
            cards,

            equipments: this.equipments,
        };
    }

    toJsonString(u) {
        return JSON.stringify(this.toJson(u));
    }

    toString() {
        return this.figure ? this.figure.name : this.name;
    }

    setResp(resp) {
        if (this.resp) {
            this.resp.end('data: *DISCONNECTED\n\n');
        }
        this.resp = resp;
        this.reply(`CONNECTED ${this.id}`, true);
    }

    reply(data, selfMarker = true, addToResoreCmd = false) {
        // if (data != 'HB') console.log(`| <- ${data}`);
        this.resp.write("data: " + (selfMarker ? '*' : '-') + data + "\n\n");
        if (addToResoreCmd) {
            this.pushRestoreCmd({
                data,
                selfMarker,
            });
        }
    }

    pushRestoreCmd(cmd) {
        this.restoreCmds.push(cmd);
    }

    popRestoreCmd(cmd) {
        let command = this.restoreCmds.pop();
        if (!command.data.startsWith(cmd)) {
            console.warn(`|<!> Command "${command.data}" dosen\'t match "${cmd}"`);
        }
    }

    restore() {
        for (let cmd of this.restoreCmds) {
            this.reply(cmd.data, cmd.selfMarker);
        }
    }

    setFigure(figure) {
        this.figure = figure;
        figure.owner = this;
        this.hp = figure.hp;
        this.maxHp = figure.hp;
        this.gender = figure.gender;
    }

    addCards(cards) {
        for (let card of cards) {
            this.cards.set(card.pk, card);
        }
    }

    removeCardPks(cardPks) {
        for (let pk of cardPks) {
            this.cards.delete(pk);
        }
    }

    hasCard(card) {
        return card && this.cards.has(card.pk);
    }

    hasEquipedCard(card) {
        for (let k of Object.keys(this.equipments)) {
            if (this.equipments[k] !== null && card.pk === this.equipments[k].card.pk) {
                return true;
            }
        }
        return false;
    }

    hasJudgeCard(card) {
        for (let j of this.judgeStack) {
            if (card.pk === j.pk) {
                return true;
            }
        }
        return false;
    }

    hasCardPk(cardPk) {
        return this.cards.has(cardPk);
    }

    hasJudgeType(card) {
        for (let judge of this.judgeStack) {
            if (card.constructor === judge.constructor) {
                return true;
            }
        }
        return false;
    }

    pushJudge(card) {
        this.judgeStack.unshift(card);
    }

    getJudgeStack() {
        return [...this.judgeStack];
    }

    removeJudge(card) {
        this.judgeStack = this.judgeStack.filter(c => c.pk !== card.pk);
    }

    pushMarker(card) {
        this.markers.push(card);
    }

    removeMarker(card) {
        this.markers = this.markers.filter(marker => marker !== card);
    }

    equipCard(card) {
        this.equipments[card.equipType] = {
            card,
            state: C.SKILL_STATE.DISABLED,
        };

        card.setEquiper(this);
    }

    unequipCard(equipType) {
        let oldEquipment = this.equipments[equipType];
        if (oldEquipment) {
            oldEquipment.card.setEquiper(null);
            this.equipments[equipType] = null;
            return oldEquipment.card;
        }
        return null;
    }

    cardCandidates(opt = {}) {
        let {
            includeEquipments = true,
            includeJudgeCards = true,
            includeHandCards = true,
            showEquipments = true,
            showJudgeCards = true,
            showHandCards = false,
        } = opt;
        let candidates = [];

        if (includeEquipments) {
            for (let k of Object.keys(this.equipments)) {
                if (this.equipments[k] !== null) {
                    candidates.push({
                        card: this.equipments[k].card,
                        show: showEquipments,
                    });
                }
            }
        }
        if (includeJudgeCards) {
            candidates.push(...this.judgeStack.map(c => ({
                card: c,
                show: showJudgeCards,
            })));
        }
        if (includeHandCards) {
            candidates.push(...Array.from(this.cards.values()).map(c => ({
                card: c,
                show: showHandCards,
            })));
        }
        return candidates;
    }

    getEquipCard(equipType) {
        if (this.equipments[equipType]) {
            return this.equipments[equipType].card;
        }
        return null;
    }

    addStatus(status) {
        this.status.add(status);
    }

    removeStatus(status) {
        this.status.delete(status);
    }

    toggleStatus(status) {
        this.status.has(status) ? this.status.delete(status) : this.status.add(status);
    }

    getShaLimit() {
        // 计算可用杀的数量
        if (this.getEquipCard('weapon') instanceof sgsCards.ZhuGeLianNu) {
            return Infinity;
        }
        return 1;  // DEFAULT_SHA_LIMIT
    }

    distanceFrom(game, ctx, info) {
        let exDistance = this.figure.distanceFrom(game, ctx, info);
        let equip = this.equipments.attackHorse;
        exDistance += (equip === null || info.planToRemove && info.planToRemove.has(equip.card)) ? 0 : -1;
        return exDistance;
    }

    distanceTo(game, ctx, info) {
        let exDistance = this.figure.distanceTo(game, ctx, info);
        let equip = this.equipments.defenseHorse;
        exDistance += (equip === null || info.planToRemove && info.planToRemove.has(equip.card)) ? 0 : 1;
        return exDistance;
    }

    attackRange(game, ctx, info) {
        let exRange = this.figure.attackRange(game, ctx, info);
        let equip = this.equipments.weapon;
        exRange += (equip === null || info.planToRemove && info.planToRemove.has(equip.card)) ? 1 : equip.card.range;
        return exRange;
    }

    filterCard(card) {
        // 用于小乔的【红颜】
        return this.figure.filterCard(card);
    }

    maxHandCards() {
        return this.figure.maxHandCards === undefined ? this.hp : this.figure.maxHandCards();
    }

    // NOTE: This is NOT an event handler.
    * requireCard(game, ctx, cardClasses, validators = []) {
        const u = this;
        validators.push(FSM.BASIC_VALIDATORS.handCardValidator);
        validators.push(FSM.BASIC_VALIDATORS.buildCardClassValidator(cardClasses));
        let result = yield game.waitFSM(u, FSM.get('requireSingleCard', game, ctx, {
            cardValidator: validators,
        }), ctx);

        if (result.success) {
            let card = result.get();
            return yield Promise.resolve(new R.CardResult().set(card));
        } else {
            return yield Promise.resolve(R.fail);
        }
    }

    // ------

    * on(event, game, ctx) {
        if (!ctx) {
            ctx = new SimpleContext();
        }
        console.log(`|<U> ON ${this.name}(${this.figure.name}) ${event}`);
        return yield super.on(event, game, ctx);
    }

    // --- Phase Event ---
    // All contexts of PhaseEvent are PhaseContext.

    * roundPreparePhaseStart(game, phaseCtx) {
        return yield this.figure.on('roundPreparePhaseStart', game, phaseCtx);
    }

    * roundDrawCardPhaseStart(game, phaseCtx) {
        return yield this.figure.on('roundDrawCardPhaseStart', game, phaseCtx);
    }

    * roundPlayPhaseStart(game, phaseCtx) {
        phaseCtx.i.shaCount = 0;
        phaseCtx.i.jiuCount = 0;
        return yield this.figure.on('roundPlayPhaseStart', game, phaseCtx);
    }

    * roundPlayPhaseEnd(game, phaseCtx) {
        game.removeUserStatus(game.roundOwner, C.USER_STATUS.DRUNK);  // 移除酒状态
        return yield this.figure.on('roundPlayPhaseEnd', game, phaseCtx);
    }

    // ---  ---

    * play(game, ctx) {
        yield this.figure.on('play', game, ctx);
        if (this.equipments.weapon) {
            yield this.equipments.weapon.card.on('play', game, ctx);
        }
    }

    * initSha(game, ctx) {
        yield this.figure.on('initSha', game, ctx);
        if (this.equipments.weapon) {
            yield this.equipments.weapon.card.on('initSha', game, ctx);
        }
        return yield Promise.resolve(R.success);
    }

    * startSha(game, ctx) {
        yield this.figure.on('startSha', game, ctx);
        if (this.equipments.weapon) {
            yield this.equipments.weapon.card.on('startSha', game, ctx);
        }
        return yield Promise.resolve(R.success);
    }

    * useSha(game, ctx) {
        yield this.figure.on('useSha', game, ctx);
        if (this.equipments.weapon) {
            yield this.equipments.weapon.card.on('useSha', game, ctx);
        }
    }

    * beSha(game, ctx) {
        yield this.figure.on('beSha', game, ctx);
        if (!ctx.i.ignoreArmor && this.equipments.armor) {
            yield this.equipments.armor.card.on('beSha', game, ctx);
        }
        return yield Promise.resolve(R.success);
    }

    * shaHitTarget(game, ctx) {
        yield this.figure.on('shaHitTarget', game, ctx);
        if (this.equipments.weapon) {
            yield this.equipments.weapon.card.on('shaHitTarget', game, ctx);
        }
        return yield Promise.resolve(R.success);
    }

    * usedSha(game, ctx) {
        if (ctx.i.isExtraSha) {
        } else {
            ctx.phaseCtx.i.shaCount++;
        }
    }

    * useTao(game, ctx) {
        yield this.on('heal', game, ctx);
        yield game.removeUserCards(ctx.i.sourceUser, ctx.i.card, true);
    }

    * damage(game, ctx) {
        ctx.i.ignoreDamage = false;

        yield this.figure.on('beforeDamage', game, ctx);
        if (ctx.i.ignoreDamage) {
            return yield Promise.resolve(R.success);
        }

        let equipCard = this.getEquipCard('armor');
        if (!ctx.i.ignoreArmor && equipCard) {
            yield equipCard.on('damage', game, ctx);
        }

        let damage = ctx.i.damage;
        let willDamage = damage.value + (ctx.i.exDamage || 0);
        ctx.i.actualDamage = willDamage;
        console.log(`|<U> HP - ${willDamage}`);
        game.message([this, '受到', willDamage, '点', damage.getTypeStr(), '伤害']);
        yield game.changeUserProperty(this, 'hp', this.hp - willDamage);

        if (this.hp <= 0) {
            // TODO game.userDying();
            yield this.on('dying', game, ctx);
        }

        if (this.state === C.USER_STATE.ALIVE) {
            yield this.figure.on('damage', game, ctx);
        }

        // 处理铁索连环
        if (!ctx.i.handlingLinkDamage
            && damage.type !== C.DAMAGE_TYPE.NORMAL
            && this.status.has(C.USER_STATUS.LINKED)) {
            let linkDamage = new Damage(
                damage.srcUser,
                damage.srcCard,
                willDamage,
                damage.type
            );
            let linkCtx = new SimpleContext().linkParent(ctx);
            linkCtx.i.handlingLinkDamage = true;
            linkCtx.i.damage = linkDamage;

            game.removeUserStatus(this, C.USER_STATUS.LINKED);
            let linkedUsers = game.userRound().filter(
                (u) => u.status.has(C.USER_STATUS.LINKED)
            );
            for (let next of linkedUsers) {
                game.message([next, '收到铁索连环影响，收到伤害传递']);
                yield next.on('damage', game, linkCtx);
                game.removeUserStatus(next, C.USER_STATUS.LINKED);
            }
        }
    }

    * heal(game, ctx) {
        let willHeal = Math.min(this.maxHp - this.hp, ctx.i.heal);
        console.log(`|<U> HP${this.hp} + ${willHeal} = ${this.hp + willHeal}`);
        yield game.changeUserProperty(this, 'hp', this.hp + willHeal);
        game.message([this, '回复', willHeal, '点体力']);
        yield this.figure.on('heal', game, ctx);

        if (this.state === C.USER_STATE.DYING && this.hp > 0) {
            this.state = C.USER_STATE.ALIVE;
            game.broadcastUserInfo(this);
        }
    }

    * dying(game, ctx) {
        this.state = C.USER_STATE.DYING;
        game.broadcastUserInfo(this);

        for (let u of game.userRound()) {
            if (u === this) {
                yield this.figure.on('dying', game, ctx);
            }
            while (this.state === C.USER_STATE.DYING) { // 同一个人可以出多次桃救
                const self = u === this;  // 自己可以对自己使用酒
                let command = yield game.waitConfirm(u, `${this.figure.name}濒死，是否为其出【桃】${self ? '或【酒】' : ''}？`);
                if (command.cmd === C.CONFIRM.Y) {
                    let result = self ? yield u.on('requireTaoOrJiu', game, ctx) : yield u.on('requireTao', game, ctx);
                    if (result.success) {
                        let cards = result.get();
                        yield game.removeUserCards(u, cards, true);
                        ctx.i.heal = 1;
                        yield this.on('heal', game, ctx);
                    }
                } else {
                    break;
                }
            }

            if (this.state === C.USER_STATE.ALIVE) {
                break;
            }
        }

        if (this.hp <= 0) {
            yield this.on('die', game, ctx);
        }
    }

    * die(game, ctx) {
        this.state = C.USER_STATE.DEAD;
        yield game.userDead(this);
    }

    * requireSha(game, ctx) {
        let result = yield this.figure.on('requireSha', game, ctx);
        if (result.fail && this.equipments.weapon) {
            result = yield this.equipments.weapon.card.on('requireSha', game, ctx);
        }
        if (result.fail) {
            let opt = {
                u: this,
                cardClass: sgsCards.Sha,
            };
            this.reply('ALERT 请出杀...', true, true);
            result = yield game.waitFSM(this, FSM.get('requireSpecCard', game, ctx, opt), ctx);
            this.reply('CLEAR_ALERT');
            this.popRestoreCmd('ALERT');
        }

        yield this.on('unrequireSha', game, ctx);
        return yield Promise.resolve(result);
    }

    * requireShan(game, ctx) {
        let result = yield this.figure.on('requireShan', game, ctx);
        if (!ctx.i.ignoreArmor && result.fail && this.equipments.armor) {
            result = yield this.equipments.armor.card.on('requireShan', game, ctx);
        }
        if (result.fail) {
            let opt = {
                u: this,
                cardClass: sgsCards.Shan,
            };
            this.reply('ALERT 请出闪...', true, true);
            result = yield game.waitFSM(this, FSM.get('requireSpecCard', game, ctx, opt), ctx);
            this.reply('CLEAR_ALERT');
            this.popRestoreCmd('ALERT');
        }

        yield this.on('unrequireShan', game, ctx);
        return yield Promise.resolve(result);
    }

    * requireTao(game, ctx) {
        let result = yield this.figure.on('requireTao', game, ctx);
        if (!result.abort && result.fail) {
            result = yield this.requireCard(game, ctx, sgsCards.Tao);
        }
        yield this.on('unrequireTao', game, ctx);
        return yield Promise.resolve(result);
    }

    * requireTaoOrJiu(game, ctx) {
        let result = yield this.figure.on('requireTaoOrJiu', game, ctx);
        if (!result.abort && result.fail) {
            result = yield this.requireCard(game, ctx, [sgsCards.Tao, sgsCards.Jiu]);
        }
        yield this.on('unrequireTaoOrJiu', game, ctx);
        return yield Promise.resolve(result);
    }

    * requireWuXieKeJi(game, ctx) {
        let result = yield this.requireCard(game, ctx, sgsCards.WuXieKeJi);
        return yield Promise.resolve(result);
    }

    * unrequireSha(game, ctx) {
        yield this.figure.on('unrequireSha', game, ctx);
        if (this.equipments.weapon) {
            yield this.equipments.weapon.card.on('unrequireSha', game, ctx);
        }
    }

    * unrequireShan(game, ctx) {
        yield this.figure.on('unrequireShan', game, ctx);
        if (!ctx.i.ignoreArmor && this.equipments.armor) {
            yield this.equipments.armor.card.on('unrequireShan', game, ctx);
        }
    }

    * unrequireTao(game, ctx) {
        yield this.figure.on('unrequireTao', game, ctx);
    }

    * unrequireTaoOrJiu(game, ctx) {
        yield this.figure.on('unrequireTaoOrJiu', game, ctx);
    }

    * beforeJudgeEffect(game, ctx) {
        let result = yield this.figure.on('beforeJudgeEffect', game, ctx);
        return yield Promise.resolve(result);
    }

    * beforeScrollCardEffect(game, ctx) {
        for (let u of game.userRound()) {
            let command = yield game.waitConfirm(u, `是否为${this.figure.name}出【无懈可击】？`, 1000, 'N');
            if (command.cmd === C.CONFIRM.Y) {
                let result = yield u.on('requireWuXieKeJi', game, ctx);
                if (result.success) {
                    let card = result.get();

                    let cardCtx = new CardContext(game, card, {
                        sourceUser: u,
                        targets: new Set([this]),
                    }).linkParent(ctx);

                    yield game.removeUserCards(u, card);
                    yield card.start(game, cardCtx);
                    game.discardCards(card);
                    break;
                }
            }
        }

        if (ctx.i.silkCardEffect && this.equipments.armor) {
            yield this.equipments.armor.card.on('beforeScrollCardEffect', game, ctx);
        }
    }

    * judge(game, ctx) {
        let result = yield this.figure.on('judge', game, ctx);
        return yield Promise.resolve(result);
    }

    * shaTarget(game, ctx) {
        yield this.figure.on('shaTarget', game, ctx);
        if (this.equipments.weapon) {
            yield this.equipments.weapon.card.on('shaTarget', game, ctx);
        }
        return yield Promise.resolve(R.success);
    }

    * beShaTarget(game, ctx) {
        let result = yield this.figure.on('beShaTarget', game, ctx);
        return yield Promise.resolve(result);
    }

    * afterShaTarget(game, ctx) {
        yield this.figure.on('afterShaTarget', game, ctx);
        if (this.equipments.weapon) {
            yield this.equipments.weapon.card.on('afterShaTarget', game, ctx);
        }
        return yield Promise.resolve(R.success);
    }

    * afterBeShaTarget(game, ctx) {
        let result = yield this.figure.on('afterBeShaTarget', game, ctx);
        return yield Promise.resolve(result);
    }

    * shaBeenShan(game, ctx) {
        let result = yield this.figure.on('shaBeenShan', game, ctx);
        if (!result.abort && result.fail && this.equipments.weapon) {
            result = yield this.equipments.weapon.card.on('shaBeenShan', game, ctx);
        }
        return yield Promise.resolve(result);
    }

    * unequip(game, ctx) {
        game.message([this, '失去了装备', ctx.i.equipCard]);
        yield this.figure.on('unequip', game, ctx);
        yield ctx.i.equipCard.on('unequip', game, ctx);
    }
}

module.exports = User;
