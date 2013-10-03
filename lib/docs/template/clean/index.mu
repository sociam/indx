<!DOCTYPE html>
<html>
  <head>
    <title>{{ project.title }} {{ project.version }} documentation</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="lib/bootstrap/css/bootstrap.min.css" rel="stylesheet" media="screen">
    <script src="lib/jquery.min.js"></script>
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
    }
    .file {
      border-top: 1px solid #ccc;
      margin-top: 50px;
      padding-top: 20px;
    }
    .supplementary {
      display: none;
    }
    .method {
      position: relative;
    }
    .lineno {
      position: absolute;
      top: 10px;
      right: 0px;
      color: #BBB;
      font-size: 11px;
    }
    code {
      color: #111;
      background: rgba(0, 0, 0, 0.016);
      border-color: rgba(0, 0, 0, 0.06);
    }
    </style>
    <script>
    var data = {{{json}}};

    var fileCache = {};
    function showSource (file, line) {
      if (fileCache[file]) {
        openFilePane(fileCache[file], line);
      } else {
        $.get(file, function (data) {
          fileCache[file] = data;
          openFilePane(data, line);
        });
      }
    }
    function openFilePane (data, line) {
      console.log(data, line);
    }
    $(function () { route(); });
    $(window).on('hashchange', function (e) { route(); });

    function route () {
      var hash = window.location.hash.substr(1),
          parts = hash.split('_'),
          file = parts.shift(),
          cls = parts.shift(),
          method = parts.shift();
      if (method) {
          console.log('Method: ' + method)
      }
      if (cls) {
          console.log('Class: ' + cls);
      }
      if (file) {
          console.log('File: ' + file);
          var $file = $('#' + file);
          if ($file.hasClass('supplementary')) {
            $file.show().siblings().hide();
            $('#sidebar' + file).show().siblings().hide();
          }
      }
      setTimeout(function () {
          if ($('#' + hash).length) {
            $('#' + hash)[0].scrollIntoView(true);
          }
      }, 0);
    }
    </script>
  </head>
  <body>
    <div class="sidebar">
      {{#files}}
        <div id="sidebar-{{id}}" class="{{#supplementary}}supplementary{{/supplementary}}">
          <a href="#{{id}}"><h3>{{title}}</h3></a>
          <ul class="nav nav-list">
            {{#classes}}
              <li class="nav-header"><a href="#{{id}}">{{name}}</a></li>
              {{#methods}}
                <li><a href="#{{id}}">{{name}}</a></li>
              {{/methods}}
            {{/classes}}
          </ul>
        </div>
      {{/files}}
    </div>
    <div class="mainbody">
      <h1>{{ project.title }} {{ project.version }}</h1>

      {{{project.description}}}

      <div ng-if="readme_description">
        <h2>README</h2>
        {{{readme_description}}}
      </div>

      {{#files}}
        <section class="file {{#supplementary}}supplementary{{/supplementary}}" id="{{id}}">
          {{>partials/file.mu}}
        </section>
      {{/files}}
    </div>
  </body>
</html>
