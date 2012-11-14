import psycopg2, time, sys, logging, json
from twisted.internet import reactor
from txpostgres import txpostgres
import cProfile
from webbox.objectstore_async import ObjectStoreAsync
import webbox.webbox_pg2 as database

logger = logging.getLogger() # root logger
logger.debug("Logger initialised")
logger.setLevel(logging.DEBUG)


boxid = "benchmark"

db_user = "webbox"
db_pass = "foobar"

# create a box
database.create_box(boxid, db_user, db_pass)

def connect_fail():
    logging.debug("Connection failed.")


def cb_connected(conn):
    logging.debug("callback, objectstore connected")
    store = ObjectStoreAsync(conn)

    def get_graphs():
        logging.debug("get_graphs()")

        def callback(uris):
            logging.debug("callback")
            jsondata = json.dumps(uris, indent=2)
            print jsondata

        logging.debug("about to call get_graphs")
        store.get_graphs().addCallback(callback)
        

    to_add = [
        ("facebook", [{"foo": [{"@value": "bar"}], "@id": "id1"}], 0),
        ("twitter", [{"baz": [{"@value": "qux"}], "@id": "id2"}], 0)
    ]

    def cb(added_info):
        logging.debug("cb called, added_info: " + str(added_info))

        if len(to_add) < 1:
            # all added, carry on
            get_graphs()
            return

        graph, objs, version = to_add.pop(0)
        store.add(graph, objs, version).addCallback(cb)

    cb(None)

# connect to box
database.connect_box(boxid, db_user, db_pass).addCallbacks(cb_connected, connect_fail)

reactor.run()

