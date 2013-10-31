<!DOCTYPE html>
<html>
<head>
	<title>{{ project.title }} documentation</title>
	<meta content="width=device-width, initial-scale=1.0" name="viewport">
	<link href="lib/bootstrap/css/bootstrap.min.css" media="screen" rel=
	"stylesheet">
	<link href="style.css" media="screen" rel="stylesheet">
	<script src="lib/jquery.min.js"></script>
	<script src="lib/bootstrap/js/bootstrap.min.js"></script>
	<script>
		var data = {{{json}}};
	</script>
	<script src="script.js"></script>
</head>

<body>
	<nav class="navbar navbar-default navbar-fixed-top" role="navigation">
		<div class="navbar-header">
			<a class="navbar-brand" href="#">{{ project.title }}</a>
		</div>

		<ul class="nav navbar-nav">
			<li class="nav-overview active"><a href="#">Overview</a></li>
			<li class="nav-api"><a href="#api">API</a></li>
			<li class="dropdown">
				<a class="dropdown-toggle" data-toggle="dropdown" href=
				"#api">Referenced APIs <b class="caret"></b></a>
				<ul class="dropdown-menu">
					{{#files}}
					{{#supplementary}}
					<li class="nav-fileI{{id}}"><a href="#fileI{{id}}">{{title}}</a></li>
					{{/supplementary}}
					{{/files}}
				</ul>
			</li>
		</ul>
	</nav>

	<div class="sidebar">
		{{#files}}
		<section class="file {{^supplementary}}api{{/supplementary}}" id="sidebar-{{id}}">
			<a href="#fileI{{id}}"><h2>{{title}}</h2></a>

			<ul class="nav nav-list">
				{{#classes}}
				<li class="nav-header" id="sidebar-{{id}}"><a href="#classI{{id}}">{{name}}</a></li>
				{{#methods}}
				<li id="sidebar-{{id}}"><a href="#methodI{{id}}">{{name}}</a></li>
				{{/methods}}
				{{/classes}}
			</ul>
		</section>
		{{/files}}
	</div>

	<div class="mainbody">
		<section class="overview">
			<h1>{{ project.title }}</h1>
			<div class="text-muted">Version {{ project.version }}</div>
			{{{project.description}}}
			{{#readme}}
			<h2 class="splittitle">Readme</h2>
			{{{readmeDescription}}}
			{{/readme}}
		</section>

		<section class="api">
			<h1>API Reference</h1>
		</section>

		{{#files}}
		{{>partials/file.mu}}
		{{/files}}
	</div>
</body>
</html>