
## update this when you want to add a new handler

from webbox.webserver.handlers.admin import AdminHandler
# from webbox.webserver.handlers.wellknown import WellKnownHandler
# from webbox.webserver.handlers.lrdd import LRDDHandler
# from webbox.webserver.handlers.openid import OpenIDHandler
# from webbox.webserver.handlers.auth import AuthHandler
# from webbox.webserver.handlers.box import BoxHandler

HANDLERS = [
    ('wellknown', WellKnownHandler),
    ('lrdd', LRDDHandler),
    ('openid', OpenIDHandler),
    ('auth', AuthHandler),
    ('admin', AdminHandler),
    ('', BoxHandler)
]

