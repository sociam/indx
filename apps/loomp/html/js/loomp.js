angular.module('loomp',['indx'])
.controller('loomp', 
	function ($scope, client, utils) {
		//'use strict';

		var u = utils, 
			app, state, box, sa = function(fn) { return utils.safeApply($scope, fn); };
		// Wait until user is logged in and a box has been selected
		var init = function (b) {
			state = $scope.s = {};
			
			app = undefined;

			box = b;
			// create empty doc and refresh editor panel
			// load list of existing docs
			box.getObj('loomp').then(function (a) {
				app = a;
				loadDocumentList(box);
				createDocument();
			});
		};

		var createDocument = function () {
			box.getObj('document-'  + u.uuid()).then(function (doc) {
				doc.set({ title: ['Untitled document'], 'content': [' '] });
				sa(function() { $scope.editDoc = doc; });
				//saveDocument(newDoc);
			});
		};

		$scope.saveDocument = function (editDoc) {
			//TODO: check if doc with title exists, then change title to [title]([index])
			$scope.editDoc.save().then(function(){
				if(state.isFirstDocument){ // save new and create list
					app.save('documents',[$scope.editDoc]).then(function () {
						state.isFirstDocument = false;
						loadDocumentList(box);
					});
				} else if(app.get('documents').indexOf(editDoc) == -1){ // save new and add to list
					app.save('documents', [$scope.editDoc].concat(app.get('documents'))).then(function () {
						state.isFirstDocument = false;
						loadDocumentList(box);
					});
				} else{ // update existing
					console.log('already in doclist, saved only');
				}
			});
		};

		$scope.openDocument = function (doc) {
			//TODO: check if saved, ask for save before close
			sa(function() { 
				$scope.editDoc = doc;
				tinyMCE.activeEditor.setContent(doc.attributes.content.toString()+' ');
				loadAnnotationList();
			});
		};

		var loadDocumentList = function (b) {
			if(!app.has('documents')) { 
				state.isFirstDocument = true;
			} else {
				state.isFirstDocument = false;
			}
			var list = [].concat(app.get('documents'));
			sa(function() { $scope.docList = list;});
		};

		var loadAnnotationList = function () {
			console.log(tinyMCE.activeEditor.dom.select('.annotation'));
			sa(function() { $scope.annoList = tinyMCE.activeEditor.dom.select('.annotation'); });
		};

		// watches for login or box changes
		$scope.$watch('selectedBox + selectedUser', function () {
			delete $scope.msg;
			if (!$scope.selectedUser) {
				$scope.msg = 'Please log in.';
			} else if (!$scope.selectedBox) {
				$scope.msg = 'Please select a box.';
			} else {
				client.store.getBox($scope.selectedBox)
					.then(function (b) { init(b); })
					.fail(function (e) { u.error('error ', e); $scope.msg = 'An error occured.'; });
			}
			
		});

		window.$scope = $scope;
	}).value('uiTinymceConfig', {
		mode : 'textareas', 
		theme : 'modern',
		relative_urls: false,
		plugins: ["loomp advlist autolink link image lists charmap print preview hr anchor pagebreak spellchecker",
        	"searchreplace wordcount visualblocks visualchars code fullscreen insertdatetime media nonbreaking",
        	"save table contextmenu directionality template paste textcolor"],
		toolbar: "insertfile undo redo | styleselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | l      ink image | print preview media fullpage | forecolor backcolor loomp", 
		width : 980,
		height : 500
		})
  .directive('uiTinymce', ['uiTinymceConfig', function (uiTinymceConfig) {
    uiTinymceConfig = uiTinymceConfig || {};
    var generatedIds = 0;
    return {
      require: 'ngModel',
      link: function (scope, elm, attrs, ngModel) {
        var expression, options, tinyInstance,
          updateView = function () {
            ngModel.$setViewValue(elm.val());
            if (!scope.$root.$$phase) {
              scope.$apply();
            }
          };
        // generate an ID if not present
        if (!attrs.id) {
          attrs.$set('id', 'uiTinymce' + generatedIds++);
        }

        if (attrs.uiTinymce) {
          expression = scope.$eval(attrs.uiTinymce);
        } else {
          expression = {};
        }
        options = {
          // Update model when calling setContent (such as from the source editor popup)
          setup: function (ed) {
            var args;
            ed.on('init', function(args) {
              ngModel.$render();
            });
            // Update model on button click
            ed.on('ExecCommand', function (e) {
              ed.save();
              updateView();
            });
            // Update model on keypress
            ed.on('KeyUp', function (e) {
              ed.save();
              updateView();
            });
            // Update model on change, i.e. copy/pasted text, plugins altering content
            ed.on('SetContent', function (e) {
              if(!e.initial){
                ed.save();
                updateView();
              }
            });
            if (expression.setup) {
              scope.$eval(expression.setup);
              delete expression.setup;
            }
          },
          mode: 'exact',
          elements: attrs.id
        };
        // extend options with initial uiTinymceConfig and options from directive attribute value
        angular.extend(options, uiTinymceConfig, expression);
        setTimeout(function () {
          //tinymce.baseURL = "https://indx.local:8211/apps/loomp/html/js/tinymce/4";
          tinymce.init(options);
        });


        ngModel.$render = function() {
          if (!tinyInstance) {
            tinyInstance = tinymce.get(attrs.id);
          }
          if (tinyInstance) {
            tinyInstance.setContent(ngModel.$viewValue || '');
          }
        };
      }
    };
  }]).filter('filterDocs', function(){
    
	    return function(items, searchText){
	        
	        var arrayToReturn = [];
	        if(searchText){
	        	for (var i=0; i<items.length; i++){
		            if (angular.lowercase(items[i].attributes.title[0]).indexOf(angular.lowercase(searchText)) != -1) {
		                arrayToReturn.push(items[i]);
		            }
	        	}
	        } else{
	        	arrayToReturn = items;
	        }
	        
	        return arrayToReturn;
	    };
	}).filter('filterAnno', function(){
    
	    return function(items, searchAnno){
	        
	        var arrayToReturn = [];
	        if(searchAnno){
	        	for (var i=0; i<items.length; i++){
		            if (angular.lowercase(items[i].attributes.title.value).indexOf(angular.lowercase(searchAnno)) != -1) {
		                arrayToReturn.push(items[i]);
		            }
	        	}
	        } else{
	        	arrayToReturn = items;
	        }
	        
	        return arrayToReturn;
	    };
	});
