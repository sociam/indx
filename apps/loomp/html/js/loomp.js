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
				if(state.isFirstDocument){
					app.save('documents',[].concat([$scope.editDoc])).then(function () {
						loadDocumentList(box);
					});
				} else if(app.get('documents').indexOf(editDoc) == -1){
					app.save('documents', app.get('documents').concat([$scope.editDoc])).then(function () {
						loadDocumentList(box);
					});
				} else{
					console.log('already in doclist, saved only');
				}
			});
		};

		$scope.openDocument = function (doc) {
			//TODO: check if saved, ask for save before close
			sa(function() { 
				$scope.editDoc = doc;
				console.log(doc);
				tinyMCE.activeEditor.setContent(doc.attributes.content.toString()+' ');
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
	}).directive('uiTinymce', function() {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, ngModel) {
            
            element.tinymce({
                // Location of TinyMCE script
                script_url: 'js/tinymce/tiny_mce.js',

                // General options
                mode : 'textareas', 
				theme : 'ribbon',
				plugins : 'bestandsbeheer,tabfocus,advimagescale,image_tools,embed,tableextras,style,table,inlinepopups,searchreplace,contextmenu,paste,wordcount,advlist',
				inlinepopups_skin : 'ribbon_popup',
				width : "985",
				height : "800",

                // Change from local directive scope -> "parent" scope
                // Update Textarea and Trigger change event
                // you can also use handle_event_callback which fires more often
                onchange_callback: function(e) {
                    if (this.isDirty()) {
                        this.save();

                        // tinymce inserts the value back to the textarea element, so we get the val from element (work's only for textareas)
                        ngModel.$setViewValue(element.val());
                        $scope.$apply();
                        
                        return true;
                    }
                }
            });

        }
    }
});
