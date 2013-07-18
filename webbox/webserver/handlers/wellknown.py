#    This file is part of INDX.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
#
#    INDX is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    INDX is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with INDX.  If not, see <http://www.gnu.org/licenses/>.

import logging, json, traceback
from urlparse import urlparse, parse_qs
from webbox.webserver.handlers.base import BaseHandler

class WellKnownHandler(BaseHandler):

    base_path = '.well-known'
    subhandlers = {
        'host-meta': {
            'methods': ['GET'],
            'require_auth': False,
            'require_token': False,
            'handler': WellKnownHandler.host_meta_xml,
            'content-type': 'application/xrd+xml; charset=UTF-8'
        },
        'host-meta.json': {
            'methods': ['GET'],
            'require_auth': False,
            'require_token': False,
            'handler': WellKnownHandler.host_meta_json,
            'content-type': 'application/json; charset=UTF-8'
        },
    }

    def host_meta_xml(self, request):
        resource = request.args['resource'][0]

        subject = ""
        if resource is not None:
            subject = "<Subject>%s</Subject>" % (resource)

        response = """<?xml version='1.0' encoding='UTF-8'?>
<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0' 
     xmlns:hm='http://host-meta.net/xrd/1.0'>

  %s

  <Link rel='lrdd' 
        template='/lrdd?uri={uri}'>
    <Title>Resource Descriptor</Title>
  </Link>
  <Link rel='remoteStorage'
        href='%s'
        type='https://www.w3.org/community/rww/wiki/read-write-web-00#simple'>
        <Property type='auth-endpoint'>/openid</Property>
        <Property type='auth-method'>https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2</Property>
  </Link>
</XRD>
""" % (subject, self.webbox.server_url)

        request.write(response)
        request.finish()

    def host_meta_json(self, request):
        resource = request.args['resource'][0]

        response_json = {"links": [
            { "rel": "lrdd",
              "template": "/lrdd?uri={uri}",
            },
            {
              "rel": "remoteStorage",
              "href": self.webbox.server_url,
              "type": "https://www.w3.org/community/rww/wiki/read-write-web-00#simple",
              "properties": {
                  'auth-method': "https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2",
                  'auth-endpoint': "/openid",
              }
            }
        ]}

        if resource is not None:
            response_json['subject'] = resource

        response = json.dumps(response_json, indent=2)

        request.write(response)
        request.finish()

