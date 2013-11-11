// @types {int}
Field.prototype.area = 10;

_.extend(Field.prototype, {
	/// @order 2
	width: undefined,
	/// @name height
	/// @see http://en.wikipedia.org/wiki/height
	/// @since 14-Oct-2013
	/// @deprecated
	/// @alias fieldHeight
	h: undefined,
	fieldHeight: 24
};