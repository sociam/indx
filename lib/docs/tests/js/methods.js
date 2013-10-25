

animals.Animal.prototype.extend = function () {};

_.extend(Farm.prototype, {
	fields: undefined,
	/// Sell the ol' farm
	sell: function () {
	}
});



/// Add a field
Farm.prototype.addField = function (field) { };




Field.prototype.drawCropCircle = function (radius) {

};

/// Plow those fields!
Field.prototype.plow = function (radius) {

};



animals['Pig'] = animalClasses.Animal.extend({
	oink: function () {}
})

var Cow = Animal.extend({
	moo: function () {}
});


// Duck doesn't exist so this shouldn't show
Duck.quack = function () {};