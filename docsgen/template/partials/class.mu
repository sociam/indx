<a name="{{uid}}"></a>
<article class="class" id="{{uid}}">
	<h3>{{fullName}}</h3>
	{{#extend}}
	  <div class="extends">extends <a target="_blank" href="#{{uid}}"><i>{{fullName}}</i></a></div><br>
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
