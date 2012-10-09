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
            "personalise_panel": self.get_personalise_panel(),
            "server_url": self.wb.server_url,
        }

        return self.mustache("index", template_vars)

    def mustache(self, fn, tmpl_vars):

        filename = os.path.join(os.path.dirname(__file__), fn+".mustache")
        file = open(filename, "r")
        idx = file.read()
        file.close

        rendered = pystache.render(idx, tmpl_vars)
        return rendered.encode("utf8")

    def get_personalise_panel(self):

        q = "PREFIX webbox: <http://webbox.ecs.soton.ac.uk/ns#> SELECT DISTINCT ?owner WHERE { ?owner webbox:address <%s> }" % self.wb.server_url
        results = self.wb.query_store.query(q)
        
        if len(results['data']) == 0:
            rendered = self.mustache("templates/setup_webbox", {"server_url": self.wb.server_url})
            
        else:
            owner = results['data'][0]['owner']['value']

            # handle weird chars from 4store, FIXME in the 4s library
            owner = owner.encode("latin1")
            owner = owner.decode("utf8", errors="ignore")

            rendered = self.mustache("templates/personalise_webbox", {"server_url": self.wb.server_url, "owner": owner});

        return rendered


resource = Idx()
