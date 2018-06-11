
const C = require('../constants');


class FigureBase {
    constructor() {}

    toJson() {
        return {
            pk: this.pk,
            name: this.name,
            country: this.country,
            hp: this.hp,
        };
    }

    toJsonString() {
        return JSON.stringify(this.toJson());
    }

    * on(event, game, si) {
        console.log(`ON ${event}`);
        if (typeof(this[event]) === 'function') {
            return yield this[event](game, si);
        }
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
                handler: this.s1,
            },
            WEI001s02: {
                pk: 'WEI001s02',
                style: C.SKILL_STYLE.ZHUGONG,
                name: '护驾',
                desc: '主公技，当你需要使用（或打出）一张【闪】时，'
                    + '你可以发动护驾。所有“魏”势力角色按行动顺序依次选择是'
                    + '否打出一张【闪】“提供”给你（然后视为由你使用或打出），'
                    + '直到有—名角色或没有任何角色决定如此做时为止。',
                handler: this.s2,
            },
        };
    }

    * s1(game, si) {
        console.log('SKILL WEI001s01');
        console.log(si.sourceCards.map((i) => i.name));
    }

    * s2(game, si) {
        console.log('SKILL WEI001s02');
        return false;
    }

    * demage(game, si) {
        console.log('CaoCao damege');
        yield this.skills.WEI001s01.handler(game, si);
    }

    * requireShan(game, si) {
        console.log('CaoCao requireShan');
        yield this.skills.WEI001s02.handler(game, si);
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
                handler: this.s1,
            },
        };
    }

    s1() {

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
                handler: this.s1,
            },
            WEI002s02: {
                pk: 'WEI002s02',
                style: C.SKILL_STYLE.NORMAL,
                name: '鬼才',
                desc: '在任意角色的判定牌生效前，你可以打出一张手牌代替之。',
                handler: this.s2,
            },
        };
    }

    s1() {

    }

    s2() {

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
