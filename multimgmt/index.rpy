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

import os, pystache
from twisted.web.resource import Resource
from webboxmulti import WebBoxMulti

class Idx(Resource):
    def render_GET(self, request):
        filename = os.path.join(os.path.dirname(__file__), "index.template")
        file = open(filename)
        idx = file.read()
        file.close

        wbmulti = registry.getComponent(WebBoxMulti)
        wb_config = wbmulti.get_config()

        wbs = []
        for wb in wb_config['webboxes']:
            wbs.append(wb)

        return str(pystache.render(idx, {"wbs": wbs}))

resource = Idx()
