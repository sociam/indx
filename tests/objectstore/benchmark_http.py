import httplib, json, logging, urllib
logging.basicConfig(level=logging.DEBUG)

host = "localhost"
port = 8215
version = 3

def put(host, port, path, graph_uri, data):
    global version
    content_type = "application/json"

    connection = httplib.HTTPConnection(host, port)
    connection.request('PUT', "{0}?graph={1}&previous_version={2}".format(path, urllib.quote(graph_uri), version), data, {"Content-type": content_type})

    try:
        result = connection.getresponse()
        #result = threads.blockingCallFromThread(reactor, connection.getresponse)

        if result.status >= 200 and result.status <= 299:
            logging.debug("Status: Successful")
        else:
            logging.debug("Status: Not successful (%s), reason: " % (str(result.status)) + result.reason)

    except Exception as e:
        logging.debug("Error in http_put: "+str(e))



to_insert = []

print "preparing benchmark objects"

# insert 100 objects
for i in range(100):

    graph_path = "/webbox/object-{0}".format(i)
    graph_uri = "http://{0}:{1}{2}".format(host, port, graph_path)

    obj = {"@id": graph_uri}
    # 100 properties each
    for j in range(100):
        propname = "{0}#prop{1}".format(graph_uri, j)
        value = {"@value": "value-{0}".format(j)}
        obj[propname] = [value]

    to_insert.append({"host": host, "port": port, "graph_path": graph_path, "graph_uri": graph_uri, "obj": json.dumps([obj])})

print "inserting objects"

for i in to_insert:
    put(i['host'], i['port'], i['graph_path'], i['graph_uri'], i['obj'])


