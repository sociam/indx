#    This file is part of INDX.
#
#    Copyright 2013 Daniel Alexander Smith
#    Copyright 2013 University of Southampton
#
#    INDX is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    INDX is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import json, string, random

""" Script to generate JSON files for testing importing/updating. """

objects = 10
properties = 10
values = 3

def str_gen(size=16, chars=string.ascii_uppercase + string.digits):
    return ''.join(random.choice(chars) for x in range(size))


objs = []
for i in range(objects):
    obj = {"@id": str_gen()}
    for j in range(properties):
        prop = str_gen()
        obj[prop] = []
        for k in range(values):
            obj[prop].append({"@value": str_gen()}) 
    objs.append(obj)

print json.dumps(objs)
