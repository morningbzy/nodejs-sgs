{{#info}}

{{#skill}}
<div class="sgs-card card">
    <div class="card-body p-1 d-flex justify-content-center align-items-center">
        <span class="" style=" font-weight: bold; text-shadow: 0 0 40px #dc3545; ">{{.}}</span>
    </div>
</div>
{{/skill}}

{{#cards}}
<div class="sgs-card{{#faked}} sgs-faked-card{{/faked}} card" pk="{{ pk }}"
     {{#originCards}}data-content="{{name}}<span class='sgs-card-text sgs-card-suit-{{suit}} text-dark'>{{number}}</span>"
     {{/originCards}}>
<h6 class="card-header p-1 {{#faked}}bg-danger text-white{{/faked}}">
    <span class="name">{{ name }}</span>
</h6>
<div class="card-body p-1">
    <span class="badge badge-light">{{ category }}</span>
</div>
<div class="card-footer p-1">
    <span class="sgs-card-number sgs-card-suit-{{ suit }} badge badge-light">{{ number }}</span>
</div>
</div>
{{/cards}}

{{#icon}}
<div class="p-3 text-black-50" style="font-size: 3rem;"><i class="fas fa-{{.}}"></i></div>
{{/icon}}

{{#targets}}
<div class="sgs-card card">
    <div class="card-body p-1 d-flex justify-content-center align-items-center">
        <span class="" style=" font-weight: bold; text-shadow: 0 0 40px #17a2b8; ">{{.}}</span>
    </div>
</div>
{{/targets}}

{{#text}}
<div class="p-3 text-{{type}}">{{content}}</div>
{{/text}}

{{/info}}
