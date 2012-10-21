#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    WebBox is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

import logging

class ObjectStore:
    """ Stores objects in a database, handling import, export and versioning. """

    def __init__(self, conn):
        """
            conn is a postgresql psycopg2 database connection
        """
        self.conn = conn

        # TODO FIXME determine if autocommit has to be off for PL/pgsql support
        self.conn.autocommit = True

    def get_latest(self, graph_uri):
        """ Get the latest version of a graph, as expanded JSON-LD notation.
            uri of the named graph
        """
        
        cur = self.conn.cursor()

        cur.execute("SELECT graph_uri, graph_version, triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_latest_triples WHERE graph_uri = %s", [graph_uri]) # order is implicit, defined by the view, so no need to override it here
        rows = cur.fetchall()

        obj_out = {"@graph": graph_uri}
        for row in rows:
            (graph_uri_sel, graph_version, triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype) = row

            if "@version" not in obj_out:
                obj_out["@version"] = graph_version

            if subject not in obj_out:
                obj_out[subject] = {}

            if predicate not in obj_out[subject]:
                obj_out[subject][predicate] = []

            if obj_type == "resource":
                obj_key = "@id"
            elif obj_type == "literal":
                obj_key = "@value"
            else:
                raise Exception("Unknown object type from database {0}".format(obj_type)) # TODO create a custom exception to throw

            obj_struct = {}
            obj_struct[obj_key] = obj_value

            if obj_lang is not None:
                obj_struct["@language"] = obj_lang

            if obj_datatype is not None:
                obj_struct["@type"] = obj_datatype

            obj_out[subject][predicate].append(obj_struct)
    
        cur.close()
        return obj_out


    def add(self, graph_uri, objs, specified_prev_version):
        """ Add new objects, or new versions of objects, to a graph in the database.

            graph_uri of the named graph,
            objs, json expanded notation of objects in the graph,
            specified_prev_version of the named graph (must match max(version) of the graph, or zero if the object doesn't exist, or the store will return a IncorrectPreviousVersionException

            returns information about the new version
        """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here

        cur = self.conn.cursor()

        cur.execute("SELECT latest_version FROM wb_v_latest_graphvers WHERE graph_uri = %s", [graph_uri])
        row = cur.fetchone()

        if row is None:
            actual_prev_version = 0
        else:
            actual_prev_version = row[0]

        if actual_prev_version != specified_prev_version:
            raise IncorrectPreviousVersionException("Actual previous version is {0}, specified previous version is: {1}".format(actual_prev_version, specified_prev_version))

        new_version = actual_prev_version + 1

        self.add_graph_version(graph_uri, objs, new_version)

        cur.close()
        return {"@version": new_version, "@graph": graph_uri}


    def get_string_id(self, string):
        """ Get the foreign key ID of a string from the wb_strings table. Create one if necessary. """
        cur = self.conn.cursor()

        # FIXME write a PL/pgsql function for this with table locking
        cur.execute("SELECT wb_strings.id_string FROM wb_strings WHERE wb_strings.string = %s", [string])
        existing_id = cur.fetchone()

        if existing_id is None:
            cur.execute("INSERT INTO wb_strings (string) VALUES (%s) RETURNING id_string", [string])
            existing_id = cur.fetchone()
            self.conn.commit()

        cur.close()
        return existing_id

    def get_object_id(self, type, value, language, datatype):
        """ Get the foreign key ID of an object from the wb_objects table. Create one if necessary. """
        cur = self.conn.cursor()

        # FIXME write a PL/pgsql function for this with table locking
        cur.execute("SELECT id_object FROM wb_objects WHERE obj_type = %s AND obj_value = %s AND obj_lang "+("IS" if language is None else "=")+" %s AND obj_datatype "+("IS" if datatype is None else "=")+" %s", [type, value, language, datatype])
        existing_id = cur.fetchone()

        if existing_id is None:
            cur.execute("INSERT INTO wb_objects (obj_type, obj_value, obj_lang, obj_datatype) VALUES (%s, %s, %s, %s) RETURNING id_object", [type, value, language, datatype])
            existing_id = cur.fetchone()
            self.conn.commit()

        cur.close()
        return existing_id


    def get_triple_id(self, subject, predicate, object):
        """ Get the foreign key ID of a triple from the wb_triples table. Create one if necessary. """
        cur = self.conn.cursor()

        # FIXME write a PL/pgsql function for this with table locking
        cur.execute("SELECT id_triple FROM wb_triples WHERE subject = %s AND predicate = %s AND object = %s", [subject, predicate, object])
        existing_id = cur.fetchone()

        if existing_id is None:
            cur.execute("INSERT INTO wb_triples (subject, predicate, object) VALUES (%s, %s, %s) RETURNING id_triple", [subject, predicate, object])
            existing_id = cur.fetchone()
            self.conn.commit()

        cur.close()
        return existing_id


    def add_graph_version(self, graph_uri, objs, version):
        """ Add new version of a graph.
        """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here
        cur = self.conn.cursor()

        id_graph_uri = self.get_string_id(graph_uri)

        # TODO add this
        id_user = 1

        cur.execute("INSERT INTO wb_graphvers (graph_version, graph_uri, change_user, change_timestamp) VALUES (%s, %s, %s, CURRENT_TIMESTAMP) RETURNING id_graphver", [version, id_graph_uri, id_user])
        id_graphver = cur.fetchone()

        for obj in objs:
            
            if "@id" in obj:
                uri = obj["@id"]
            else:
                raise Exception("@id required in all objects")

            id_subject = self.get_string_id(uri)

            triple_order = 0

            for predicate in obj:
                if predicate[0] == "@":
                    continue # skip over json_ld predicates

                id_predicate = self.get_string_id(predicate)

                sub_objs = obj[predicate]
                for object in sub_objs:
                    if "@value" in object:
                        type = "literal"
                        value = object["@value"]
                    elif "@id" in object:
                        type = "resource"
                        value = object["@id"]

                    language = None
                    if "@language" in object:
                        language = object["@language"]

                    datatype = None
                    if "@type" in object:
                        datatype = object["@type"]

                    id_value = self.get_string_id(value)
                    id_object = self.get_object_id(type, id_value, language, datatype)
                    
                    id_triple = self.get_triple_id(id_subject, id_predicate, id_object)

                    triple_order += 1

                    cur.execute("INSERT INTO wb_graphver_triples (graphver, triple, triple_order) VALUES (%s, %s, %s)", [id_graphver, id_triple, triple_order])

        cur.close()

class IncorrectPreviousVersionException(BaseException):
    """ The specified previous version did not match the actual previous version. """
    pass


from rdflib import Graph, URIRef, Literal

class RDFObjectStore:
    """ Uses the query store interface (e.g. as a drop-in replacement for fourstore).
        but asserts/reads data from the objectstore.
    """

    def __init__(self, objectstore):
        self.objectstore = objectstore

        # mime type to rdflib formats
        self.rdf_formats = {
            "application/rdf+xml": "xml",
            "application/n3": "n3",
            "text/turtle": "n3", # no turtle-specific parser in rdflib ATM, using N3 one because N3 is a superset of turtle
            "text/plain": "nt",
            "application/json": "json-ld",
            "text/json": "json-ld",
        }

    def put_rdf(self, rdf, content_type, graph):
        """ Public method to PUT RDF into the store - where PUT replaces a graph. """

        version = 0 # FIXME XXX
        objs = self.rdf_to_objs(rdf, content_type)
        self.objectstore.add(graph, objs, version)

        return {"data": "", "status": 200, "reason": "OK"} 
        


    def rdf_to_objs(self, rdf, content_type):
        """ Convert rdf string of a content_type to an array of objects in JSON-LD expanded format as used in objectstore. """

        rdf_type = self.rdf_formats[content_type]
        rdfgraph = Graph()
        rdfgraph.parse(data=rdf, format=rdf_type) # format = xml, n3 etc

        all_obj = {}
        for (s, p, o) in rdfgraph:
            subject = unicode(s)
            predicate = unicode(p)

            if subject not in all_obj:
                all_obj[subject] = {}
            if predicate not in all_obj[subject]:
                all_obj[subject][predicate] = []

            object_value = unicode(o)
            object = {}

            if type(o) is type(Literal("")):
                typekey = "@value"

                if o.language is not None:
                    object["@language"] = o.language
                if o.datatype is not None:
                    object["@type"] = o.datatype
            else:
                typekey = "@id"
            
            object[typekey] = object_value


            all_obj[subject][predicate].append(object)
       
        objs = []
        for subject in all_obj:
            obj = all_obj[subject]
            obj["@id"] = subject
            objs.append(obj)

        return objs


    def post_rdf(self, rdf, content_type, graph):
        """ Public method to POST RDF into the store - where POST appends to a graph. """

        version = 0 # FIXME XXX
        objs = self.rdf_to_objs(rdf, content_type)
        self.objectstore.add(graph, objs, version)

        return {"data": "", "status": 200, "reason": "OK"} 


