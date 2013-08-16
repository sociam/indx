<a name="{{id}}"></a>
<article class="class" id="{{id}}">
	<h3>{{fullName}}</h3>
	{{extend.id}} {{extend.fullName}}
	{{#extend}}
	  <div class="extends">extends <a target="_blank" href="#{{id}}"><i>{{fullName}}</i></a></div><br>
	  <h4>Inherited methods from {{fullName}}</h4>
	  <ul>
	  	{{#methods}}
	  		<li>{{>partials/method-abbreviated.mu}}</li>
	  	{{/methods}}
	  </ul>
	{{/extend}}
	<br>
	{{#methods}}
	  {{>partials/method.mu}}
	{{/methods}}
</article>
