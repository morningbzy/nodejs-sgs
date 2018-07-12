<div class="sgs-judge-cards position-absolute d-flex flex-row-reverse">
    {{#judgeStack}}
    <div class="sgs-judge-card badge badge-dark" pk="{{ card.pk }}">
        <span>{{ card.shortName }}</span>
    </div>
    {{/judgeStack}}
</div>
