const waitingClass = 'waiting bg-warning';
const readyClass = ' bg-success';
const selectedCardClass = 'sgs-card-selected border-success';
const selectedPlayerClass = 'sgs-player-selected border-success';
const lockedCardClass = 'sgs-card-locked border-danger';
const WAITING_FOR = {
    NOTHING: 0,
    SOMETHING: 1,
    CARD: 2,
    TARGET: 3,
    CONFIRM: 4,
    PLAY: 5
};

const SKILL_STATE = {
    DISABLED: 1,
    ENABLED: 2,
    CONFIRMING: 3,
    FIRING: 4,
};

function sleep(ms) {
    return new Promise((res, rej) => {
        setTimeout(res, ms);
    });
    // for (let t = Date.now(); Date.now() - t <= ms;) ;
}
