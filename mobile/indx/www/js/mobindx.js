/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/*global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery,cordova,alert */


angular.module('mobindx',['indx'])
	.controller('main', function($scope, utils) { 
		var u = utils, 
			sa = function(fn) { return u.safeApply($scope, fn); },
			$s = $scope;
		var _check_login = function() { 
			$scope.credentials = localStorage._credentials && JSON.parse(localStorage._credentials);
		};
		$scope.setCredentials = function(username, host, box, token) { 
			if (!(username !== undefined && host !== undefined && box !== undefined, token !== undefined)) { 
				console.error('something was undefined');
				delete $scope.credentials;
				delete localStorage._credentials;
				return;	
			}
			var tokenset = { username: username, host: host, box : box, token : token };
			$scope.credentials = tokenset;
			localStorage._credentials = JSON.stringify(tokenset);
		};
		$scope.scanBarcode = function() { 
			if (!cordova.plugins.barcodeScanner) {	
				console.error('no barcode scanner'); 
				return; 
			}
			cordova.plugins.barcodeScanner.scan(function (result) {
				console.log("We got a barcode\n" + "Result: " + result.text + "\n" + "Format: " + result.format + "\n" + "Cancelled: " + result.cancelled); 
				if (!result.cancelled && result.text) { 
					try { 
						var jdc = JSON.parse(result.text);
						sa(function() { 
							$scope.setCredentials(jdc.username, jdc.host, jdc.box, jdc.token); });
						});
					} catch(e) { console.error('got an error ', e); }
				}
			}, function (error) {alert("Scanning failed: " + error); } ); 
		};
		_check_login();
	});