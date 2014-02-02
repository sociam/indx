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
					console.error('IMAGE ERROR  -- ', error_count);
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
					if ($scope.pages.indexOf(model) < 0) { 
						$scope.pages.splice(0, 0, model); // push(model); //  = [model].concat($scope.pages); // .push(model); 
					}
				});
				// appenddebug(model);
			};
			client.store.getBox($scope.box).then(function(_box) { 
				_box.on('obj-add', function(id) { 
					_box.getObj(id).then(function(model) { 
						if (model && model.peek('type') == 'web-page') { 
							console.log('ew Page prepending >> ', model.id);
							prepend(model);
						} else {
							console.log('uncaching obj ', model.id);
							_box.uncacheObj(model);
						}
					});
				});
				entities.documents.getWebPage(_box).then(function(pages) {
					console.log('got pages >> ', pages.length, pages);
					window.pages = pages;
					pages.map(function(page) { 
						prepend(page); 
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