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
      border-bottom: 1px solid #eee;
    }
    .file {
      border-top: 1px solid #ccc;
      margin-top: 50px;
      padding-top: 20px;
    }
    .supplementary {
      /*display: none;*/
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
          $('#' + hash)[0].scrollIntoView(true);
      }, 0);
    }
    </script>
  </head>
  <body>
    <div class="sidebar">
      {{#files}}
        <div id="sidebar-{{uid}}" class="{{#parameters.supplementary}}supplementary{{/parameters.supplementary}}">
          <a href="#{{uid}}"><h3>{{title}}</h3></a>
          <ul class="nav nav-list">
            {{#classes}}
              <li class="nav-header"><a href="#{{uid}}">{{name}}</a></li>
              {{#methods}}
                {{name}}
              {{/methods}}
            {{/classes}}
          </ul>
        </div>
      {{/files}}
    </div>
    <div class="mainbody">
      <h1>{{ project.title }} {{ project.version }}</h1>

      {{project.description}}

      {{#files}}
        <section class="file {{#parameters.supplementary}}supplementary{{/parameters.supplementary}}" id="{{uid}}">
          {{>partials/file.mu}}
        </section>
      {{/files}}
    </div>
  </body>
</html>
