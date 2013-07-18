// Provides the structure and documention for Backbone
(function () {
	"use strict";

	var Backbone = {};

	Backbone.Model = function () {
	};

	/// @arg properties
	/// @opt classProperties
	///
	/// To create a Model class of your own, you extend Backbone.Model and
	/// provide instance properties, as well as optional classProperties to be
	/// attached directly to the constructor function.
	Backbone.Model.prototype.extend = function () {};

	/// @opt attributes
	/// @opt options
	/// When creating an instance of a model, you can pass in the initial values of the attributes, which will be set on the model. If you define an initialize function, it will be invoked when the model is created.
	Backbone.Model.prototype.initialize = function () {};

	/// @arg attribute
	/// Get the current value of an attribute from the model. For example: note.get("title")
	Backbone.Model.prototype.get = function () {};

	Backbone.Model.prototype.set = function () {};

	Backbone.Model.prototype.escape = function () {};

	Backbone.Model.prototype.has = function () {};

	Backbone.Model.prototype.unset = function () {};

	Backbone.Model.prototype.clear = function () {};

	Backbone.Model.prototype.toJSON = function () {};

	Backbone.Model.prototype.initialize = function () {};

	Backbone.Model.prototype.fetch = function () {};

	Backbone.Model.prototype.save = function () {};

	Backbone.Model.prototype.destroy = function () {};

	Backbone.Model.prototype.isValid = function () {};

	Backbone.Model.prototype.clone = function () {};

	Backbone.Model.prototype.isNew = function () {};

	Backbone.Model.prototype.hasChanged = function () {};

	Backbone.Model.prototype.previous = function () {};

	Backbone.Model.prototype.changedAttributes = function () {};

	Backbone.Model.prototype.previousAttributes = function () {};

	Backbone.Model.prototype.id = function () {};

	Backbone.Model.prototype.attributes = function () {};

	Backbone.Model.prototype.cid = function () {};

	Backbone.Model.prototype.changed = function () {};

	Backbone.Model.prototype.url = function () {};

	//Backbone.Model.prototype.urlRoot = "";


	Backbone.Collection = function () {};

	Backbone.Model.prototype.extend = function () {};

	Backbone.Model.prototype.initialize = function () {};

	Backbone.Model.prototype.add = function () {};

	Backbone.Model.prototype.remove = function () {};

	Backbone.Model.prototype.reset = function () {};

	Backbone.Model.prototype.get = function () {};

	Backbone.Model.prototype.set = function () {};

	Backbone.Model.prototype.at = function () {};

	Backbone.Model.prototype.push = function () {};

	Backbone.Model.prototype.pop = function () {};

	Backbone.Model.prototype.unshift = function () {};

	Backbone.Model.prototype.shift = function () {};

	Backbone.Model.prototype.slice = function () {};

	Backbone.Model.prototype.sort = function () {};

	Backbone.Model.prototype.pluck = function () {};

	Backbone.Model.prototype.where = function () {};

	Backbone.Model.prototype.findWhere = function () {};

	Backbone.Model.prototype.clone = function () {};

	Backbone.Model.prototype.fetch = function () {};

	Backbone.Model.prototype.create = function () {};

	//Backbone.Model.prototype.model = function () {};

	//Backbone.Model.prototype.models = function () {};

	//Backbone.Model.prototype.length

}());
