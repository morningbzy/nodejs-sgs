const C = require('../constants');

class Damage {
    constructor(srcUser, srcCard, value, type = C.DAMAGE_TYPE.NORMAL) {
        this.srcUser = srcUser;
        this.srcCard = srcCard;
        this.value = value;
        this.type = type;
    }

    getTypeStr() {
        switch(this.type) {
            case C.DAMAGE_TYPE.LEI:
                return '雷属性';
            case C.DAMAGE_TYPE.HUO:
                return '火属性';
            default:
                return '';
        }
    }
}


exports = module.exports = Damage;
