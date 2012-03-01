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


export CRYPT_KEY="test"
export URI_SCHEME="http"

echo "PUTing RDF file:"
curl -v -k -T 'testdata/410c9baf-5469-44f6-9852-826524b80c61.rdf' "$URI_SCHEME://127.0.0.1:8211/autechre.rdf?key=$CRYPT_KEY"

echo "GETing and decrypting an RDF file:"
curl -v -k "$URI_SCHEME://127.0.0.1:8211/autechre.rdf?key=$CRYPT_KEY"

echo "QUERYing and NOT decrypting:"
curl -v -k "$URI_SCHEME://127.0.0.1:8211/query/?query=SELECT+*+WHERE+%7B+%3Fs+%3Fp+%3Fo+%7D+LIMIT+10&"

echo "QUERYing and decrypting:"
curl -v -k "$URI_SCHEME://127.0.0.1:8211/query/?query=SELECT+*+WHERE+%7B+%3Fs+%3Fp+%3Fo+%7D+LIMIT+10&key=$CRYPT_KEY"


