<hr>
<a name="{{id}}"></a>
<div class="method " id="{{id}}">
  <h4>{{name}}</h4>

  <code class="header-example">{{instanceName}}.{{name}}(
  {{#args}}
    {{#mode.optional}}[{{/mode.optional}}{{name}}{{^last}},{{/last}}{{#mode.optional}}]{{/mode.optional}}
  {{/args}}
  )</code>

  <a class="lineno" href="#" onclick="showSource('{{file}}', {{line}})">line {{line}}</a>

  <div>

    <div class="description">
      {{{description}}}
    </div>

    {{#inheritedFrom}}
      inherited from <i>{{inheritedFrom.class.name}}</i>
    {{/inheritedFrom}}

    {{#hasArgs}}
      <br>
      <b>Arguments</b>:
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

    <div class="return">
      <b>Returns</b>:
      {{#result.async}}
        a promise.
        <table class="table table-bordered">
          <thead><tr><th>On success</th><th>On failure</th></tr></thead>
          <tbody><tr>
            <td width="50%"><ul>
              <li>
                <code>.then({{#then.args}}&lt;{{type}}&gt; {{comment}},{{/then.args}})</code> -
                {{then.comment}}
              </li>
            </ul></td>
            <td width="50%"><ul>
              {{#fail.cases}}
                <li>
                  <code>.fail({{#then.args}}&lt;{{type}}&gt; {{comment}},{{/then.args}})</code> -
                  {{comment}}
                </li>
              {{/fail.cases}}
            </ul></td>
          </tr></tbody>
        </table>
      {{/result.async}}

      {{#result.return}}
        {{#hasTypes}}
          ({{#types}}
            <code>{{type}}</code>
            {{^last}}or{{/last}}
          {{/types}})
        {{/hasTypes}}
        {{comment}}
      {{/result.return}}

      {{#result.chain}}
        <code>this</code>.
      {{/result.chain}}
    </div>
  </div>
</div>
