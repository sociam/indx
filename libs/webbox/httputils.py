#    This file is part of INDX.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    WebBox is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.


""" This file contains http helper functions, and can be used by any module. """
import httplib, logging, urllib2
from mimetools import Message
from cStringIO import StringIO

from twisted.internet import reactor, threads

def http_get(host, path, headers={}):
    """ Send a GET request to a sub-server, i.e., RWW or 4store """

    connection = httplib.HTTPConnection(host)
    connection.request('GET', path, "", headers)

    try:
        result = connection.getresponse()
        #result = threads.blockingCallFromThread(reactor, connection.getresponse)

        # Now result.status and result.reason contains interesting stuff
        logging.debug("GET file from: "+host+", at path: "+path)

        data = result.read()
        #data = threads.blockingCallFromThread(reactor, result.read)
    except Exception as e:
        logging.debug("Error in http_get: "+str(e))

    if result.status >= 200 and result.status <= 299:
        logging.debug("Status: Successful")
    else:
        logging.debug("Status: ("+str(result.status)+") Not successful, reason: " + result.reason)

    """ status is a HTTP status code as an integer, e.g. 200, and data is a string of data to return. """
    response =  {'status': result.status, "reason": result.reason, 'data': data}

    ctype = result.getheader("Content-type", None) 
    if ctype is not None:
        response['type'] = ctype

    return response


def http_put(host, path, data, content_type):
    """ Perform a PUT to the URL with the data """

    # TODO put ACL authenication etc here ?

    connection = httplib.HTTPConnection(host)
    connection.request('PUT', path, data, {"Content-type": content_type})

    try:
        result = connection.getresponse()
        #result = threads.blockingCallFromThread(reactor, connection.getresponse)
    except Exception as e:
        logging.debug("Error in http_put: "+str(e))

    # Now result.status and result.reason contains interesting stuff
    logging.debug("PUT file to: "+host+", at path: "+path+", content-type: "+content_type+", contents: "+str(data))

    if result.status >= 200 and result.status <= 299:
        logging.debug("Status: Successful")
    else:
        logging.debug("Status: Not successful (%s), reason: " % (str(result.status)) + result.reason)

    """ status is a HTTP status code as an integer, e.g. 200 """
    return {"status": result.status, "reason": result.reason}


def http_post(host, path, data, args):
    """ Perform a POST to the URL with the data """

    # TODO put ACL authentication etc here ?

    connection = httplib.HTTPConnection(host)
    connection.request('POST', path, data, args)

    try:
        result = connection.getresponse()
        #result = threads.blockingCallFromThread(reactor, connection.getresponse)
    except Exception as e:
        logging.debug("Error in http_post: "+str(e))

    # Now result.status and result.reason contains interesting stuff
    logging.debug("POST file to: "+host+", at path: "+path)

    if result.status >= 200 and result.status <= 299:
        logging.debug("Status: Successful")
    else:
        logging.debug("Status: Not successful (%s), reason: " % (str(result.status)) + result.reason)

    return {"status": result.status, "reason": result.reason}

def resolve_uri(uri, accept="application/rdf+xml", include_info=False):
    """ Resolve an RDF URI and return the RDF/XML. """
    logging.debug("resolve uri: "+uri)

    if uri.startswith("http:"):
        opener = urllib2.build_opener(urllib2.HTTPHandler)
    elif uri.startswith("https:"):
        opener = urllib2.build_opener(urllib2.HTTPSHandler)

    request = urllib2.Request(uri)
    request.add_header('Accept', accept)
    request.get_method = lambda: 'GET'
    url = opener.open(request)

    try:
        data = url.read()
        #data = threads.blockingCallFromThread(reactor, url.read)
    except Exception as e:
        logging.debug("Error in resolve_uri: "+str(e))

    if include_info:
        headers = Message(StringIO("".join(url.info().headers)))
        return {"data": data, "info": url.info(), "headers": headers}
    else:
        return data

