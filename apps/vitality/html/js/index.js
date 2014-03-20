angular.module('vitalityApp', ['indx', 'ngRoute', 'vitalityControllers'])
 
phonecatApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/setkey', {
        templateUrl: 'partials/key-set.html',
        controller: 'KeySetController'
      }).
      when('/diary', {
        templateUrl: 'partials/diary.html',
        controller: 'DiaryController'
      }).
      when('/clinic', {
        templateUrl: 'partials/diary.html',
        controller: 'DiaryController'
      }).
      when('/triage', {
        templateUrl: 'partials/triage.html',
        controller: 'TriageController'
      }).
      when('/init', {
        templateUrl: 'partials/init.html',
        controller: 'InitialController'
      }).
      otherwise({
        redirectTo: '/init'
      });
  }]);
