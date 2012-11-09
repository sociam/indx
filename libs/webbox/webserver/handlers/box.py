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
#    WebBox is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import logging, traceback
from twisted.web.resource import Resource
from webbox.webserver.session import WebBoxSession, ISession
from webbox.webserver.handlers.base import BaseHandler
from webbox.webserver.handlers.objectstore import ObjectStoreHandler

class BoxHandler(BaseHandler):
    base_path = ''

BoxHandler.subhandlers = ObjectStoreHandler.subhandlers # + RDF.RDFHandler.subhandlers + webdav.WebDavHandler.subhandlers
