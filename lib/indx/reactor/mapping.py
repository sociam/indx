#    Copyright (C) 2011-2014 University of Southampton
#    Copyright (C) 2011-2014 Daniel Alexander Smith
#    Copyright (C) 2011-2014 Max Van Kleek
#    Copyright (C) 2011-2014 Nigel R. Shadbolt
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License, version 3,
#    as published by the Free Software Foundation.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
import logging

class IndxMapping:

    def __init__(self, methods, path, params, handler):
        self.methods = methods
        self.path = "/" + path
        self.params = params
        self.handler = handler

    def matches(self, request):
        """ request is an IndxRequest """
        logging.debug("Comparing methods {0}, path {1} to request path: {2}, methods {3}".format(self.methods, self.path, request.path, request.method))
        if request.method in self.methods and request.path == self.path:
            return True

        return False

    def request(self, request, token):
        self.handler(request, token)

