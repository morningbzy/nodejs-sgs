let figureTpl, cardTpl, userTpl, equipmentTpl, judgeCardsTpl;


$(document).ready(() => {
    // Init templates
    $.get('/client/tpl/figure.tpl', (tpl) => {
        figureTpl = tpl;
    });
    $.get('/client/tpl/card.tpl', (tpl) => {
        cardTpl = tpl;
    });
    $.get('/client/tpl/user.tpl', (tpl) => {
        userTpl = tpl;
    });
    $.get('/client/tpl/equipment.tpl', (tpl) => {
        equipmentTpl = tpl;
    });
    $.get('/client/tpl/judgecards.tpl', (tpl) => {
        judgeCardsTpl = tpl;
    });
});

