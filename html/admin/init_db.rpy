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
    def render_POST(self, request):

        self.wb = registry.getComponent(WebBox)

        template_vars = {
            "server_url": self.wb.server_url,
        }

        root_user = request.args['input_user'][0]
        root_password = request.args['input_password'][0]

        self.wb.initialise_object_store(root_user, root_password)

        # send them back to the webbox start page
        request.redirect(self.wb.get_base_url())
        return ""

resource = Idx()
