<article class="class" id="{{id}}">
	<h3>{{fullName}}</h3>
	{{#extend}}
	  <div class="extends">extends <a target="_blank" href="{{#url}}{{url}}{{/url}}{{^url}}#classI{{id}}{{/url}}"><i>{{fullName}}</i></a></div><br>
	{{/extend}}

	{{{description}}}

	{{#extend.start}}
		{{>partials/inherited-methods.mu}}
	{{/extend.start}}

	<br>
	{{#methods}}
	  {{>partials/method.mu}}
	{{/methods}}
</article>
