import psycopg2, time, sys, logging, json
from twisted.internet import reactor
from txpostgres import txpostgres
import cProfile
from webbox.objectstore_async import ObjectStoreASync

logger = logging.getLogger() # root logger
logger.debug("Logger initialised")
logger.setLevel(logging.DEBUG)


# database variables
root_user = "postgres"
root_pass = "foobar"

db_name = "webbox_benchmark" # dropped at first
db_user = "webbox"
db_pass = "foobar"



## drop the existing benchmark database (to reset version numbers, or if schema changes etc.)
root_conn = psycopg2.connect(user=root_user, password=root_pass)
root_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
root_cur = root_conn.cursor()
root_cur.execute("DROP DATABASE IF EXISTS %s" % db_name)
root_cur.close()
root_conn.close()
#
## create schema
ObjectStoreASync.initialise(db_name, root_user, root_pass, db_user, db_pass)




# connect as new user
conn = txpostgres.Connection()
conn_str = ("dbname='{0}' user='{1}' password='{2}'".format(db_name, db_user, db_pass))


def cb_connected():
    logging.debug("callback, objectstore connected")

    def get_graphs():
        logging.debug("get_graphs()")

        def callback(uris):
            logging.debug("callback")
            jsondata = json.dumps(uris, indent=2)
            print jsondata

        logging.debug("about to call get_graphs")
        store.get_graphs(callback)
        

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
        store.add(graph, objs, version, cb)

    cb(None)

store = ObjectStoreASync(conn, conn_str, cb_connected)
reactor.run()

