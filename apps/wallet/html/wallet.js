/* global angular, $, console, _ */


angular
    .module('wallet', ['ui', 'indx'])
    .controller('wallet', function ($scope, utils, client) {
        'use strict';

        // watches for login or box changes
        $scope.$watch('selectedBox + selectedUser', function () {
            delete $scope.msg;
            if (!$scope.selectedUser) {
                $scope.msg = 'Please log in.';
            } else if (!$scope.selectedBox) {
                $scope.msg = 'Please select a box.';
            } else {
                client.store.getBox($scope.selectedBox)
                    .then(function (box) {
                        //init(box);
                    })
                    .fail(function (e) { utils.error('error ', e); $scope.msg = 'An error occured.'; });
            }
        });
           
        // TODO load from external source
        $scope.templates = {
            "airline-iberia": {
                "icon": {
                    "background-image": "url(data-templates/airline-iberia/classic-xl.jpg)",
                    "background-size": "cover",
                },
                "css": {
                    "background-color": "#d7192d",
                    "color": "white",
                },
            },
        };

        // TODO load/save from backbone/indx
        $scope.cards = [
            { "title": "Sample card 1",
              "template": "airline-iberia",
              "fields": [
                { "key": "Name",
                  "value": "Iberia"
                },
                { "key": "Number",
                  "value": "123456"
                },
              ]
            },
            { "title": "Sample card 2",
              "template": "airline-ba",
              "fields": [
                { "key": "Name",
                  "value": "BA"
                },
                { "key": "Number",
                  "value": "23456"
                },
              ]
            },
            { "title": "Sample card 3",
              "template": "bank-halifax",
              "fields": [
                { "key": "Bank",
                  "value": "Halifax"
                },
                { "key": "Account Number",
                  "value": "56789"
                },
                { "key": "Sort-Code",
                  "value": "10-20-30"
                },
                { "key": "Balance",
                  "value": "&pound;23.50"
                },
              ]
            },
        ];

        $scope.addCard = function() {
            $scope.cards.push(
                {
                    "title": "New Card",
                    "template": "blank",
                    "fields": [
                        { "key": "Field",
                          "value": "Value"
                        }
                    ],
                }
            );
        };

    }).directive('card', function() {
        return {
            restrict: 'E',
            replace: true,
            scope: { card: '=', template: '=' },
            templateUrl: 'tmpl/card.html',
            controller: function ($scope, $element) {
                console.log("card directive controller");

                $scope.editing = false;
                $scope.toggleEdit = function() {
                    $scope.editing = !!!$scope.editing;
                };

                $scope.addField = function() {
                    $scope.card.fields.push({
                        "key": "",
                        "value": ""
                    });
                }

                // process template
                console.log($scope.template);
                if ($scope.template !== undefined) {
                    var jEl = jQuery($element);
                    jQuery.each($scope.template.css, function (key, value) {
                        jEl.css(key, value);
                    });
                }
            }
        };
    });
