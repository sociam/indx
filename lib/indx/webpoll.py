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
import hashlib
from twisted.internet import task
from twisted.internet import reactor
from twisted.web.client import Agent
from twisted.web.client import readBody
from twisted.web.http_headers import Headers

class IndxPeriodicWebPoller:
    """ Handles periodicall getting web content.
        e.g. used by classes like IndxPostConnectTIMON to poll LDP resources.
    """    

    def __init__(self, task):
        self.task = task

        self.initial_interval_secs = self.task.interval_secs
        self.interval_secs = self.task.interval_secs

        self.max_backoff = self.initial_interval_secs * 10

        self.prev_body = None # will only fire content_cb if response body has changed from prev_body [hash]

        logging.debug("IndxPeriodicWebPoller created for {0}".format(self.task.url))
        self.run_task()

    def run_task(self):
        logging.debug("IndxPeriodicWebPoller run_task for {0}".format(self.task.url))

        def done_cb(response):
            logging.debug("IndxPeriodicWebPoller run_task, done_cb for {0}".format(self.task.url))
            headers = list(response.headers.getAllRawHeaders())
            def body_cb(body):
 
                body_hash = hashlib.sha224(body).hexdigest()

                if self.prev_body is None or body_hash != self.prev_body:
                    logging.debug("IndxPeriodicWebPoller run_task for {0} -- new content, returning".format(self.task.url))
                    self.task.content_cb(response.code, response.phrase, headers, body)
                else:
                    logging.debug("IndxPeriodicWebPoller run_task for {0} -- not new content".format(self.task.url))

                self.prev_body = body_hash
                self.setup_deferred() # everything went ok, so do this task again

            readBody(response).addCallbacks(body_cb, err_cb)

        def err_cb(failure):
            # something went wrong, tread lightly
            logging.error("IndxPeriodicWebPoller, run_task, err_cb: {0}".format(failure))
            failure.trap(Exception)

            self.interval_secs = self.interval_secs + self.initial_interval_secs # backoff to be safe
            if self.interval_secs > self.max_backoff:
                self.interval_secs = self.max_backoff
            self.setup_deferred()

        self.task.request.agent_request().addCallbacks(done_cb, err_cb)


    def setup_deferred(self):
        logging.debug("IndxPeriodicWebPoller setup_deferred for {0}".format(self.task.url))
        task.deferLater(reactor, self.interval_secs, lambda empty: self.run_task(), None)


class IndxPollingTask:

    def __init__(self, request, content_cb, interval_secs=3600):
        self.request = request
        self.content_cb = content_cb

        self.url = request.url # convenience

        # default = 60*60 = once per hour
        self.interval_secs = interval_secs


class IndxPollingRequest:

    def __init__(self, url, headers={}, method="GET"):
        self.url = url
        self.method = method

        http_headers = {"User-Agent": ["INDXPeriodicWebPoller"]} # default
        http_headers.update(headers) # overwrite defaults if present

        self.req_headers = Headers(http_headers)

    def agent_request(self):
        agent = Agent(reactor)
        return agent.request(self.method, self.url, self.req_headers, None)

