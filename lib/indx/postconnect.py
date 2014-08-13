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
import rdflib
from indx.webpoll import IndxPeriodicWebPoller
from indx.webpoll import IndxPollingTask
from indx.webpoll import IndxPollingRequest
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
from indx.async import IndxDiffListener
from indx.objectstore_async import IncorrectPreviousVersionException

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


# TODO move to a timon backend submodule somewhere (in apps/timon/something ?)

class IndxPostConnectTIMON(IndxPostConnect):

    NS_SPACE = "http://www.w3.org/ns/pim/space#"
    NS_RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    NS_SIOC = "http://rdfs.org/sioc/ns#"
    NS_LDP = "http://www.w3.org/ns/ldp#"
    NS_FOAF = "http://xmlns.com/foaf/0.1/"

    def run_post_connect(self):
        """ Called when the box is authenticated. """

        logging.debug("IndxPostConnectTIMON Running...")
        return_d = Deferred()

        query = {
            "type": "follow"
        }

        def results_cb(graph):
            # deal with the channels (follows) in the graph now
            try:
                self.process_objs(graph.objects())
            except Exception as e:
                logging.error("IndxPostConnectTIMON error: {0}".format(e))

            # set up a standing diff query to insta-handle new follows

            def diff_result_cb(requestid, data, action):
                logging.debug("IndxPostConnectTIMON received diff results: {0}".format(data))
                diff = data['data']
                objs = {}
                if 'data' in diff:
                    for objectid in diff['data']['added'].keys():
                        obj = diff['data']['added'][objectid]['added']
                        objs[objectid] = {"url": [{"value": obj['url'][0]["@value"]}]} # TODO XXX UGH

                logging.debug("IndxPostConnectTIMON received diff results: processing {0} objs".format(len(objs)))
                if len(objs) > 0:
                    self.process_objs(objs)

            listener = IndxDiffListener(self.store, "someRequestID", "someDiffID", diff_result_cb)
            listener.setQuery(query)
            self.store.listen(listener)

            return_d.callback(True)

        self.store.query(query, render_json = False).addCallbacks(results_cb, return_d.errback)
        return return_d

    def process_objs(self, objs):
        logging.debug("IndxPostConnectTIMON process_objs: {0}".format(objs))
        urllist = []

        for obj_id, obj in objs.items():
            for val in obj.get('url'):
                if type(val) == type({}): # TODO XXX UGHx2
                    channel_url = val.get("value")
                else:
                    channel_url = val.value
                logging.debug("IndxPostConnectTIMON following URL: {0}".format(channel_url))
                if channel_url:
                    urllist.append(channel_url)

        def doNext(empty):

            if len(urllist) > 0:
                channel_url = urllist.pop(0)

                def new_content_cb(code, msg, headers, body):
                    ### Called whenever there is new content, i.e. not when the page body is the same as a previous poll
                    logging.debug("IndxPostConnectTIMON new_content_cb: {0}, {1}, {2}, {3}".format(code, msg, headers, body))

                    content_type = "text/html"
                    for item in headers:
                        field, vals = item
                        if field.lower() == "content-type":
                            for val in vals:
                                content_type = val
                                break
                            break

                    g = rdflib.Graph()
                    g.parse(data=body, format=content_type, publicID=channel_url)
                    logging.debug("IndxPostConnectTIMON parsed: {0}, triples: {1}".format(channel_url, len(g)))

                    def err_cb(failure):
                        failure.trap(Exception)
                        logging.error("IndxPostConnectTIMON error: {0}".format(failure))
                        doNext(None) # next URL anyway

                    self.get_posts(channel_url, g).addCallbacks(doNext, err_cb)

                accept = "text/turtle; q=0.9, text/n3; q=0.8, text/n-triples; q=0.7, application/rdf+xml; q=0.6"
                interval = 60 * 60 * 1 # 1 hour

                req = IndxPollingRequest(channel_url, headers={"Accept": [accept]}, method="GET")
                task = IndxPollingTask(req, new_content_cb, interval_secs=interval)
                IndxPeriodicWebPoller(task)

            else:
                logging.debug("IndxPostConnectTIMON process_objs finished.")

        doNext(None)

    def get_posts(self, channel, graph):
        """ graph -- contains triples from the channel """
        try:
            return_d = Deferred()

            # TODO XXX check that posts aren't already in box

            posts = set()
            for s, p, o in graph.triples( (None, rdflib.URIRef("{0}{1}".format(self.NS_RDF, "type")), rdflib.URIRef("{0}{1}".format(self.NS_SIOC, "Post"))) ):
                logging.debug("IndxPostConnectTIMON get_posts, type sioc:Post s: {0}, p: {1}, o: {2}".format(s, p, o))
                try:
                    result = graph.parse(s)
                    logging.debug("IndxPostConnectTIMON get_posts result of parsing {0}: {1}".format(s, result))
                    posts.add(s)
                except Exception as e:
                    logging.error("IndxPostConnectTIMON get_posts, error parsing subject {0}: {1} - carrying on with next.".format(s, e))

            objs_full = []
            for post in posts:
                logging.debug("IndxWebID get_posts, post: {0}".format(post))
                post_full = {}
                author = None
                for s, p, o in graph.triples( (post, None, None) ):
                    logging.debug("IndxWebID get_posts, (post: {3} <p> <o>), s: {0}, p: {1}, o: {2}".format(s, p, o, post))
                    pred = "{0}".format(p)
                    if post_full.get(pred) is None:
                        post_full[pred] = []
                    post_full[pred].append("{0}".format(o))

                    if "{0}".format(p) == "http://rdfs.org/sioc/ns#has_creator":
                        author = o

                # get the author name
                if author:
                    for s, p, o in graph.triples( (author, rdflib.URIRef(self.NS_FOAF + "name"), None) ):
                        authorname = "{0}".format(o)
                        author_obj = {"@id": "{0}".format(author), "name": [authorname]}
                        objs_full.append(author_obj)

                # convert from CIMBA triples to a TIMON object
                subj_id = "{0}".format(s)
                timon_post = {"@id": subj_id}
                timon_post["body"] = [ {"@value": post_full['http://rdfs.org/sioc/ns#content'][0]} ]
                timon_post["author"] = [ {"@id": post_full['http://rdfs.org/sioc/ns#has_creator'][0]} ]
                timon_post["created"] = [ {"@value": post_full['http://purl.org/dc/terms/created'][0]} ]
                timon_post["channel"] = [ {"@id": channel} ]
                timon_post["type"] = [ {"@value": "post"} ]
                objs_full.append(timon_post)

            def doUpdate():
                def ver_cb(version):
                    def success_cb(empty):
                        logging.debug("IndxPostConnectTIMON get_posts success_cb")
                        return_d.callback(True)

                    def err2_cb(failure):
                        if isinstance(failure.value, IncorrectPreviousVersionException):
                            failure.trap(IncorrectPreviousVersionException)
                        else:
                            failure.trap(Exception)
                        logging.error("IndxPostConnectTIMON err2_cb in get_posts: {0}".format(failure))

                        if isinstance(failure.value, IncorrectPreviousVersionException()):
                            logging.error("IndxPostConnectTIMON err2_cb - trying again with actual version number.")
                            # TODO XXX handle infinite loop here
                            doUpdate()


                    self.store.update(objs_full, version).addCallbacks(success_cb, err2_cb)

                def err_cb(failure):
                    failure.trap(Exception)
                    logging.error("IndxPostConnectTIMON err_cb in get_posts: {0}".format(failure))
                    return_d.errback(failure)

                self.store._get_latest_ver().addCallbacks(ver_cb, err_cb)

            doUpdate()

        except Exception as e:
            logging.error("IndxPostConnectTIMON exception thrown in get_posts: {0}".format(e))
            return_d.errback(Failure(e))

        return return_d

