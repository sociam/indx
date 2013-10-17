#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Kleek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
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

## update this when you want to add a new handler

from indx.webserver.handlers.admin import AdminHandler
from indx.webserver.handlers.auth import AuthHandler

#from indx.webserver.handlers.enrich import EnrichHandler
# from indx.webserver.handlers.wellknown import WellKnownHandler
# from indx.webserver.handlers.lrdd import LRDDHandler
# from indx.webserver.handlers.openid import OpenIDHandler
# from indx.webserver.handlers.auth import AuthHandler
# from indx.webserver.handlers.box import BoxHandler

# leave boxhandler out of here, as it is instantiated on a per-box basis
HANDLERS = [
    AuthHandler,
    AdminHandler

    # WebSocketsHandler

#    EnrichHandler
    # ('wellknown', WellKnownHandler),
    # ('lrdd', LRDDHandler),
    # ('openid', OpenIDHandler),
    #  ('', BoxHandler) # 
]

