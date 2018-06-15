<div class="sgs-equipments flex-grow-1">
    <button class="sgs-equipment sgs-equipment-weapon d-flex btn btn-block btn-sm p-0 m-0 text-left {{#weapon}}{{skillStateClass}}{{/weapon}}{{^weapon}}btn-light disabled{{/weapon}}">
        <span class="sgs-equipment-symbol">&#9876;</span>
        {{#weapon}}
        <span class="lex-shrink-1 mr-auto">[?]{{card.name}}</span>
        <span class="sgs-card-number sgs-card-suit-{{ card.suit }} float-right">{{card.number}}</span>
        {{/weapon}}
    </button>
    <button class="sgs-equipment sgs-equipment-armor d-flex btn btn-block btn-sm p-0 m-0 text-left {{#armor}}{{skillStateClass}}{{/armor}}{{^armor}}btn-light disabled{{/armor}}">
        <span class="sgs-equipment-symbol">&#9820;</span>
        {{#armor}}
        <span class="lex-shrink-1 mr-auto">[?]{{card.name}}</span>
        <span class="sgs-card-number sgs-card-suit-{{ card.suit }} float-right">{{card.number}}</span>
        {{/armor}}
    </button>
    <button class="sgs-equipment sgs-equipment-attack-horse d-flex btn btn-block btn-sm p-0 m-0 text-left {{#attackHorse}}{{skillStateClass}}{{/attackHorse}}{{^attackHorse}}btn-light disabled{{/attackHorse}}">
        <span class="sgs-equipment-symbol">&#8314;&#9822;</span>
        {{#attackHorse}}
        <span class="lex-shrink-1 mr-auto">[?]{{card.name}}</span>
        <span class="sgs-card-number sgs-card-suit-{{ card.suit }} float-right">{{card.number}}</span>
        {{/attackHorse}}
    </button>
    <button class="sgs-equipment sgs-equipment-defense-horse d-flex btn btn-block btn-sm p-0 m-0 text-left {{#defenseHorse}}{{skillStateClass}}{{/defenseHorse}}{{^defenseHorse}}btn-light disabled{{/defenseHorse}}">
        <span class="sgs-equipment-symbol">&#8315;&#9816;</span>
        {{#defenseHorse}}
        <span class="lex-shrink-1 mr-auto">[?]{{card.name}}</span>
        <span class="sgs-card-number sgs-card-suit-{{ card.suit }} float-right">{{card.number}}</span>
        {{/defenseHorse}}
    </button>
</div>
