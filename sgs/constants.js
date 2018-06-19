Constants = {
    GAME_STATE: {
        CONNECTED: 0,
        PREPARING: 1,
        STARTED: 2,
        CHOOSING_FIGURE: 3,
        INIT_CARDS: 4,
        ROUNDS: 5,
        ENDING: 6,
    },
    USER_STATE: {
        CONNECTED: 0,
        READY: 1,
        PREPARING: 2,
        ALIVE: 3,
        DYING: 4,
        DEAD: 5,
    },
    WAITING_FOR: {
        NOTHING: 0,
        SOMETHING: 1,
        CARD: 2,
        TARGET: 3,
        CONFIRM: 4,
        PLAY: 5,
    },
    ROLE: {
        ZHUGONG: 0,
        ZHONGCHEN: 1,
        FANZEI: 2,
        NEIJIAN: 3,
    },
    COUNTRY: {
        WEI: '魏',
        SHU: '蜀',
        WU: '吴',
        QUN: '群',
    },
    GENDER: {
        MALE: 0,
        FEMALE: 1,
    },
    SKILL_STYLE: {
        NORMAL: 0,
        ZHUGONG: 1,
        SUODING: 2,
        XIANDING: 3,
        JUEXING: 4,
    },
    SKILL_STATE: {
        DISABLED: 1,
        ENABLED: 2,
        CONFIRMING: 3,
        FIRING: 4,
    },
    CARD_SUIT: {
        SPADE: 'spade',
        HEART: 'heart',
        CLUB: 'club',
        DIAMOND: 'diamond',
        NONE: 'none',  // Sometimes, there's no suit
    },
    CARD_CATEGORY: {
        NORMAL: 0,
        SILK_BAG: 1,
        DELAYED_SILK_BAG: 2,
        EQUIPMENT: 3,
    },
    CONFIRM: {
        Y: 'Y',
        N: 'N',
    },
    EQUIP_TYPE: {
        WEAPON: 'weapon',
        ARMOR: 'armor',
        ATTACK_HORSE: 'attackHorse',
        DEFENSE_HORSE: 'defenseHorse',
    }
};
Constants.ROLES_MAPPING = {
    2: [Constants.ROLE.ZHUGONG, Constants.ROLE.FANZEI],
    3: [Constants.ROLE.ZHUGONG, Constants.ROLE.FANZEI, Constants.ROLE.NEIJIAN],
    4: [Constants.ROLE.ZHUGONG, Constants.ROLE.ZHONGCHEN, Constants.ROLE.FANZEI, Constants.ROLE.NEIJIAN],
    5: [Constants.ROLE.ZHUGONG, Constants.ROLE.ZHONGCHEN, Constants.ROLE.FANZEI, Constants.ROLE.FANZEI, Constants.ROLE.NEIJIAN],
    // TODO
};

module.exports = Constants;
