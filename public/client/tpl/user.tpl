<div class="sgs-player sgs-cl-self card {{#isYou}}is-you{{/isYou}}{{^isYou}}is-other{{/isYou}}"
     seat-num="{{ seatNum }}" pk={{id}}>
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
        <span class="hp badge badge-danger">HP: {{hp}}</span>
        <span class="hp badge badge-info">C: {{cardCount}}</span>
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
                <span class="hp badge badge-danger">HP: {{hp}}</span>
                <span class="hp badge badge-info">C: {{cardCount}}</span>
            </div>
        </div>
    </div>
    {{/isYou}}
    {{/name}}
</div>
