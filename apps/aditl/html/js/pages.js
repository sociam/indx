/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module, L, angular, _, jQuery */

angular.module('aditl')
	.directive('pages2page', function() { 
		return {
			restrict:'E',
			scope:{ page:'=' },
			replace:true,
			templateUrl:'/apps/aditl/templates/pages2page.html',
			controller:function($scope, $element, utils) {
				var error_count = 0, u = utils;
				// literally nothing necessary here.
				// var original_thumb;
				var sa = function(fn) { return u.safeApply($scope, fn); };
				$scope.show = true;

				var getAppropriate = function(model) { 
					var url = model.id;
					if ((/.jpeg$/gi).test(url) || (/.jpg$/gi).test(url) || (/.png$/gi).test(url) || (/.gif$/gi).test(url)) { return model.id; }
					if ((/youtube.com/gi).test(url)) {
						try { 
							var vidid = (/v=([^&]*)/gi).exec(url)[1];
							return ['http://img.youtube.com/vi/',vidid,'/0.jpg'].join('');
						} catch(e) { }
					}
					return model.peek('thumbnail'); 
				};
				$scope.thumb = getAppropriate($scope.page);
				$element.find('img.thumbnail').on('error', function() {
					console.error('IMAGE ERROR  -- ', error_count, $scope.page.id);
					error_count++;
					if (error_count > 0) {  sa(function() { $scope.show = false; }); }
					sa(function() { 
						$scope.thumb = getAppropriate($scope.page);
					});
				});
			}
		};
	}).controller('pages2', function($scope, $injector, client, utils, entities) { 
		$scope.$watch('user + box', function() { 
			var u = utils;
			var sa = function(fn) { return u.safeApply($scope, fn); };
			$scope.pages = [];
			var appenddebug = function(model) { 
				var url = model.peek('thumbnail');
				var row = ['<tr>','<td class="url">',model.id.slice(0,100),'</td>','<td>',url && url.length,'</td><td class="data"><a href="',url && url,'">',url && url.slice(0,300),'</a></td></tr>'].join('');
				console.log('appending row ', row);
				jQuery('#debugtable').append(row);
			};
			var prepend = function(model){
				// var parent = jQuery('.pages');
				// var datauri = model.peek('thumbnail');
				sa(function() { 
					console.log('model >> ', model);
					if ($scope.pages.indexOf(model) < 0) { 
						console.log('adding >> ');
						$scope.pages.splice(0, 0, model); // push(model); //  = [model].concat($scope.pages); // .push(model); 
					} else {
						// console.log('moving it up! ');
						var oldindx = $scope.pages.indexOf(model);
						$scope.pages.splice(oldindx, 1);
						$scope.pages.splice(0, 0, model);
						console.log('pages 0 is now ', $scope.pages[0].id);
					}
				});
				// appenddebug(model);
			};
			client.store.getBox($scope.box).then(function(_box) { 
				var update = function(id) {
					_box.getObj(id).then(function(model) { 
						console.log(" model >> ", model.id);
						if (model && model.peek('type') == 'activity' && model.peek('activity') == 'browse') { 
							// console.log(" GOT A BROWSE >> ", model.peek('what').id);
							var page = model.peek('what');
							if (page) { 
								// console.log('New Page prepending >> ', page.id, page.peek('thumbnail'));
								prepend(page);
							} else {
								// console.error("NO WHAT >> ", id);
							}
						} else if (model && model.peek('type') == 'web-page') {
							// console.log('prepending because its a web page');
							prepend(model);
						} else { 
							console.log('uncaching obj ', model.id);
							if (model.peek('type') !== 'web-page') { 
								_box.uncacheObj(model);
							}
						}
					});
				};
				_box.on('obj-add', function(id) { update(id); });

				entities.activities.getAll(_box, { activity: 'browse' }).then(function(actions) {
					console.log('actions >> ', actions.length);
					actions.sort(function(x,y) { return x.peek('tstart').valueOf() - y.peek('tstart').valueOf(); });
					actions.map(function(action) { 
						var page = action.peek('what');
						if (page) {  prepend(page);	}
					});
				});
			}).fail(function(bail) { console.error(bail); });
		});
		window.scope = $scope;
		// $scope.addImg = function(thumbobj) {
		// 	var data = $scope.decodeThumb(thumbobj);
		// 	jQuery(".pages").append("<img class='page' data-add='manual' style='border: 1px solid red' src='"+data+"''>");
		// };
	});