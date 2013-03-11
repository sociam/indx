
## update this when you want to add a new handler

from webbox.webserver.handlers.admin import AdminHandler
from webbox.webserver.handlers.auth import AuthHandler

#from webbox.webserver.handlers.enrich import EnrichHandler
# from webbox.webserver.handlers.wellknown import WellKnownHandler
# from webbox.webserver.handlers.lrdd import LRDDHandler
# from webbox.webserver.handlers.openid import OpenIDHandler
# from webbox.webserver.handlers.auth import AuthHandler
# from webbox.webserver.handlers.box import BoxHandler

# leave boxhandler out of here, as it is instantiated on a per-box basis
HANDLERS = [
    AuthHandler,
    AdminHandler

#    EnrichHandler
    # ('wellknown', WellKnownHandler),
    # ('lrdd', LRDDHandler),
    # ('openid', OpenIDHandler),
    #  ('', BoxHandler) # 
]

