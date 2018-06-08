var express = require('express');
var router = express.Router();

let game = require('../sgs/game');

/* GET users listing. */
router.get('/', function(req, res, next) {
    // Generate session cookie
    res.end('OK');
});

router.get('/msg', function (req, res, next) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    game.newSession(req, res);
});

router.post('/cmd', function (req, res, next) {
    res.end('ACK', 'utf-8');
    game.executeCmd(req.session.id, ...req.body.data.split(' '));
});

module.exports = router;
