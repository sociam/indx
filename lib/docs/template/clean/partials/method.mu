<article class="method" id="{{id}}">
  {{#construct}}
    <h4>Constructor</h4>
    <code class="header-example">
      new {{class.name}}({{#args}}
        {{#mode.optional}}[{{/mode.optional}}{{name}}{{^last}},{{/last}}{{#mode.optional}}]{{/mode.optional}}
      {{/args}})
    </code>
  {{/construct}}


  {{^construct}}
    <h4>{{name}}</h4>

    <code class="header-example">
      {{instanceName}}.{{name}}({{#args}}
        {{#mode.optional}}[{{/mode.optional}}{{name}}{{^last}},{{/last}}{{#mode.optional}}]{{/mode.optional}}
      {{/args}})
    </code>
  {{/construct}}

  <a class="lineno" href="#" onclick="showSource('{{file}}', {{line}})">[ line {{line}} ]</a>

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
          <li><code>{{name}}</code>
            {{#moreInfo}} -
              {{#hasTypes}}
                <span class="types">
                {{#types}}
                  <code>{{type}}</code>
                  {{^last}}or{{/last}}
                {{/types}}
                </span>
              {{/hasTypes}}
              {{comment}}
            {{/moreInfo}}
          </li>
        {{/args}}
      </ol>
    {{/hasArgs}}

    <br>

    {{#result}}
      <div class="return">
        <b>Returns</b>:
        {{#async}}
          a promise.
          <table class="table table-bordered">
            <thead><tr><th>On success</th><th>On failure</th></tr></thead>
            <tbody><tr>
              <td width="50%"><ul class="callbacks">
                {{#then}}
                  <li>
                    <code>.then( {{#args}}&lt;{{#type}}<span class="types">{{type}}{{^last}}|{{/last}}</span>{{/type}}&gt; {{comment}}{{^last}},{{/last}}{{/args}} )</code>
                    {{#comment}}- {{comment}}{{/comment}}
                  </li>
                {{/then}}
              </ul></td>
              <td width="50%"><ul class="callbacks">
                {{#fail}}
                  <li>
                    <code>.fail( {{#args}} &lt;{{#type}}<span class="types">{{type}}{{^last}}|{{/last}}</span>{{/type}}&gt; {{comment}}{{^last}},{{/last}} {{/args}} )</code>
                    {{#comment}}- {{comment}}{{/comment}}
                  </li>
                {{/fail}}
              </ul></td>
            </tr></tbody>
          </table>
        {{/async}}

        {{#return}}
          {{#hasTypes}}
            <span class="types">
            {{#types}}
              <code>{{type}}</code>
              {{^last}}or{{/last}}
            {{/types}}
            </span>
          {{/hasTypes}}
          {{comment}}
        {{/return}}

        {{#chain}}
          <code>this</code>.
        {{/chain}}
      </div>
    {{/result}}
  </div>
</article>
<hr>