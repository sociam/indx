// We're making a farm :)

/// A farm consists of multiple fields
function Farm (owner) {};

var BigBarn = function () {}

/// A field can have multiple animals
/// @arg {number} width - Width of the field
/// @arg height - Height of the field
/// 
var Field = function (width, height) {};

var animals = {
	/// @fullName animals.Animl
	Animal: function () {}
};

/// @instanceName cow
/// @extend animals.Animal
/// @see http://en.wikipedia.org/wiki/cow
/// @order 100
/// @since 2005
var Cow = Animal.extend({});

// Bird isn't defined, so docs shouldn't link superclass
Goose = Bird.extend({})

animals['Pig'] = animalClasses.Animal.extend({})

/// @class
/// @see http://en.wikipedia.org/wiki/donkey
/// @see a donkey park
/// @alias Ass
/// @alias Equus_africanus_asinus
/// @since 10-Oct-2010
/// @extend Animal
/// @extends Noun
/// A small horse-like animal
var Donkey = function () {}

var Ass = Donkey;
var Equus_africanus_asinus

/// @ignore
var FlyingPig = function () {};

var _FlyingCow = function () {};

/// @deprecated
var Lemming = function () {}

/// @deprecated - It turns out that pluto is a planet, not an animal
var Pluto = function () {}