
{{#extend}}
	<h4>Inherited methods from {{fullName}}</h4>
	<ul>
		{{#methods}}
			<li>{{>partials/method-abbreviated.mu}}</li>
		{{/methods}}
	</ul>

	{{>partials/inherited-methods.mu}}

{{/extend}}