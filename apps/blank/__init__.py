from indx.webserver.handlers.service import ServiceHandler

class BlankApp(ServiceHandler):
    service_path="blank"

BlankApp.subhandlers = [
    {
        "prefix": "blank/api/set_config",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': BlankApp.set_config,
        'accept':['application/json'],
        'content-type':'application/json'
    },
    {
        "prefix": "blank/api/get_config",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': BlankApp.get_config,
        'accept':['application/json'],
        'content-type':'application/json'
    },    
    {
        "prefix": "blank/api/start",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': BlankApp.start_handler,
        'accept':['application/json'],
        'content-type':'application/json'
    },
    {
        "prefix": "blank/api/stop",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': BlankApp.stop_handler,
        'accept':['application/json'],
        'content-type':'application/json'
    },
    {
        "prefix": "blank/api/is_running",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': BlankApp.is_running_handler,
        'accept':['application/json'],
        'content-type':'application/json'
    }

]

APP = BlankApp
