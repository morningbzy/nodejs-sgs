
let figureTpl, cardTpl, userTpl;


$(document).ready(() => {
    $.get('/client/figure.tpl', (tpl) => {
        figureTpl = tpl;
    });
    $.get('/client/card.tpl', (tpl) => {
        cardTpl = tpl;
    });
    $.get('/client/user.tpl', (tpl) => {
        userTpl = tpl;
    });
});

