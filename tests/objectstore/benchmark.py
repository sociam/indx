import psycopg2, time, sys
from objectstore import ObjectStore

# database variables
root_user = "postgres"
root_pass = "foobar"

db_name = "webbox_benchmark" # dropped at first
db_user = "webbox"
db_pass = "foobar"

obj_count = 100 # how many objects to create
prop_count = 100 # how many properties per object

# double check
drop_db = None
while drop_db is None:
    print "Drop the benchmark database? (NB: You must do this if this is the first time running the benchmark."
    drop_db = raw_input("[yes/no] ")
    if drop_db == "yes":
        drop_db = True
    elif drop_db == "no":
        drop_db = False
    else:
        drop_db = None
        print "Please type 'yes' or 'no'"

if drop_db:
    # drop the existing benchmark database (to reset version numbers, or if schema changes etc.)
    root_conn = psycopg2.connect(user=root_user, password=root_pass)
    root_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    root_cur = root_conn.cursor()
    root_cur.execute("DROP DATABASE IF EXISTS %s" % db_name)
    root_cur.close()
    root_conn.close()

    # create schema
    ObjectStore.initialise(db_name, root_user, root_pass, db_user, db_pass)


version = int(raw_input("Previous version (e.g. '0')? "))


# connect as new user
conn = psycopg2.connect(database=db_name, user=db_user, password=db_pass)
store = ObjectStore(conn)

store.autocommit(False)

print "Preparing {0} benchmark objects with {1} properties each.".format(obj_count, prop_count)
to_insert = []
for i in range(obj_count):

    graph_path = "/webbox/object-{0}".format(i)
    graph_uri = "http://localhost:8211{0}".format(graph_path)

    obj = {"@id": graph_uri}
    for j in range(prop_count):
        propname = "{0}#prop{1}".format(graph_uri, j)
        value = {"@value": "value-{0}".format(j)}
        obj[propname] = [value]

    to_insert.append({"graph_uri": graph_uri, "objs": [obj]})

def insert_all():
    global to_insert
    global store

    print "Inserting objects..."
    start_time = time.time()
    for i in to_insert:
        store.add(i['graph_uri'], i['objs'], version);
    end_time = time.time()
    total_time = end_time - start_time

    store.autocommit(True) # commits

    print "Time taken: {0} seconds ({1} triples/second).".format(total_time, float(obj_count * prop_count) / float(total_time))
    

import cProfile
cProfile.run('insert_all()')

