<a id="{{id}}"></a>
<article class="class" id="{{id}}">
	<h3>{{fullName}}</h3>
	{{#extend}}
	  <div class="extends">extends <a target="_blank" href="{{#url}}{{url}}{{/url}}{{^url}}#{{id}}{{/url}}"><i>{{fullName}}</i></a></div><br>
	{{/extend}}

	{{{description}}}

	{{#extends.start}}
		{{>partials/inherited-methods.mu}}
	{{/extends.start}}

	<br>
	{{#methods}}
	  {{>partials/method.mu}}
	{{/methods}}
</article>
