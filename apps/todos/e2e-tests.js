// warning: this will delete all lists in the current box

describe('Todo list', function () {
	beforeEach(module('todos'))
	it('should delete all lists', inject($rootScope) {

	})

// delete all lists

// create a list

// create a todo in the list

// try to create a blank todo

// reload

// check that there is one list and one todo within the list

// create another list

// create a todo

// create a todo

// complete the last todo

// check todo is no longer in list

// switch to all todos

// check that there is 2 todos

// switch to completed todos

// check that there is 1 todo

// switch to list 1

// create a todo

// create a todo in between todos

// create a todo at start

// refresh

// switch to list 1

// check order of todos is correct

// move todo 3 to before todo 2

// refresh

// check order is correct

// set todo 3 to ''

// check it has been deleted

// switch to completed list

// set todo 1 to ''

// check it has been deleted

// updates in other client if todo is checked

});