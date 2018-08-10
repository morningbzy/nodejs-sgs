<div class="sgs-player sgs-cl-self {{#isYou}}is-you{{/isYou}}{{^isYou}}is-other{{/isYou}} {{#dying}}sgs-dying bg-danger{{/dying}} {{#dead}}sgs-dead bg-secondary{{/dead}} card"
     seat-num="{{ seatNum }}" pk={{id}}>
    {{#name}}
    <div class="card-body p-1 d-flex">
        <div class="sgs-player-card card {{#roundOwner}}border-warning{{/roundOwner}}">
            <h6 class="card-header p-1 {{#roundOwner}}bg-warning text-white{{/roundOwner}}">
                <span class="name">{{name}}</span>
                <span class="role badge float-right"></span>
                {{#marker.size}}
                <span class="sgs-player-marker badge badge-info" data-content="{{>userMarkers}}">
                    <span>{{marker.name}}</span>
                </span>
                {{/marker.size}}
            </h6>
            <div class="card-body py-1 pl-1 pr-0 d-flex align-items-stretch">
                <div class="sgs-figure flex-grow-1">
                    <span class="name text-truncate">{{#figure}}{{name}}{{/figure}}</span>
                    {{#status}}
                    <i class="fas fa-{{.}} text-info"></i>
                    {{/status}}
                </div>
                <div class="d-flex flex-column justify-content-between text-center font-weight-bold">
                    <span class="sgs-player-hp rounded-left bg-light text-danger d-block">{{hp}}/{{maxHp}}</span>
                    <span class="sgs-hand-card-count rounded-left bg-secondary text-white text-center d-block">{{cardCount}}</span>
                </div>
            </div>
            <div class="card-footer px-1 py-0">
                {{#equipments}}
                {{>equipments}}
                {{/equipments}}
                <div class="sgs-judge-cards position-absolute d-flex flex-row-reverse">
                    {{#judgeStack}}
                    {{>judgeStack}}
                    {{/judgeStack}}
                </div>
            </div>
        </div>
        {{#isYou}}
        <div id="sgs-card-panel" class="sgs-cl-children ml-1 position-relative"></div>
        <div id="sgs-skill-panel" class="position-absolute">
            {{#figure.skills}}
            <button class="sgs-skill btn btn-sm px-3 {{skillStateClass}}" pk="{{pk}}">{{name}}</button>
            {{/figure.skills}}
        </div>
        <div id="sgs-action-panel" class="position-absolute">
            <button class="sgs-action sgs-action-ok btn btn-primary btn-sm" action="OK" waiting-tag="OK">OK</button>
            <button class="sgs-action sgs-action-cancel btn btn-primary btn-sm" action="CANCEL" waiting-tag="CANCEL">
                Cancel
            </button>
            <button class="sgs-action sgs-action-pass btn btn-primary btn-sm" action="PASS" waiting-tag="PASS">Pass
            </button>
        </div>
        {{/isYou}}
    </div>
    {{/name}}
</div>
