import psycopg2, time
from objectstore import ObjectStore

conn = psycopg2.connect(database="webbox_daniel", user="webbox", password='foobar')
store = ObjectStore(conn)

print "preparing benchmark objects"
# insert 100 objects
to_insert = []
for i in range(100):

    graph_path = "/webbox/object-{0}".format(i)
    graph_uri = "http://localhost:8211{0}".format(graph_path)

    obj = {"@id": graph_uri}
    # 100 properties each
    for j in range(100):
        propname = "{0}#prop{1}".format(graph_uri, j)
        value = {"@value": "value-{0}".format(j)}
        obj[propname] = [value]

    to_insert.append({"graph_uri": graph_uri, "objs": [obj]})

def insert_all():
    global to_insert
    global store

    print "inserting objects"
    start_time = time.time()
    for i in to_insert:
        store.add(i['graph_uri'], i['objs'], 0);
    end_time = time.time()
    print "time taken: {0}secs".format(end_time - start_time)
    
import cProfile
cProfile.run('insert_all()')



