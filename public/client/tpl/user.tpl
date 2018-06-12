<div class="sgs-player sgs-cl-self card {{#isYou}}is-you{{/isYou}}{{^isYou}}is-other{{/isYou}}"
     seat-num="{{ seatNum }}" pk={{id}}>
    {{#name}}
    <div class="card-body p-1 d-flex">
        <div class="sgs-player-card card">
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
        {{#isYou}}
        <div id="sgs-card-panel" class="sgs-cl-children d-flexi ml-1 position-relative"></div>
        <div id="sgs-action-panel" class="position-absolute">
            <button class=" sgs-action-ok btn btn-primary btn-sm">OK</button>
            <button class=" sgs-action-cancel btn btn-primary btn-sm">Cancel</button>
            <button class=" sgs-action-pass btn btn-primary btn-sm">Pass</button>
        </div>
        {{/isYou}}
    </div>
    {{/name}}
</div>