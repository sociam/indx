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


import httplib, urllib, urllib2, logging

from rdfcrypto import RDFCrypto
from sparqlresults import SparqlResults
from querycache import QueryCache
from httputils import http_get, http_put
from sparqlparse import SparqlParse
from hashstorage import HashStorage

class SecureStoreProxy:
    def __init__(self, config, hashstore, query_store):
        self.config = config
        self.hashstore = HashStorage(hashstore)
        self.query_store = query_store # e.g. 4Store or CwmStore

        self.key = None # for optional encryption

        self.querycache = QueryCache(config.get("securestore", "querycache")) # to cache repeated queries

    def expire_store_cache(self):
        """ Called when new data is PUT/POSTed to the local store. """
        self.querycache.empty()

    def get_cached_query(self, query, key):
        """ Check the query cache for results if they exist. """
        results = self.querycache.get(query, key)
        return results

    def add_to_query_cache(self, query, key, results):
        """ Add a query and results to the query cache. """
        self.querycache.add(query, key, results)

    def set_key(self, key):
        """ Set the encryption key. """
        self.key = key

    def resolve_uri(self, uri):
        """ Resolve an RDF URI and return the RDF/XML. """

        opener = urllib2.build_opener(urllib2.HTTPHandler)
        request = urllib2.Request(uri)
        request.add_header('Accept', 'application/rdf+xml')
        request.get_method = lambda: 'GET'
        url = opener.open(request)
        data = url.read()
        return data

#    def query_store(self, query, key=None):
#        """ Query the local store (i.e., via 4store) - used by webbox etc. """
#
#        # TODO support CONSTRUCT etc. - as in SPARQLQuery()
#
#        rc = RDFCrypto(self.key, self.hashstore) # support encryption of the local store
#
#        cached_results = self.get_cached_query(query, key)
#        if cached_results is not None:
#            # decrypt, because the cache is still encrypted
#            dec_results = rc.decrypt_sparql_results(cached_results)
#            return {"status": 200, "data": dec_results}
#
#        response = self.query_store.query(rc.hash_sparql_query(query))
#
#        sr = SparqlResults()
#        results = sr.parse_sparql_xml(response['data'])
#        dec_results = rc.decrypt_sparql_results(results)
#
#        self.add_to_query_cache(query, key, results) # add the _encrypted_ results to the cache (don't leak personal data into the cache)
#
#
#        return {"status": response['status'], "data": dec_results}


    def SPARQLGet(self, path):
        """ Handle a SPARQL GET request """

        #TODO send the HTTP headers to the sub-servers

        # send file to rww
        rww_host = self.config.get("rww", "host") + ":" + self.config.get("rww", "port")

        response = http_get(rww_host, path)

        if "type" in response:
            ctype = response['type']
        else:
            ctype = "text/plain"

        if response['status'] >= 200 and response['status'] <= 299:
            logging.debug("decrypting because: status of GET was " + str(response['status']))
            # decrypt
            data = response['data']

            rc = RDFCrypto(self.key, self.hashstore)
            decrypted = rc.decrypt_rdf(data)
            ctype = "application/rdf+xml"
        else:
            logging.debug("NOT decrypting because: status of GET was " + str(response['status']))
            # something went wrong, we can't decode it
            decrypted = response['data'] # pass along
            # ctype is still correct from above.

        return {"status": response['status'], "data": decrypted, "type": ctype}


    def SPARQLPut(self, graph, filename, file, content_type, graph_replace=True):
        """ Handle a SPARQL PUT request. 'graph' is for 4store, 'filename' is for RWW. """

        rc = RDFCrypto(self.key, self.hashstore)
        encrypted = rc.encrypt_rdf(file, content_type) # always returns rdf/xml

        # send file to query store
        if graph_replace: # force a replace? usually yes, e.g. where graph is a file, otherwise dont, e.g. ReceivedGraph
            logging.debug("replacing graph %s with rdf" % graph)
            status1 = self.query_store.put_rdf(encrypted, "application/rdf+xml", graph)
        else:
            logging.debug("appending to graph %s with rdf" % graph)
            status1 = self.query_store.post_rdf(encrypted, "application/rdf+xml", graph)


        # send file to rww
        rww_host = self.config.get("rww", "host") + ":" + self.config.get("rww", "port")
        rww_path = self.config.get("rww", "put_path") + filename
        status2 = http_put(rww_host, rww_path, encrypted, "application/rdf+xml")

        self.expire_store_cache()

        if status1 == 201 and status2 == 201:
            logging.debug("SPARQLPut both 201 statuses")
            return 201
        elif status1 != 201:
            logging.debug("SPARQLPut 4store returned %s" % str(status1) )
            return status1
        elif status2 != 201:
            logging.debug("SPARQLPut RWW returned %s" % str(status2) )
            return status2
        else:
            return 201


    def _sparql_response_to_response(self, rc, verb, results):
        sr = SparqlResults()
        if verb == "SELECT":
            dec_results = rc.decrypt_sparql_results(results)
            dec_xml = sr.sparql_results_to_xml(dec_results)
            return dec_xml
        elif verb == "CONSTRUCT":
            dec_results = rc.decrypt_rdf(results)
            return dec_results

        # oh dear.
        return None



    def SPARQLQuery(self, args):
        """ Handle a SPARQL QUERY request. """
        rc = RDFCrypto(self.key, self.hashstore)
        sr = SparqlResults()

        query = args['query']

        s = SparqlParse(query)
        verb = s.get_verb() # SELECT, CONSTRUCT, DESCRIBE, ASK

        cached_results = self.get_cached_query(query, self.key)
        if cached_results is not None:
            # decrypt, because the cache is still encrypted
            dec_xml = self._sparql_response_to_response(rc, verb, cached_results)
            return {"status": 200, "data": dec_xml}

        # send a query to query store
        response = self.query_store.query(rc.hash_sparql_query(query))

#        results = sr.parse_sparql_xml(response['data'])
        results = response['data']
        
        logging.debug(str(results))
        logging.debug(str(type(results)))

        dec_xml = self._sparql_response_to_response(rc, verb, results)

        self.add_to_query_cache(query, self.key, results) # add the _encrypted_ results to the cache (don't leak personal data into the cache)

        return {"status": response['status'], "data": dec_xml}


    def SPARQLPost(self, graph, filename, file, content_type):
        """ Handle a SPARQL POST (append) request. 'graph' is for 4store, 'filename' is for RWW. """

        rc = RDFCrypto(self.key, self.hashstore)
        encrypted = rc.encrypt_rdf(file, content_type) # always returns rdf/xml

        # send file to query store (4store)
        logging.debug("POST to query store.")
        status1 = self.query_store.post_rdf(encrypted, "application/rdf+xml", graph)

        # send file to rww
        rww_host = self.config.get("rww", "host") + ":" + self.config.get("rww", "port")
        rww_path = self.config.get("rww", "put_path") + filename
        logging.debug("POST to "+rww_host+rww_path)
        status2 = self.send_post(rww_host, rww_path, encrypted, {"Content-type": "application/rdf+xml"})

        if status2 == 404:
            # Not found, need to PUT it instead to RWW
            logging.debug("Not found, PUTting instead.")
            status2 = http_put(rww_host, rww_path, encrypted, "application/rdf+xml")

        self.expire_store_cache()

        if status1 == 201 and status2 == 201:
            return 201
        elif status1 != 201:
            return status1
        elif status2 != 201:
            return status2
        else:
            return 201

    def send_post(self, host, path, data, args):
        """ Perform a POST to the URL with the data """

        # TODO put ACL authenication etc here ?

        connection = httplib.HTTPConnection(host)
        connection.request('POST', path, data, args)
        result = connection.getresponse()
        # Now result.status and result.reason contains interesting stuff
        logging.debug("POST file to: "+host+", at path: "+path)

        self.expire_store_cache()

        if result.status >= 200 and result.status <= 299:
            logging.debug("Status: Successful")
        else:
            logging.debug("Status: Not successful (%s), reason: " % (str(result.status)) + result.reason)

        return result.status


