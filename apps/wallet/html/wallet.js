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
                "label": "Airline / Iberia",
                "name": "airline-iberia",
                "defaults": {
                    "title": "Iberia Plus",
                    "fields": {
                        "Number": "",
                        "Status": "Clasico",
                    },
                },
                "icon": {
                    "background-image": "url(data-templates/airline-iberia/classic-xl.jpg)",
                    "background-size": "cover",
                    "width": "100px",
                    "height": "64px",
                },
                "css": {
                    "background-color": "#d7192d",
                    "color": "white",
                },
            },
            "airline-ba-blue": {
                "label": "Airline / British Airways (Blue)",
                "name": "airline-ba-blue",
                "defaults": {
                    "title": "British Airways",
                    "fields": {
                        "Number": "",
                        "Status": "Blue",
                        "Oneworld Status": "(None)",
                    },
                },
                "icon": {
                    "background-image": "url(data-templates/airline-ba-blue/blueCard_230x145.jpg)",
                    "background-size": "cover",
                    "width": "100px",
                    "height": "64px",
                },
                "css": {
                    "background-color": "#3c78c7",
                    "color": "white",
                },
            },
            "airline-ba-bronze": {
                "label": "Airline / British Airways (Bronze)",
                "name": "airline-ba-bronze",
                "defaults": {
                    "title": "British Airways",
                    "fields": {
                        "Number": "",
                        "Status": "Bronze",
                        "Oneworld Status": "Ruby",
                    },
                },
                "icon": {
                    "background-image": "url(data-templates/airline-ba-bronze/bronzeCard_230x145.jpg)",
                    "background-size": "cover",
                    "width": "100px",
                    "height": "64px",
                },
                "css": {
                    "background-color": "#9e6346",
                    "color": "white",
                },
            },
            "airline-ba-silver": {
                "label": "Airline / British Airways (Silver)",
                "name": "airline-ba-silver",
                "defaults": {
                    "title": "British Airways",
                    "fields": {
                        "Number": "",
                        "Status": "Silver",
                        "Oneworld Status": "Sapphire",
                    },
                },
                "icon": {
                    "background-image": "url(data-templates/airline-ba-silver/silverCard_230x145.jpg)",
                    "background-size": "cover",
                    "width": "100px",
                    "height": "64px",
                },
                "css": {
                    "background-color": "#666666",
                    "color": "white",
                },
            },
            "airline-ba-gold": {
                "label": "Airline / British Airways (Gold)",
                "name": "airline-ba-gold",
                "defaults": {
                    "title": "British Airways",
                    "fields": {
                        "Number": "",
                        "Status": "Gold",
                        "Oneworld Status": "Emerald",
                    },
                },
                "icon": {
                    "background-image": "url(data-templates/airline-ba-gold/goldCard_230x145.jpg)",
                    "background-size": "cover",
                    "width": "100px",
                    "height": "64px",
                },
                "css": {
                    "background-color": "#c9911a",
                    "color": "white",
                },
            },
            "airline-ba-premier": {
                "label": "Airline / British Airways (Premier)",
                "name": "airline-ba-premier",
                "defaults": {
                    "title": "British Airways",
                    "fields": {
                        "Number": "",
                        "Status": "Premier",
                        "Oneworld Status": "Emerald",
                    },
                },
                "icon": {
                    "background-image": "url(data-templates/airline-ba-premier/premierCard_230x145.jpg)",
                    "background-size": "cover",
                    "width": "100px",
                    "height": "64px",
                },
                "css": {
                    "background-color": "#101820",
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

        $scope.addCard = function(newTemplate) {

            var card = {
                "title": "New Card",
                "fields": [
                    { "key": "Field",
                      "value": "Value"
                    }
                ],
                "template": newTemplate === undefined ? "blank" : newTemplate.name, // from select box
            };

            if (newTemplate !== undefined && "defaults" in newTemplate) {
                "title" in newTemplate.defaults ? card.title = newTemplate.defaults.title : jQuery.noop();
                if ("fields" in newTemplate.defaults) {
                    card.fields = []; // reset
                    jQuery.each(newTemplate.defaults.fields, function(field, value) {
                        card.fields.push({"key": field, "value": value});
                    });
                }
            }

            $scope.cards.push(card);
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
                    jQuery.each($scope.template.icon, function (key, value) {
                        jEl.find(".card-icon").css(key, value);
                    });
                }
            }
        };
    });
