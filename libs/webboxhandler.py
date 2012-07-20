#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
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


import rdflib, logging, traceback, uuid

import webbox
from httputils import resolve_uri

from rdflib.graph import Graph
from time import strftime

class WebBoxHandler:
    """ A class that handles webbox messages, by looking at received RDF. """

    def __init__(self, graph, webbox):
        self.graph = graph
        self.webbox = webbox
        self.sioc_graph = webbox.webbox_ns + "ReceivedSIOCGraph" # the graph for received messages as sioc:Posts
        self.message_uri_prefix = webbox.webbox_ns + "post-" # The URI prefix of the sioc:Post resources we make

    """ functions to return things from the webbox, do not use self.webbox directly. """
    def _webbox_url(self):
        return self.webbox.webbox_url

    def _uri2path(self, uri):
        return self.webbox.uri2path(uri)

    def _send_message(self, recipient, message):
        return self.webbox.send_message(recipient, message)

    def _subscriptions(self):
        return self.webbox.subscriptions



    def _new_sioc_post(self, topic_uri, recipient_uri):
        """ Create a new rdf/xml sioc:Post based on a topic, and for a given recipient.
            Timestamp is set to now, and sender is taken from WebID authenticated person (TBC). """

        uri = self.message_uri_prefix + uuid.uuid1().hex

        graph = Graph()
        graph.add(
            (rdflib.URIRef(uri),
             rdflib.URIRef("http://xmlns.com/foaf/0.1/primaryTopic"),
             rdflib.URIRef(topic_uri)))

        graph.add(
            (rdflib.URIRef(uri),
             rdflib.URIRef("http://rdfs.org/sioc/ns#addressed_to"),
             rdflib.URIRef(recipient_uri)))

        graph.add(
            (rdflib.URIRef(uri),
             rdflib.URIRef("http://purl.org/dc/terms/created"),
             rdflib.Literal(strftime("%Y-%m-%dT%H:%M:%SZ")))) # FIXME forces zulu time, which may be technically incorrect
        
        rdf = graph.serialize(format="xml") # rdf/xml
        return {"rdf": rdf, "uri": uri}

    def get_owners(self):
        """ Return an array of the URIs of all of the owners of this store (typically only one). """

        query = "SELECT DISTINCT ?owner WHERE { ?owner <%s> <%s> } " % (webbox.WebBox.address_predicate, self._webbox_url())
        response = self.webbox.query_store.query(query)
        if response['status'] >= 200 and response['status'] <= 299:
            results = response['data']
            logging.debug(str(results))
            owners = []
            for row in results:
                owner = unicode(row['owner']['value'])
                owners.append(owner)
            return owners
        else:
            logging.error("Couldn't get owner of store, response: %s" % str(response))
        return []
       

    def handle_all(self):
        """ Handle all WebBox message RDF types, called individually. """

        funcs = (
            self.handle_to_messages,
            self.handle_subscribe,
            self.handle_unsubscribe,
        )

        for func in funcs:
            response = func()
            if response is not None:
                logging.debug("Got response from function: "+str(response))
                return response

        logging.debug("handle_all returned None (success)")
        return None # success


    def subscribe(self, person_uri, resource_uri):
        """ Subscribe this person to this resource. """
        return self._subscriptions().subscribe(person_uri, resource_uri)

    def unsubscribe(self, person_uri, resource_uri):
        """ Unsubscribe this person from this resource. """
        return self._subscriptions().unsubscribe(person_uri, resource_uri)


    def handle_subscribe(self):
        logging.debug("Handling 'subscribe'")

        for s, p, o in self.graph:
            if unicode(p) == unicode(webbox.WebBox.subscribe_predicate):
                logging.debug("got a subscribe message, handling now...")
                person_uri = unicode(s)
                resource_uri = unicode(o)

                response = self.subscribe(person_uri, resource_uri)
                if response is not None:
                    return response

        return None # success

    def handle_unsubscribe(self):
        logging.debug("Handling 'unsubscribe'")

        for s, p, o in self.graph:
            if unicode(p) == unicode(webbox.WebBox.unsubscribe_predicate):
                logging.debug("got an unsubscribe message, handling now...")
                person_uri = unicode(s)
                resource_uri = unicode(o)

                response = self.unsubscribe(person_uri, resource_uri)
                if response is not None:
                    return response

        return None # success


    def handle_to_messages(self):
        """ Handle "to" messages, i.e. the webbox has received a message sent to us. """

        logging.debug("Handling 'to' messages.")

        for s, p, o in self.graph:
            if unicode(p) == unicode(webbox.WebBox.to_predicate):
                message_uri = unicode(s)
                recipient_uri = unicode(o)

                if recipient_uri in self.get_owners():
                    """ This message is to us. -  we will receive it. """
                    logging.debug("Got a message for us: " + message_uri)

                    # resolve URI of the message
                    try:
                        rdf = resolve_uri(message_uri)
                        # FIXME error handling

                        logging.debug("resolved it.")

                        # put into 4store and RWW
                        # put resolved URI into the store
                        # put into its own graph URI in 4store
                        # TODO is uri2path the best thing here? or GUID it maybe?
                        status = self.webbox.SPARQLPut(message_uri, self._uri2path(message_uri), rdf, "application/rdf+xml")
                        logging.debug("Put it in the store: "+str(status))

                        if status > 299:
                            return {"data": "Unsuccessful.", "status": status}


                        # store a copy as a sioc:Post in the SIOC graph
                        sioc_post = self._new_sioc_post(message_uri, recipient_uri)
                        status = self.webbox.SPARQLPut(self.sioc_graph, self._uri2path(sioc_post['uri']), sioc_post['rdf'], "application/rdf+xml")

                        logging.debug("Put a sioc:Post in the store: "+str(status))

                        if status > 299:
                            return {"data": "Unsuccessful.", "status": status} 


                        # TODO notify apps etc.
                        logging.debug("Received message of URI, and put it in store: " + message_uri)
                    except Exception as e:
                        logging.debug("Error with message received: " + str(e))
                        logging.debug(traceback.format_exc())
                        return {"data": "Error receiving message: "+message_uri, "status": 500}

                else:
                    """ This message is for other people. - we will send it. """
                    logging.debug("Got a message for other person: "+message_uri+", for: "+recipient_uri)

                    # send a message out with this triple.
                    success = self._send_message(recipient_uri, message_uri)
                    if type(success).__name__=='bool' and success == True:
                        # everything went better than expected
                        pass
                    else:
                        # oh dear, didn't work, success is the error message
                        return {"data": "Unsuccessful: %s" % success, "status": 502} # 502 Bad Gateway, i.e. we couldn't send to their webbox

        return None # none means successful.
        
