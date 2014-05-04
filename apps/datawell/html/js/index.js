/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, $ */

var vApp = angular.module('vitality', ['indx', 'ui.router', 'ngAnimate']);

// app 
// wellbeing diary 
// view history of edits
// clinical incident view
// 
// config uirouter
vApp.config(function($stateProvider, $urlRouterProvider) {
  // For any unmatched url, redirect to /state1
  $urlRouterProvider.otherwise('/home');
  //
  // Now set up the states
  $stateProvider
    .state('home', { 
      url:'/home',
      templateUrl:'partials/home.html',
      resolve: {
        whom: function(client, utils) { 
          var u = utils, d = u.deferred();
          client.store.checkLogin().then(function(x) { d.resolve(x);  }).fail(d.reject);
          return d.promise();
        }
      },      
      controller:function($scope, $stateParams, whom) { 
        console.log('stateparams >> ', $scope.error, $stateParams.error);
        if ($stateParams.error) { $scope.error = $stateParams.error; }
        if (whom && whom.user_metadata) { 
            var um = JSON.parse(whom.user_metadata);
            if (um.name) { $scope.name = um.name; };
        }
      }
    })
    .state('edit', {
      url: '/edit',
      template: '<div class="edit"><h1>edit</h1><div ui-view></div></div>'
    })
    .state('edit.form', {
      url: '/:form',
        template: '<div class="form"><h2>form</h2><div ui-view></div></div>',
        controller: function($scope, $stateParams) {
          console.log('edit.form.field stateparams ', $stateParams.form);
          $scope.things = ['A', 'Set', 'Of', 'Things'];
        }
      })
    .state('edit.form.field', {
      url: '/:field',
      template: '<div class="field"><h2>field</h2> {{ field }} </div>',
      controller:function($scope, $stateParams) {
        console.log('edit.form.field stateparams ', $stateParams.form, $stateParams.field);
        $scope.field = $stateParams.field;
      }
    });
  });

// main controller.
vApp.controller('main', function($scope, $rootScope, $state, client, utils) {
  var u = utils, sa = function(fn) { return u.safeApply($scope, fn); };

  $scope.errorContainer = {};
  console.log('$state -- ', $state && $state.current && $state.current.name);
  $scope.state = $state && $state.current && $state.current.name;
  window._state =  $state;

  $rootScope.$on('$stateChangeStart', function(x, y, z) { console.info('state change start >> ', x, y, z);  });
  $rootScope.$on('$stateChangeSuccess', function(x, y, z) { console.info('state change success >> ', x, y, z); 
      $scope.state = y.name;
      console.log('state >> ', $scope.state);    
  });
  $rootScope.$on('$stateChangeError', function(x, y, z) { 
    console.error('state change error >> ', x, y, z); 
    $state.go('home', {error: 'Something happened -- please make sure you are logged in '}); 
    $scope.errorContainer.error = 'something happened - please make sure you are logged in';
  });
  $rootScope.$on('$stateNotFound', function(x, y, z) { 
    console.error('state not found >> ', x, y, z); 
    $state.go('home', {error: 'Something happened -- please make sure you are logged in '}); 
    $scope.errorContainer.error = 'something happened - please make sure you are logged in';    
  });

  $scope.$watch('boxid', function(boxid) { 
    if (boxid !== undefined) { 
      client.store.getBox(boxid).then(function(box) {
        sa(function() { $scope.box = box; });
      }).fail(function(error) { 
        console.error('error getting box', error);
      });
    }
  });
  window.$s = $scope;
  window.store = client.store;


  // debugging
  // console.log('hi');
  // client.store.box('a').then(function(c) { 
  //   console.log('c >> ', c);
  // });

});