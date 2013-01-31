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
try:
    root_conn = psycopg2.connect(user=db_user, password=db_pass, database="postgres")
    root_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    root_cur = root_conn.cursor()
    root_cur.execute("DROP DATABASE IF EXISTS wb_%s" % boxid)
    root_cur.close()
    root_conn.close()
except Exception as e:
    print "Tried to remove database, exception: {0}".format(e)

database.create_box(boxid, db_user, db_pass)

def connect_fail():
    logging.debug("Connection failed.")


def cb_connected(conn):
    logging.debug("callback, objectstore connected")
    store = ObjectStoreAsync(conn)

    to_add = [
        ([{"foo": [{"@value": "bar"}], "@id": "id1"}], 0),
        ([{"baz": [{"@value": "qux"}], "@id": "id2"}], 1)
    ]

    def cb(added_info):
        logging.debug("cb called, added_info: " + str(added_info))

        if len(to_add) < 1:
            # all added, carry on

            def latest_cb(data):
                print "Latest:"
                print str(data)
                reactor.stop()

            store.get_latest().addCallback(latest_cb)
            return

        objs, version = to_add.pop(0)
        store.add(objs, version).addCallback(cb)

    cb(None)

# connect to box
database.connect_box(boxid, db_user, db_pass).addCallbacks(cb_connected, connect_fail)
reactor.run()

