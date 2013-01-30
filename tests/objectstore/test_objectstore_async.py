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

    to_add = [
        ([{"foo": [{"@value": "bar"}], "@id": "id1"}], 0),
        ([{"baz": [{"@value": "qux"}], "@id": "id2"}], 0)
    ]

    def cb(added_info):
        logging.debug("cb called, added_info: " + str(added_info))

        if len(to_add) < 1:
            # all added, carry on

            def latest_cb(data):
                print "Latest:"
                print str(data)

            store.get_latest().addCallback(latest_cb)


        objs, version = to_add.pop(0)
        store.add(objs, version).addCallback(cb)

    cb(None)

# connect to box
database.connect_box(boxid, db_user, db_pass).addCallbacks(cb_connected, connect_fail)

reactor.run()

