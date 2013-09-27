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
	plow: function (field) {
		// plow those fields!
	}
});


/// A field can have multiple animals
var Field = function (width, height) {

};

Field.prototype.drawCropCircle = function (radius) {

};

var animalClasses = {
	Animal: function () {}
};

animalClasses.Animal.prototype.extend = function () {};

animalClasses.Cow = animalClasses.Animal.extend({
	moo: function () {}
});

animalClasses['Pig'] = animalClasses.Animal.extend({
	oink: function () {}
})

