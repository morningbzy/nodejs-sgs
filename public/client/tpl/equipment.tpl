<div class="sgs-equipments flex-grow-1">
    <button class="sgs-equipment sgs-equipment-weapon d-flex align-items-center btn btn-block btn-sm p-0 m-0 text-left btn-light{{^weapon}} disabled{{/weapon}}" pk="{{weapon.card.pk}}">
        <i class="sgs-icon sgs-icon-xs sgs-icon-weapon"></i>
        {{#weapon}}
        <span class="lex-shrink-1 mr-auto">[{{card.range}}]{{card.name}}</span>
        <span class="sgs-card-number sgs-card-suit-{{ card.suit }} float-right">{{card.number}}</span>
        {{/weapon}}
    </button>
    <button class="sgs-equipment sgs-equipment-armor d-flex align-items-center btn btn-block btn-sm p-0 m-0 text-left btn-light{{^armor}} disabled{{/armor}}" pk="{{armor.card.pk}}">
        <i class="sgs-icon sgs-icon-xs sgs-icon-armor"></i>
        {{#armor}}
        <span class="lex-shrink-1 mr-auto">[-]{{card.name}}</span>
        <span class="sgs-card-number sgs-card-suit-{{ card.suit }} float-right">{{card.number}}</span>
        {{/armor}}
    </button>
    <button class="sgs-equipment sgs-equipment-attack-horse d-flex align-items-center btn btn-block btn-sm p-0 m-0 text-left btn-light{{^attackHorse}} disabled{{/attackHorse}}" pk="{{attackHorse.card.pk}}">
        <i class="sgs-icon sgs-icon-xs sgs-icon-attack-horse"></i>
        {{#attackHorse}}
        <span class="lex-shrink-1 mr-auto">[-1]{{card.name}}</span>
        <span class="sgs-card-number sgs-card-suit-{{ card.suit }} float-right">{{card.number}}</span>
        {{/attackHorse}}
    </button>
    <button class="sgs-equipment sgs-equipment-defense-horse d-flex align-items-center btn btn-block btn-sm p-0 m-0 text-left btn-light{{^defenseHorse}} disabled{{/defenseHorse}}" pk="{{defenseHorse.card.pk}}">
        <i class="sgs-icon sgs-icon-xs sgs-icon-defense-horse"></i>
        {{#defenseHorse}}
        <span class="lex-shrink-1 mr-auto">[+1]{{card.name}}</span>
        <span class="sgs-card-number sgs-card-suit-{{ card.suit }} float-right">{{card.number}}</span>
        {{/defenseHorse}}
    </button>
</div>
