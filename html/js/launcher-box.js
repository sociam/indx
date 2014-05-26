/* jshint undef: true, strict:false, trailing:false, unused:false, -W110 */
/*global $,_,document,window,console,escape,Backbone,exports,WebSocket,process,_NODE_AJAX,angular,jQuery */
angular.module('launcher')
	.directive('indxBoxlistBox',function() {
		return {
			restrict:'E',
			replace:false,
			templateUrl:'templates/box.html',
			link:function($scope, $element) {
				$scope.el = $element;
			},
			scope: { box:"=b" },
			controller: function($scope, client, backbone, utils) {
				var u = utils, sa = function(f) { utils.safeApply($scope,f); };
				var guid = u.guid(), old_box;

				$scope.obj_ids = $scope.box ? $scope.box.getObjIDs() : [];
				$scope.obj_count = $scope.obj_ids.length;

				$scope.$watch('box', function(b) { 
					console.log('::::::::::::::::::::::::::::::::: boxlist box ', b);
					if (!$scope.box) { return; }
					if (old_box) { old_box.off(undefined, undefined, guid); }

					$scope.obj_ids = $scope.box ? $scope.box.getObjIDs() : [];
					$scope.obj_count = $scope.obj_ids.length;
					$scope.boxtoken = $scope.box._getCachedToken() || $scope.box._getStoredToken();

					$scope.box.on('obj-add', function(result) {
						// console.log('obj add ', result, typeof(result));
						sa(function() { $scope.obj_count++; });
					}, guid);
					$scope.box.on('obj-remove', function(result) { 
						sa(function() { $scope.obj_count--; });
					}, guid);
					old_box = $scope.box;

				});
				$scope.deleteBox = function() {
					console.log("Attempting to delete box ", $scope.box);
					$scope.box.deleteBox($scope.box.getID());
				};
				$scope.emptyBox = function() {
					console.log("Attempting to empty box ", $scope.box);
					$scope.box._doDelete($scope.obj_ids).then(function() {
						sa(function() { 
							$scope.obj_ids = $scope.box ? $scope.box.getObjIDs() : [];
							$scope.obj_count = $scope.obj_ids.length;
						});
					});
				};
			}
		};
	}).directive('tokenQrcode', function() { 
		return {
			restrict:'E',
			replace:false,
			template:'<div class="qrcode"></div>',
			link:function($scope, $element) {
				console.log('element >>', $element, $element[0]);
				$scope.el = $element;
				$scope.qel = $element.find('.qrcode')[0];
			}, 
			scope: { box:"=" },
			controller:function($scope, client, utils) {
				var u = utils, sa = function(f) { utils.safeApply($scope,f); };
				var last_box;
				$scope.$watch('box', function() { 
					if ($scope.qrcode) {
						$scope.qrcode.clear();
					}
					if ($scope.box !== undefined && $scope.box !== last_box){
						var t  = $scope.box._getCachedToken() || $scope.box._getStoredToken();
						var h = $scope.box.store.get('server_host');
						console.log('token >> ', t, ' >> host >> ', h);
						var qrdata =  { token: t, host : h	};
						$scope.box.store.checkLogin().then(function(l) {
							console.log('checklogin >> ', l);
							if (l.username) {
								qrdata.username = l.username;
							}
							sa(function() { 
								if ($scope.qrcode) {
									console.log('qrcode exists ');
									$scope.qrcode.makeCode(t);
								} else {
									console.log('initialising .. ');
									$scope.qrcode = new QRCode($scope.qel, 
										{
											text:JSON.stringify(qrdata),
											width:250,height: 250, 
											colorDark : "#000000",
											colorLight : "#ffffff",
											correctLevel : QRCode.CorrectLevel.H
										}
									);
								}
							});
						});
						last_box = $scope.box;
					}
				});	
				window.sqr = $scope;				
			}
		};
	});