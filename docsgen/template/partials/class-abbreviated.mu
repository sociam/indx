<a name="{{id}}"></a>
<h3>{{#fullName}}{{fullName}}{{/fullName}}{{^fullName}}{{name}}{{/fullName}}</h3>
{{#extends}}
  extends <i>{{name}}</i>
{{/extends}}
{{#methods}}
  {{>partials/method-abbreviated.mu}}
{{/methods}}
