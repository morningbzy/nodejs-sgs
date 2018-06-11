{{#cards}}
<div class="sgs-card card position-absolute" pk="{{ pk }}">
    <h6 class="card-header p-1">
        <span class="name">{{ name }}</span>
        <span class="badge badge-dark float-right">{{ category }}</span>
    </h6>
    <div class="card-body p-1">
    </div>
    <div class="card-footer p-1">
        <span class="sgs-card-number sgs-card-suit-{{ suit }} badge badge-light text-danger">{{ number }}</span>
    </div>
</div>
{{/cards}}
