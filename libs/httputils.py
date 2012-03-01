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


""" This file contains http helper functions, and can be used by any module. """
import httplib, logging

def http_get(host, path, headers={}):
    """ Send a GET request to a sub-server, i.e., RWW or 4store """

    connection = httplib.HTTPConnection(host)
    body = ""
    connection.request('GET', path, body, headers)
    result = connection.getresponse()
    # Now result.status and result.reason contains interesting stuff
    logging.debug("GET file from: "+host+", at path: "+path)

    data = result.read()

    if result.status >= 200 and result.status <= 299:
        logging.debug("Status: Successful")
    else:
        logging.debug("Status: ("+str(result.status)+") Not successful, reason: " + result.reason)

    """ status is a HTTP status code as an integer, e.g. 200, and data is a string of data to return. """
    response =  {'status': result.status, 'data': data}

    ctype = result.getheader("Content-type", None) 
    if ctype is not None:
        response['type'] = ctype

    return response


def http_put(host, path, data, content_type):
    """ Perform a PUT to the URL with the data """

    # TODO put ACL authenication etc here ?

    connection = httplib.HTTPConnection(host)
    connection.request('PUT', path, data, {"Content-type": content_type})
    result = connection.getresponse()
    # Now result.status and result.reason contains interesting stuff
    logging.debug("PUT file to: "+host+", at path: "+path)

    if result.status >= 200 and result.status <= 299:
        logging.debug("Status: Successful")
    else:
        logging.debug("Status: Not successful (%s), reason: " % (str(result.status)) + result.reason)

    """ status is a HTTP status code as an integer, e.g. 200 """
    return result.status


