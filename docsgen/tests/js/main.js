/// @title Test javascript framework
/// @title This title shouldn't work
/// @version 0.1
/// @version 0.2
/// @author Peter West <peter@peter-west.co.uk>
/// @author My buddy elsewhere
/// @since September 2013
/// @since November 2013
/// @see http://indx.es
/// @see http://examplefakewebsite.com
///
/// If the tests succeed, only the first @title, @version, @since and @see will be shown.
/// Heres *some* **Markdown** for _you_
/// * Wonderful list
/// * With...
///  * Working
///  * Indentation

// We're making a farm :)

/// A farm consists of multiple fields
function Farm () {

};

_.extend(Farm.prototype, {
	fields: undefined,
	/// Sell the ol' farm
	sell: function () {
	}
});

/// Add a field
Farm.prototype.addField = function (field) { };

/// A field can have multiple animals
var Field = function (width, height) {

};

Field.prototype.drawCropCircle = function (radius) {

};

/// Plow those fields!
Field.prototype.plow = function (radius) {

};

var animals = {
	/// @fullName animals.Animl
	Animal: function () {}
};

animals.Animal.prototype.extend = function () {};

var Cow = Animal.extend({
	moo: function () {}
});

// Duck doens't exist so this shouldn't show
Duck.quack = function () {

};

// Bird isn't defined, so docs shouldn't link superclass
Goose = Bird.extend({

})

animals['Pig'] = animalClasses.Animal.extend({
	oink: function () {}
})

