#    This file is part of WebBox.
#
#    Copyright 2012 Daniel Alexander Smith
#    Copyright 2012 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    Foobar is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import os, pystache, logging
from twisted.web.resource import Resource
from webbox import WebBox

class Idx(Resource):
    def render_GET(self, request):

        self.wb = registry.getComponent(WebBox)

        template_vars = {
            "server_url": self.wb.server_url,
        }

        return self.mustache("objectstore", template_vars)

    def mustache(self, fn, tmpl_vars):

        filename = os.path.join(os.path.dirname(__file__), fn+".mustache")
        file = open(filename, "r")
        idx = file.read()
        file.close

        rendered = pystache.render(idx, tmpl_vars)
        return rendered.encode("utf8")

resource = Idx()
