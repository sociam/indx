<div class="method well">
  <a name="{{uid}}"></a>
  <h4>{{name}}</h4>

  <code class="header-example">{{instanceName}}.{{name}}(
  {{#args}}
    {{#mode.optional}}[{{/mode.optional}}{{name}}{{^last}},{{/last}}{{#mode.optional}}]{{/mode.optional}}
  {{/args}}
  )</code>

  <div>

    <div class="description">
      {{description}}
    </div>

    {{#inheritedFrom}}
      inherited from <i>{{inheritedFrom.class.name}}</i>
    {{/inheritedFrom}}

    {{#hasArgs}}
      <br>
      Arguments:
      <ol class="arguments">
        {{#args}}
          <li>{{name}}
            {{#moreInfo}} -
              {{#hasTypes}}
                ({{#types}}
                  <code>{{type}}</code>
                  {{^last}}or{{/last}}
                {{/types}})
              {{/hasTypes}}
              {{comment}}
            {{/moreInfo}}
          </li>
        {{/args}}
      </ol>
    {{/hasArgs}}

    <br>

    Returns:
    <div class="return">
      {{#result.async}}
        Returns a promise. Asynchronous.
        <h6>{{instanceName}}.{{name}}(...).then (
          {{#then.args}}
            &lt;{{type}}&gt; {{comment}},
          {{/then.args}}
        )</h6>
        {{then.comment}}
        <h6>fail</h6>
        <ul>
          {{#fail.cases}}
          <li>
            <h6>{{instanceName}}.{{name}}(...).fail (
              {{#args}}
                &lt;{{type}}&gt; {{comment}},
              {{/args}}
            )</h6>
            {{comment}}
          </li>
          {{/fail.cases}}
        </ul>
      {{/result.async}}
    </div>
  </div>
</div>
