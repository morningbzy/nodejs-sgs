<div class="sgs-player sgs-cl-self {{#isYou}}is-you{{/isYou}}{{^isYou}}is-other{{/isYou}} {{#dying}}sgs-dying bg-danger{{/dying}} {{#dead}}sgs-dead bg-secondary{{/dead}} card"
     seat-num="{{ seatNum }}" pk={{id}}>
    {{#name}}
    <div class="card-body p-1 d-flex">
        <div class="sgs-player-card card {{#roundOwner}}border-warning{{/roundOwner}}">
            <h6 class="card-header p-1 {{#roundOwner}}bg-warning text-white{{/roundOwner}}">
                <span class="name">{{name}}</span>
                <span class="role badge float-right"></span>
            </h6>
            <div class="card-body p-1 d-flex flex-column">
                <div class="sgs-figure">
                    <span class="name">{{#figure}}{{name}}{{/figure}}</span>
                </div>
                <div class="sgs-equipments flex-grow-1 d-flex flex-column-reverse">
                    <div class="btn-group btn-group-sm">
                        <button class="sgs-equipment sgs-equipment-weapon btn btn-sm btn-light col-6 {{^equipments.weapon}}disabled{{/equipments.weapon}}">
                            武器{{equipments.weapon}}
                        </button>
                        <button class="sgs-equipment sgs-equipment-weapon btn btn-sm btn-light col-6 disabled">防具</button>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="sgs-equipment sgs-equipment-weapon btn btn-sm btn-light col-6 disabled">-1马</button>
                        <button class="sgs-equipment sgs-equipment-weapon btn btn-sm btn-light col-6 disabled">+1马</button>
                    </div>
                </div>
            </div>
            <div class="card-footer p-1">
                <span class="hp badge badge-danger">HP: {{hp}}</span>
                <span class="hp badge badge-info">C: {{cardCount}}</span>
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
            <button class="sgs-action-ok btn btn-primary btn-sm">OK</button>
            <button class="sgs-action-cancel btn btn-primary btn-sm">Cancel</button>
            <button class="sgs-action-pass btn btn-primary btn-sm">Pass</button>
        </div>
        {{/isYou}}
    </div>
    {{/name}}
</div>
