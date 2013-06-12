#    This file is part of WebBox.
#
#    Copyright 2011-2013 Daniel Alexander Smith
#    Copyright 2011-2013 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    WebBox is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import json

class ObjectDiff:
    """ Determine the differences between two python/JSON objects, returning
        the difference in a structued format.
    """

    def __init__(self, obj1 = None, obj2 = None):
        """ Optionally specify the two objects to compare. """
        self.obj1 = obj1
        self.obj2 = obj2

    def set_object1(self, obj):
        self.obj1 = obj

    def set_object1_json(self, json_obj):
        """ Decodes the JSON before setting. """
        self.obj1 = json.loads(json_obj)

    def set_object2(self, obj):
        self.obj1 = obj

    def set_object2_json(self, json_obj):
        """ Decodes the JSON before setting. """
        self.obj2 = json.loads(json_obj)

    def compare(self):
        """ Compare the two objects. """
        if self.obj1 is None or self.obj2 is None:
            raise Exception("Object is None, cannot compare.")

    



