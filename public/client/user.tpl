<div class="sgs-player sgs-cl-self card {{#isYou}}is-you{{/isYou}}{{^isYou}}is-other{{/isYou}}"
     seat-num="{{ seatNum }}">
    {{#name}}
    {{#isYou}}
    <h6 class="card-header p-1">
        <span class="name">{{name}}</span>
        <span class="role badge float-right"></span>
    </h6>
    <div class="card-body p-1">
        <div class="sgs-figure">
            <span class="name">{{#figure}}{{name}}{{/figure}}</span>
        </div>
    </div>
    <div class="card-footer p-1">
        <span class="hp badge{{#hp}} badge-danger{{/hp}}">HP: {{hp}}</span>
        <span class="hp badge{{#cardCount}} badge-info{{/cardCount}}">C: {{cardCount}}</span>
    </div>
    {{/isYou}}
    {{^isYou}}
    <div class="card-body p-1 card-group">
        <div class="card">
            <h6 class="card-header p-1">
                <span class="name">{{name}}</span>
                <span class="role badge float-right"></span>
            </h6>
            <div class="card-body p-1">
                <div class="sgs-figure">
                    <span class="name">{{#figure}}{{name}}{{/figure}}</span>
                </div>
            </div>
            <div class="card-footer p-1">
                <span class="hp badge{{#hp}} badge-danger{{/hp}}">HP: {{hp}}</span>
                <span class="hp badge{{#cardCount}} badge-info{{/cardCount}}">C: {{cardCount}}</span>
            </div>
        </div>
    </div>
    {{/isYou}}
    {{/name}}
</div>
