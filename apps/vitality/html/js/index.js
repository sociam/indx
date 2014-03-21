/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery, $ */

var vApp = angular.module('vitality', ['ui.router']);

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
      template:'<div class="home">welcome home <ol><li ui-sref="diary">Goto diary</li></ol></div>',
    })
    // .state('diary', {
    //   url: '/diary',
    //   template:'<div><h2>Diary</h2><div ui-view></div></div>',
    //   controller:function($scope, $state, $stateParams) {
    //     console.log('diary >> ', $state, $stateParams);
    //   }
    // })
    .state('diary', {
      url: '/diary/:entry',
      template: '<div class="entry"> entry {{ entry }} </div>',
      controller: function($scope, $state, $stateParams) {
        console.log('stateparams >> ', $stateParams, $stateParams.entry);        
        $scope.items = ['A', 'List', 'Of', 'Items'];
        $scope.entry = $stateParams.entry;
        if (!$stateParams.entry || $stateParams.entry.trim().length == 0) {  
          console.log('going >> ');
          $state.go('diary', {entry:'today'}); 
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
vApp.controller('main', function($scope, $rootScope) {
  console.log('main >> ');
  $rootScope.$on('$stateChangeStart', function(x, y, z) { console.info('state change start >> ', x, y, z);  });
  $rootScope.$on('$stateChangeSuccess', function(x, y, z) { console.info('state change success >> ', x, y, z); });
  $rootScope.$on('$stateChangeError', function(x, y, z) { console.error('state change success >> ', x, y, z); });
  $rootScope.$on('$stateNotFound', function(x, y, z) { console.error('state not found >> ', x, y, z); });
});