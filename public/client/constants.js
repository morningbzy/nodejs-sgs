const waitingClass = 'waiting bg-warning';
const readyClass = ' bg-success';
const selectedCardClass = 'selected sgs-card-selected border-success';
const selectedPlayerClass = 'selected sgs-player-selected border-success';
const selectedSkillClass = 'selected sgs-skill-selected border-success';
const lockedCardClass = 'locked sgs-card-locked border-danger';
const WAITING_FOR = {
    NOTHING: 0x0000,
    SOMETHING: 0x0001,
    CARD: 0x0002,
    TARGET: 0x0004,
    CONFIRM: 0x0008,
    SKILL: 0x0010,
    OK: 0x0020,
    CANCEL: 0x0040,
    UNCARD: 0x0080,
    UNTARGET: 0x0100,
    CHOICE: 0x0200,
    CARD_CANDIDATE: 0x0400,
    FIGURE: 0x0800,
    Y: 0x1000,
    N: 0x2000,
    PASS: 0x4000,
};

const SKILL_STATE = {
    DISABLED: 1,
    ENABLED: 2,
    CONFIRMING: 3,
    FIRING: 4,
};

const EQUIP_TYPE = {
    WEAPON: 'weapon',
    ARMOR: 'armor',
    ATTACK_HORSE: 'attackHorse',
    DEFENSE_HORSE: 'defenseHorse',
};

const POPUP_MSG_TYPE = {
    JUDGE: 'JUDGE',
    INSTEAD: 'INSTEAD',
};

function sleep(ms) {
    return new Promise((res, rej) => {
        setTimeout(res, ms);
    });
    // for (let t = Date.now(); Date.now() - t <= ms;) ;
}
