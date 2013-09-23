<a name="{{id}}"></a>
<article class="class" id="{{id}}">
	<h3>{{fullName}}</h3>
	{{#extend}}
	  <div class="extends">extends <a target="_blank" href="#{{id}}"><i>{{fullName}}</i></a></div><br>
	{{/extend}}

	{{{description}}}

	{{>partials/inherited-methods.mu}}
	<br>
	{{#methods}}
	  {{>partials/method.mu}}
	{{/methods}}
</article>
