#    This file is part of WebBox.
#
#    Copyright 2011-2013 Daniel Alexander Smith
#    Copyright 2011-2013 University of Southampton
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

import logging, psycopg2, os, types
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
from webbox.objectstore_query import ObjectStoreQuery

class ObjectStoreAsync:
    """ Stores objects in a database, handling import, export and versioning.

        Each ObjectStore has single cursor, so create a new ObjectStore object per thread.
    """

    # redundant with webbox_pg2.create_database 
    @staticmethod
    def initialise(db_name, root_user, root_pass, db_user, db_pass):
        """ Create the user, database, tables, view and functions. """

        # try to connect
        try:
            conn = psycopg2.connect(database = db_name,
                                    user = db_user,
                                    password = db_pass)
            conn.close()
            # worked fine, so do not need to reconnect object store
            return
        except Exception as e:
            # failed, make sure user exists:
            root_conn = psycopg2.connect(user = root_user, password = root_pass)
            root_cur = root_conn.cursor()

            root_cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [db_user])
            role_exists = root_cur.fetchone()

            if role_exists is None:
                # need to create role
                root_cur.execute("CREATE ROLE %s LOGIN ENCRYPTED PASSWORD '%s' NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE" % (db_user, db_pass))
                root_conn.commit()

            root_cur.close()
            root_conn.close()

        # try to connect again
        try:
            conn = psycopg2.connect(database = db_name,
                                    user = db_user,
                                    password = db_pass)
            conn.close()
            return
        except Exception as e:
            # failed, make sure db exists:
            root_conn = psycopg2.connect(user = root_user, password = root_pass)
            root_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
            root_cur = root_conn.cursor()
            root_cur.execute("CREATE DATABASE %s WITH ENCODING='UTF8' OWNER=%s CONNECTION LIMIT=-1" % (db_name, db_user))
            root_conn.commit()
            root_cur.close()
            root_conn.close()
            

            # load in definition from data/objectstore.sql
            fh_objsql = open(os.path.join(os.path.dirname(__file__),"..","..","data","objectstore.sql")) # FIXME put into config
            objsql = fh_objsql.read()
            fh_objsql.close()

            root_conn = psycopg2.connect(database = db_name, user = root_user, password = root_pass) # reconnect to this new db, and without the isolation level set
            root_cur = root_conn.cursor()
            root_cur.execute(objsql)
            root_conn.commit()
            root_cur.close()
            root_conn.close()


    def __init__(self, conn):
        """
            conn is a postgresql psycopg2 database connection
        """
        self.conn = conn
        # TODO FIXME determine if autocommit has to be off for PL/pgsql support
        self.conn.autocommit = True

    def autocommit(self, value):
        """ Set autocommit on/off, for speeding up large INSERTs. """

        if self.conn.autocommit is False and value is True:
            # if we were in a transaction and now are not, then commit first
            self.conn.commit()

        self.conn.autocommit = value

    def query(self, q):
        """ Perform a query and return results. """
        results_d = Deferred()

        query = ObjectStoreQuery()
        sql, params = query.to_sql(q)

        def results(rows):
            objs_out = self.rows_to_json(rows)
            results_d.callback(objs_out)

        d = self.conn.runQuery(sql, params)
        d.addCallback(results)

        return results_d


    def rows_to_json(self, rows):
        """ Serialise results from database view as JSON-LD

            rows - The object(s) to serialise.
        """

        obj_out = {}
        for row in rows:
            (version, triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype) = row

            if "@version" not in obj_out:
                obj_out["@version"] = version

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

            # add _id key to the object
            obj_out[subject]['_id'] = subject

        return obj_out

    def get_latest_obj(self, object_uri):
        """ Get the latest version of an object in the box, as expanded JSON-LD notation.
            object_uri of the object
        """

        result_d = Deferred()

        def rows_cb(rows):
            obj_out = self.rows_to_json(rows)
            result_d.callback(obj_out)
        
        d = self.conn.runQuery("SELECT version, triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_latest_triples WHERE subject = %s", [object_uri]) # order is implicit, defined by the view, so no need to override it here
        d.addCallback(rows_cb)
 
        return result_d
    
    def get_object_ids(self):
        """ Get a list of IDs (URIs) of objects in this box.
        """
        result_d = Deferred()

        def row_cb(rows, version):
            logging.debug("get_object_ids row_cb: version={0}, rows={1}".format(version, rows))
            uris = []
            for row in rows:
                uris.append(row[0])

            obj_out = {"uris": uris, "@version": version}
            result_d.callback(obj_out)

        def rows_cb(rows):
            logging.debug("get_object_ids rows_cb: "+str(rows))
            if rows is None or len(rows) < 1:
                return result_d.callback({"@version": 0 })
            version = rows[0][0]
            rowd = self.conn.runQuery("SELECT DISTINCT subject FROM wb_v_latest_triples", [])
            rowd.addCallback(lambda rows2: row_cb(rows2,version))

        d = self.conn.runQuery("SELECT latest_version FROM wb_v_latest_version", [])
        d.addCallback(lambda rows: rows_cb(rows))

        return result_d


    def get_latest(self):
        """ Get the latest version of the box, as expanded JSON-LD notation.
        """
        result_d = Deferred()

        def row_cb(rows, version):
            logging.debug("get_latest row_cb: version={0}, rows={1}".format(version, rows))
            obj_out = self.rows_to_json(rows)
            obj_out["@version"] = version
            result_d.callback(obj_out)

        def rows_cb(rows):
            logging.debug("get_latest rows_cb: "+str(rows))
            if rows is None or len(rows) < 1:
                return result_d.callback({"@version": 0 })
            version = rows[0][0]
            rowd = self.conn.runQuery("SELECT version, triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_latest_triples", []) # order is implicit, defined by the view, so no need to override it here
            rowd.addCallback(lambda rows2: row_cb(rows2,version))

        d = self.conn.runQuery("SELECT latest_version FROM wb_v_latest_version", [])
        d.addCallback(lambda rows: rows_cb(rows))

        return result_d


    def add_objects(self, objs, specified_prev_version):
        """ Create a new version of the database, and add/replace only the objects references in the 'objs' dict. All other objects remain as they are in the specified_prev_version of the db.

            objs, json expanded notation of objects,
            specified_prev_version of the databse (must match max(version) of the db, or zero if the object doesn't exist, or the store will return a IncorrectPreviousVersionException

            returns information about the new version
        """
        pass


    def replace(self, objs, specified_prev_version):
        """ Add new objects, or new versions of objects, to the database.

            Completely replaces specified_prev_version with objs.

            objs, json expanded notation of objects,
            specified_prev_version of the databse (must match max(version) of the db, or zero if the object doesn't exist, or the store will return a IncorrectPreviousVersionException

            returns information about the new version
        """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here
        result_d = Deferred()
        logging.debug("Objectstore add")

        def added_cb(info): # self is the deferred
            new_version = info
            logging.debug("added_cb: info="+str(info))
            result_d.callback({"@version": new_version})

        def row_cb(row):
            logging.debug("Objectstore add row_cb, row: " + str(row))

            if row is None or len(row) < 1:
                actual_prev_version = 0
            else:
                actual_prev_version = row[0][0]

            if actual_prev_version is None:
                actual_prev_version = 0

            if actual_prev_version != specified_prev_version:
                ipve = IncorrectPreviousVersionException("Actual previous version is {0}, specified previous version is: {1}".format(actual_prev_version, specified_prev_version))
                ipve.version = actual_prev_version
                failure = Failure(ipve)
                result_d.errback(failure)
                return
            else:
                d = self.create_version(objs, actual_prev_version+1)
                d.addCallback(added_cb)
                return

        d = self.conn.runQuery("SELECT latest_version FROM wb_v_latest_version", [])
        d.addCallback(row_cb)

        return result_d


    def create_version(self, objs, version):
        """ Add new version of the db.

            objs Objects to add
            version The new version to add to
        """

        # FIXME workaround passing version as a Tuple and/or String
        if type(version) == types.TupleType:
            version = version[0]
        if type(version) == types.StringType:
            version = int(version)


        result_d = Deferred()
        logging.debug("Objectstore add_version")

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here

        # TODO add this
        id_user = 1

        triple_order = 0 # for all triples
        queries = []
        for obj in objs:
            
            if "@id" in obj:
                uri = obj["@id"]
            else:
                raise Exception("@id required in all objects")

            for predicate in obj:
                if predicate[0] == "@":
                    continue # skip over json_ld predicates

                sub_objs = obj[predicate]
                for object in sub_objs:
                    if "@value" in object:
                        thetype = "literal"
                        value = object["@value"]
                    elif "@id" in object:
                        thetype = "resource"
                        value = object["@id"]

                    language = ''
                    if "@language" in object:
                        language = object["@language"]

                    datatype = ''
                    if "@type" in object:
                        datatype = object["@type"]

                    triple_order += 1
                    queries.append( ("SELECT * FROM wb_add_triple_to_version(%s, %s, %s, %s, %s, %s, %s, %s, %s)", [version, id_user, uri, predicate, value, thetype, language, datatype, triple_order]) )

        def exec_queries(var):
            logging.debug("Objectstore add_version exec_queries")

            if len(queries) < 1:
                result_d.callback((version))
                return
            
            (query, params) = queries.pop(0)
            d = self.conn.runQuery(query, params)
            d.addCallback(exec_queries)

        exec_queries(None)
        return result_d



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

    def put_rdf(self, rdf, content_type):
        """ Public method to PUT RDF into the store - where PUT replaces. """

        version = 0 # FIXME XXX
        objs = self.rdf_to_objs(rdf, content_type)
        self.objectstore.add(objs, version)

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


    def post_rdf(self, rdf, content_type):
        """ Public method to POST RDF into the store - where POST appends. """

        latest = self.objectstore.get_latest()
        version = latest["@version"] # FIXME ok?

        objs = self.rdf_to_objs(rdf, content_type)

        # include existing objs
        for key in latest:
            if key[0] != "@":
                obj = latest[key]
                obj["@id"] = key
                objs.append(obj)

        self.objectstore.add(objs, version)

        return {"data": "", "status": 200, "reason": "OK"} 


