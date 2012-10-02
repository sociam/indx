from py4s import FourStore
import rdflib
try:
    from rdflib.term import URIRef, Literal, BNode
    from rdflib.namespace import RDF, RDFS
    from rdflib.graph import Graph, ConjunctiveGraph
except ImportError:
    from rdflib import URIRef, RDF, RDFS, Literal, BNode
    from rdflib.Graph import Graph, ConjunctiveGraph


#rdflib.plugin.register('sparql', rdflib.query.Processor,
#                       'rdfextras.sparql.processor', 'Processor')
#rdflib.plugin.register('sparql', rdflib.query.Result,
#                       'rdfextras.sparql.query', 'SPARQLQueryResult')

from StringIO import StringIO

store = FourStore("webbox_das05r")

if __name__ == '__main__':
    #g = Graph(store, "http://webbox.ecs.soton.ac.uk/ns#UploadedFiles")
    #g = ConjunctiveGraph(store, "http://webbox.ecs.soton.ac.uk/ns#UploadedFiles")
    g = ConjunctiveGraph(store)
    #for triple in g.query("SELECT ?uri ?type WHERE {?uri <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?type}"):
    for triple in g.query("SELECT ?uri ?type WHERE {?uri <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://webbox.ecs.soton.ac.uk/ns#File>}"):
        print str(triple)

