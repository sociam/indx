#    This file is part of WebBox.
#
#    Copyright 2012 Daniel Alexander Smith, eMax
#    Copyright 2012 University of Southampton
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

import os, logging, time, traceback, json, re, uuid
from urlparse import urlparse, parse_qs
from twisted.web import script
from twisted.internet import reactor
from twisted.web.resource import ForbiddenResource, Resource
from twisted.web.server import Site
from twisted.web.util import Redirect
from twisted.web.static import File, Registry
from twisted.web.wsgi import WSGIResource
from twisted.internet import reactor, ssl
from twisted.internet.defer import Deferred

class Token:
    def __init__(self, username, password, boxid, appid, origin, store):
        self.username = username
        self.password = password
        self.boxid = boxid
        self.appid = appid
        self.origin = origin
        self.store = store
        self.id = str(uuid.uuid1())
    def verify(self,boxname,origin):
        return self.boxid == boxname and self.origin == origin
        
class TokenKeeper:
    # handles token garbage collection at some time in the future!
    def __init__(self):
        self.tokens = {}
    def get(self,tid):
        return self.tokens.get(tid)
    def add(self,token):
        self.tokens[token.id] = token
        return token
    def new(self,username,password,boxid,appid,origin,store):
        token = Token(username,password,boxid,appid,origin,store)
        self.add(token)
        return token
    

    
    
    
        
    
        
