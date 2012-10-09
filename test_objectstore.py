from objectstore import ObjectStore
import psycopg2
import json

pg = psycopg2.connect(database="webbox_daniel", user="webbox_daniel")

store = ObjectStore(pg)

uri = "http://example.com/foo1"
obj = {
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": [
        { "@id": "http://xmlns.com/foaf/0.1/Person"
        },
    ],
    "http://xmlns.com/foaf/0.1/name": [
        { "@value": "Daniel A Smith"
        },
    ],
    "http://www.w3.org/2000/01/rdf-schema#label": [
        { "@value": "Daniel A Smith"
        },
        { "@value": "Daniel Alexander Smith"
        },
        { "@value": "Dr Daniel Alexander Smith"
        },
    ],
    "http://xmlns.com/foaf/0.1/homePage": [
        { "@id": "http://danielsmith.eu"
        },
        { "@id": "http://users.ecs.soton.ac.uk/ds"
        },
    ],
    "http://xmlns.com/foaf/0.1/knows": [
        { "@id": "http://rdf.ecs.soton.ac.uk/person/24273"
        },
        { "@id": "http://rdf.ecs.soton.ac.uk/person/25468"
        },
        { "@id": "http://rdf.ecs.soton.ac.uk/person/2686"
        },
    ],
}
prev_version = 1
#store.add(uri, obj, prev_version)

obj_out = store.get_latest(uri)
print json.dumps(obj_out, indent=2)




