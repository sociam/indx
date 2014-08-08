#    Copyright (C) 2014 University of Southampton
#    Copyright (C) 2014 Daniel Alexander Smith
#    Copyright (C) 2014 Max Van Kleek
#    Copyright (C) 2014 Nigel R. Shadbolt
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
from twisted.internet.defer import Deferred

class IndxPostConnect:

    def __init__(self, store):
        self.store = store

    def run_post_connect(self):
        # overload this
        return_d = Deferred()
        return_d.callback(True)
        return return_d

    def get_post_connects(self):
        # ordered
        # TODO move somewhere else - configuration or sub-apps
        return [
            IndxPostConnectSchemaUpgrade,
            IndxPostConnectTIMON,
        ]

# TODO Push these out to other modules soon

class IndxPostConnectSchemaUpgrade(IndxPostConnect):

    def run_post_connect(self):
        logging.debug("IndxPostConnectSchemaUpgrade Running...")
        return self.store.schema_upgrade()


class IndxPostConnectTIMON(IndxPostConnect):

    def run_post_connect(self):
        logging.debug("IndxPostConnectTIMON Running...")
        return_d = Deferred()

        def results_cb(graph):
            try:
                for obj_id, obj in graph.objects().items():
                    for val in obj.get('url'):
                        channel_url = val.value
                        logging.debug("IndxPostConnectTIMON following URL: {0}".format(channel_url))
            except Exception as e:
                logging.error("IndxPostConnectTIMON error: {0}".format(e))

            return_d.callback(True)

        query = {
            "type": "timfollow"
        }

        self.store.query(query, render_json = False).addCallbacks(results_cb, return_d.errback)
        return return_d


