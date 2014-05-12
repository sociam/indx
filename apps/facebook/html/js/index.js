/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global angular, FB, require, exports, console, process, module, describe, it, expect, jasmine*/

angular.module('facebook', ['indx'])
	.controller('main', function($scope, utils) {
		var u = utils, sa = function(f) { u.safeApply($scope, f); };

		var permissions = [
			'public_profile',
			'user_friends',
			'email',
			'user_likes',
			'user_events',
			'user_about_me',
			'user_activities',
			'user_birthday',
			'read_friendlists',
			'read_insights',
			'read_mailbox',
			'read_stream'
		];

		$scope.me = {};

		var run = function(response) { 
			console.log('login response >> ', response);
			FB.api('/me','get',function(x) { 
				console.log('/me response >> ', x);
				window.me = x;
				sa(function() { _($scope.me).extend(x); });
			});
			FB.api('/me/picture','get',function(x) { 
				console.log('/me/photo response >> ', x.data && x.data.url);
				sa(function() { $scope.me.photo = x.data && x.data.url; });
			});			
			FB.api('/me/friends','get',function(x) { 
				console.log('/friends response >> ', x);
				window.friends = x;
				sa(function() { $scope.me.friends = x.data; });
			});
		};

		var init = function() { 
			console.log('init starting >> ');
			FB.login(run, {scope: permissions.join(',')});			
		};

		window.fbAsyncInit = function() {
	        FB.init({
	          appId      : '296646860441717',
	          xfbml      : false,
	          version    : 'v1.0'
	        });
	        init();
	    };

      (function(d, s, id){
         var js, fjs = d.getElementsByTagName(s)[0];
         if (d.getElementById(id)) {return;}
         js = d.createElement(s); js.id = id;
         js.src = '//connect.facebook.net/en_US/sdk.js';
         fjs.parentNode.insertBefore(js, fjs);
       }(document, 'script', 'facebook-jssdk'));

	});