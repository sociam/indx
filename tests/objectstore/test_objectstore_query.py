import psycopg2, time, sys, logging, json, uuid
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

root_conn = psycopg2.connect(dbname = "postgres", user = db_user, password = db_pass) # have to specify a db that exists
root_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
root_cur = root_conn.cursor()
root_cur.execute("DROP DATABASE %s" % ("wb_"+boxid))
root_conn.commit()
root_cur.close()
root_conn.close()

database.create_box(boxid, db_user, db_pass)


def connect_fail():
    logging.debug("Connection failed.")

def do_queries(store):
    """ Test the store.query() interface. """
    store.query({"name": "Daniel"}).addCallback(lambda objs: logging.debug("name=Daniel: "+str(objs)+"\n\n"))
    store.query({"name": "Max"}).addCallback(lambda objs: logging.debug("name=Max: "+str(objs)+"\n\n"))
    store.query({"name": "Max", "height": "100"}).addCallback(lambda objs: logging.debug("name=Max, height=100: "+str(objs)+"\n\n"))
    store.query({"height": "100"}).addCallback(lambda objs: logging.debug("height=100: "+str(objs)+"\n\n"))
    store.query({"height": "150"}).addCallback(lambda objs: logging.debug("height=150: "+str(objs)+"\n\n"))
    reactor.stop()


def cb_connected(conn):
    logging.debug("callback, objectstore connected")
    store = ObjectStoreAsync(conn)

    to_add = [
        ([  {"name": [{"@value": "Daniel"}], "height":[{"@value": '100'}], "@id": "person1"},
                        {"name": [{"@value": "Daniel"}], "height":[{"@value": '150'}], "@id": "person2"},
                        {"name": [{"@value": "Max"}], "height":[{"@value": '100'}], "@id": "person3"},
                        {"name": [{"@value": "Max"}], "height":[{"@value": '150'}], "@id": "person4"}], 0),
    ]

    def cb(added_info):
        logging.debug("cb called, added_info: " + str(added_info))

        if len(to_add) < 1:
            # all added, carry on
            def latest_cb(data):
                print "Latest:" + str(data) + "\n"
                do_queries(store)

            store.get_latest().addCallback(latest_cb)
            return

        objs, version = to_add.pop(0)
        store.add(objs, version).addCallback(cb)

    cb(None)

# connect to box
database.connect_box(boxid, db_user, db_pass).addCallbacks(cb_connected, connect_fail)

reactor.run()

