#!/bin/bash

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


export URI_SCHEME="http"
export PORT="8211"

echo "PUTing RDF file:"
curl -v -k --header 'content-type:application/rdf+xml' -T 'testdata/dan.rdf' "$URI_SCHEME://127.0.0.1:$PORT/webbox/dan.rdf"
echo
echo
echo
echo
echo


echo "PUTing RDF file:"
curl -v -k --header 'content-type:text/turtle' -T 'testdata/example_user_foaf.n3' "$URI_SCHEME://127.0.0.1:$PORT/webbox/example_user_foaf.n3"
echo
echo
echo
echo
echo

echo "QUERYing the received graph:"
curl -v -k "$URI_SCHEME://127.0.0.1:$PORT/webbox/?query=SELECT%20%2A%20WHERE%20%7B%20GRAPH%20%3Chttp%3A//webbox.ecs.soton.ac.uk/ns%23ReceivedGraph%3E%20%7B%20%3Fs%20%3Fp%20%3Fo%20%7D%20%7D%20LIMIT%2010"
echo
echo
echo
echo
echo

echo "POSTing a message to the local store:"
curl -v -k -X"POST" --header 'content-type:text/turtle' -T 'testdata/example_msg.n3' "$URI_SCHEME://127.0.0.1:$PORT/webbox"
echo
echo
echo
echo
echo

echo "POSTing a message to the local store:"
curl -v -k -X"POST" --header 'content-type:text/turtle' -T 'testdata/example_msg.n3' "$URI_SCHEME://127.0.0.1:$PORT/webbox"
echo
echo
echo
echo
echo

echo "POSTing a message to an external store:"
curl -v -k -X"POST" --header 'content-type:text/turtle' -T 'testdata/example_msg_external.n3' "$URI_SCHEME://127.0.0.1:$PORT/webbox"
echo
echo
echo
echo
echo

echo "PUTing resource:"
curl -v -k --header 'content-type:text/turtle' -T 'testdata/example_resource.n3' "$URI_SCHEME://127.0.0.1:$PORT/webbox/example_resource.n3"
echo
echo
echo
echo
echo

echo "Subscribing to a resource:"
curl -v -k -X"POST" --header 'content-type:text/turtle' -T 'testdata/example_msg_sub.n3' "$URI_SCHEME://127.0.0.1:$PORT/webbox"
echo
echo
echo
echo
echo

echo "POSTing resource:"
curl -v -k -X"POST" --header 'content-type:text/turtle' -T 'testdata/example_resource.n3' "$URI_SCHEME://127.0.0.1:$PORT/webbox/example_resource.n3"
echo
echo
echo
echo
echo

echo "Unsubscribing from a resource:"
curl -v -k -X"POST" --header 'content-type:text/turtle' -T 'testdata/example_msg_unsub.n3' "$URI_SCHEME://127.0.0.1:$PORT/webbox"
echo
echo
echo
echo
echo

echo "POSTing resource:"
curl -v -k -X"POST" --header 'content-type:text/turtle' -T 'testdata/example_resource.n3' "$URI_SCHEME://127.0.0.1:$PORT/webbox/example_resource.n3"
echo
echo
echo
echo
echo

echo "PUTting a file:"
curl -v -k --header "content-type:image/png" -T 'files/godfather.png' "$URI_SCHEME://127.0.0.1:$PORT/webbox/godfather.png"
echo
echo
echo
echo
echo

echo "GETting the file back:"
curl -v -k -X"GET" "$URI_SCHEME://127.0.0.1:$PORT/webbox/godfather.png" -ogodfather.png
echo
echo
echo
echo
echo

echo "PUTting a file to replace it:"
curl -v -k -X"PUT" --header "content-type:image/png" -T 'files/godfather.png' "$URI_SCHEME://127.0.0.1:$PORT/webbox/godfather.png"
echo
echo
echo
echo
echo

