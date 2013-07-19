<!DOCTYPE html>
<html>
  <head>
    <title>{{ project.title }} {{ project.version }} documentation</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="lib/bootstrap/css/bootstrap.min.css" rel="stylesheet" media="screen">
    <style>
    body {
      max-width: 900px;
    }
    .sidebar {
      position: fixed;
      z-index: 10;
      top: 0;
      left: 0;
      bottom: 0;
      width: 230px;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      padding: 15px 0 30px 30px;
      border-right: 1px solid #bbb;
      box-shadow: 0 0 20px #ccc;
      -webkit-box-shadow: 0 0 20px #ccc;
      -moz-box-shadow: 0 0 20px #ccc;
    }
    .mainbody {
      margin-left: 300px;
    }
    h3 {
      color: #c17878;
      display: inline-block;
      padding-right: 15px;
    }
    .extends {
      display: inline-block;
      font-size: 14px;
    }
    h4 {
      display: inline-block;
      padding-right: 15px;
      color: #78ba91;
    }
    code.header-example {
      background: transparent;
      border: 0;
    }
    .class {
      padding: 5px 0 20px;
      border-bottom: 1px solid #eee;
    }
    .file {
      border-top: 1px solid #ccc;
      margin-top: 50px;
      padding-top: 20px;
    }
    </style>
    <script>
    data = {{{json}}}
    </script>
  </head>
  <body>
    <div class="sidebar">
      {{#files}}
        <h3>{{title}}</h3>
        {{^parameters.supplementary}}
          <ul class="nav nav-list">
            {{#classes}}
              <li class="nav-header"><a href="#{{uid}}">{{name}}</a></li>
              {{#methods}}
                <li><a href="#{{uid}}">{{name}}</a></li>
              {{/methods}}
            {{/classes}}
          </ul>
        {{/parameters.supplementary}}
      {{/files}}
    </div>
    <div class="mainbody">
      <h1>{{ project.title }} {{ project.version }}</h1>

      {{project.description}}

      {{#files}}
        <div class="file">
          {{^parameters.supplementary}}
            {{>partials/file.mu}}
          {{/parameters.supplementary}}
          {{#parameters.supplementary}}
            {{>partials/file-abbreviated.mu}}
          {{/parameters.supplementary}}
        </div>
      {{/files}}
    </div>
  </body>
</html>
