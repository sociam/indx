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

import logging, types
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
from webbox.objectstore_query import ObjectStoreQuery

class ObjectStoreAsync:
    """ Stores objects in a database, handling import, export and versioning.

        Each ObjectStore has single cursor, so create a new ObjectStore object per thread.
    """

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
                if version is None:
                    version = 0
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

            # add @id key to the object
            obj_out[subject]['@id'] = subject

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

        def ver_cb(version):
            logging.debug("get_object_ids ver_cb: "+str(version))
            if version == 0:
                return result_d.callback({"@version": 0 })
            rowd = self.conn.runQuery("SELECT DISTINCT subject FROM wb_v_latest_triples", [])
            rowd.addCallback(lambda rows2: row_cb(rows2, version))

        d = self._get_latest_ver()
        d.addCallback(ver_cb)

        return result_d


    def get_latest(self):
        """ Get the latest version of the box, as expanded JSON-LD notation.
        """
        result_d = Deferred()

        def row_cb(rows, version):
            logging.debug("get_latest row_cb: version={0}, rows={1}".format(version, rows))
            obj_out = self.rows_to_json(rows)
            if version is None:
                version = 0
            obj_out["@version"] = version
            result_d.callback(obj_out)
            return

        def ver_cb(version):
            logging.debug("get_latest ver_cb: "+str(version))
            rowd = self.conn.runQuery("SELECT version, triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_latest_triples", []) # order is implicit, defined by the view, so no need to override it here
            rowd.addCallback(lambda rows2: row_cb(rows2, version))
            return

        d = self._get_latest_ver()
        d.addCallback(ver_cb)
        return result_d


    def ids_from_objs(self, objs):
        """ Return the object IDs from a set of objects.
        """

        ids = []
        for obj in objs:
            if "@id" in obj:
                uri = obj["@id"]
                ids.append(uri)

        return ids


    def diff(self, from_version, to_version, return_objs):
        """ Return the differences between two versions of the database.

            from_version -- The earliest version to check from
            to_version -- The most recent version to check up to
            return_objs -- (boolean) If true, full objects will be returned, otherwise a list of IDs will be returned
        """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here
        result_d = Deferred()

        def objs_cb(rows):
            # callback used if we queried for full objects
            logging.debug("diff objs_cb: rows={0}".format(rows))
            obj_out = self.rows_to_json(rows)

            def ver_cb(version):
                logging.debug("diff ver_cb: "+str(version))
                obj_out["@version"] = version
                result_d.callback({"data": obj_out})
                return

            # grab the latest version number also
            d = self._get_latest_ver()
            d.addCallback(ver_cb)
            return

        def ids_cb(rows):
            # callback used if we queried for the ids of changed objects only
            logging.debug("diff ids_cb: rows={0}".format(rows))
            id_list = []
            for row in rows:
                logging.debug("row: {0}".format(row))
                id_list.append(row[0])
            result_d.callback({"data": id_list})
            return

        if return_objs:
            query = "SELECT version, triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_latest_triples WHERE subject = ANY(SELECT wb_diff(%s, %s))" # order is implicit, defined by the view, so no need to override it here
            d = self.conn.runQuery(query, [from_version, to_version])
            d.addCallback(lambda rows: objs_cb(rows))
        else:
            query = "SELECT wb_diff(%s, %s)"
            d = self.conn.runQuery(query, [from_version, to_version])
            d.addCallback(lambda rows: ids_cb(rows))

        return result_d
        

    def delete(self, id_list, specified_prev_version):
        """ Create a new version of the database, excluding those objects in the id list.

            id_list -- list of object IDs to exclude from the new version
            specified_prev_version -- the current version of the box, error returned if this isn't the current version

            returns information about the new version
        """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here
        result_d = Deferred()
        logging.debug("Objectstore delete")
    
        # TODO add this
        id_user = 1

        def err_cb(failure):
            logging.error("Objectstore delete, err_cb, failure: " + str(failure))
            result_d.errback(failure)

        def cloned_cb(new_ver):
            # has been cloned to a new version, and the objects in id_list were excluded, so we're done.
            logging.debug("Objectstore delete, cloned_cb new_ver: " + str(new_ver))
            result_d.callback({"@version": new_ver})
            return

        # _clone checks the previous version, so no need to do that here
        d = self._clone(specified_prev_version, id_user, id_list)
        d.addCallbacks(cloned_cb, err_cb)
        return result_d


    def _get_latest_ver(self):
        """ Get the latest version of the database and return it to the deferred.
        """

        result_d = Deferred()
        logging.debug("Objectstore _get_latest_ver")

        def err_cb(failure):
            logging.error("Objectstore _get_latest_ver err_cb, failure: " + str(failure))
            result_d.errback(failure)
            return

        def ver_cb(row):
            logging.debug("Objectstore _get_latest_ver ver_cb, row: " + str(row))

            # check for no existing version, and set to 0
            if row is None or len(row) < 1:
                version = 0
            else:
                version = row[0][0]
            if version is None:
                version = 0

            result_d.callback(version)
            return

        d = self.conn.runQuery("SELECT latest_version FROM wb_v_latest_version", [])
        d.addCallbacks(ver_cb, err_cb)

        return result_d


    def _check_ver(self, specified_prev_version):
        """ Find the current version, and check it matches the specified version.
            Returns a deferred, which receives either the current version if it matches the specified version,
            or an errback if it didn't match (with the Failure carrying a value of an IncorrectPreviousVersionException),
            or an errback if there was an error with the query.

            specified_prev_version -- The incoming version from the request.
        """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here
        result_d = Deferred()
        logging.debug("Objectstore _check_ver")

        def err_cb(failure):
            logging.error("Objectstore _check_ver err_cb, failure: " + str(failure))
            result_d.errback(failure)
            return
        
        def ver_cb(actual_prev_version):
            logging.debug("Objectstore _check_ver ver_cb, version: " + str(actual_prev_version))

            # check user specified the current version
            if actual_prev_version != specified_prev_version:
                logging.debug("In objectstore _check_ver, the previous version of the box '{0}' didn't match the actual '{1}".format(specified_prev_version, actual_prev_version))
                ipve = IncorrectPreviousVersionException("Actual previous version is {0}, specified previous version is: {1}".format(actual_prev_version, specified_prev_version))
                ipve.version = actual_prev_version
                failure = Failure(ipve)
                result_d.errback(failure)
                return
            else:
                # success, return the new version in a callback to the deferred
                result_d.callback(actual_prev_version)
                return

        d = self._get_latest_ver()
        d.addCallbacks(ver_cb, err_cb)
        return result_d


    def _clone(self, specified_prev_version, id_user, id_list = []):
        """ Make a new version of the database, excluding objects with the ids specified.

            specified_prev_version -- the current version of the box, error returned if this isn't the current version
            id_user -- the ID of the user making the new version
            id_list -- list of object IDs to exclude from the new version (optional)
        """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here
        result_d = Deferred()
        logging.debug("Objectstore _clone")
    
        def err_cb(failure):
            logging.error("Objectstore _clone err_cb, failure: " + str(failure))
            result_d.errback(failure)
            return

        def cloned_cb(row): # self is the deferred
            logging.debug("Objectstore _clone, cloned_cb row: " + str(row))
            result_d.callback(specified_prev_version + 1)
            return

        def ver_cb(row):
            logging.debug("Objectstore _clone ver_cb, row: " + str(row))

            parameters = [specified_prev_version, specified_prev_version + 1, id_user]
            # excludes these object IDs when it clones the previous version
            parameters.extend(id_list)

            query = "SELECT * FROM wb_clone_version("
            for i in range(len(parameters)):
                if i > 0:
                    query += ", "
                query += "%s"
            query += ")"

            logging.debug("Objectstore _clone, query: {0} params: {1}".format(query, parameters))

            d = self.conn.runQuery(query, parameters)
            d.addCallbacks(cloned_cb, err_cb) # worked or errored
            return

        d = self._check_ver(specified_prev_version)
        d.addCallbacks(ver_cb, err_cb)
        return result_d
        


    def update(self, objs, specified_prev_version):
        """ Create a new version of the database, and insert only the objects references in the 'objs' dict. All other objects remain as they are in the specified_prev_version of the db.

            objs, json expanded notation of objects,
            specified_prev_version of the databse (must match max(version) of the db, or zero if the object doesn't exist, or the store will return a IncorrectPreviousVersionException

            returns information about the new version
        """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here
        result_d = Deferred()
        logging.debug("Objectstore update")
    
        # TODO add this
        id_user = 1

        def err_cb(failure):
            logging.error("Objectstore update, err_cb, failure: " + str(failure))
            result_d.errback(failure)

        def cloned_cb(new_ver):
            logging.debug("Objectstore update, cloned_cb new_ver: " + str(new_ver))

            def added_cb(info):
                # added object successfully
                logging.debug("Objectstore update, added_cb info: "+str(info))
                result_d.callback({"@version": new_ver})
                return

            d = self._add_objs_to_version(objs, new_ver, id_user)
            d.addCallbacks(added_cb, err_cb)
            return

        id_list = self.ids_from_objs(objs)
        # _clone checks the previous version, so no need to do that here
        d = self._clone(specified_prev_version, id_user, id_list)
        d.addCallbacks(cloned_cb, err_cb)
        return result_d


    def _add_objs_to_version(self, objs, version, id_user):
        """ Add objects to a specific version of the db.

            The function used in postgres now automatically increments the triple_order based on the order of insertion.

            objs -- Objects to add
            version -- The version to add to
            id_user -- The id of the user that is making the change
        """
        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here
        logging.debug("Objectstore _add_objs_to_version")


        # FIXME workaround passing version as a Tuple and/or String
        if type(version) == types.TupleType:
            version = version[0]
        if type(version) == types.StringType:
            version = int(version)

        result_d = Deferred()

        queries = []
        for obj in objs:
            
            if "@id" in obj:
                uri = obj["@id"]
            else:
                raise Exception("@id required in all objects")

            for predicate in obj:
                if predicate[0] == "@" or predicate[0] == "_":
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

                    queries.append( ("SELECT * FROM wb_add_triple_to_version(%s, %s, %s, %s, %s, %s, %s, %s)", [version, id_user, uri, predicate, value, thetype, language, datatype]) )

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


# from rdflib import Graph, Literal

# class RDFObjectStore:
#     """ Uses the query store interface (e.g. as a drop-in replacement for fourstore).
#         but asserts/reads data from the objectstore.
#     """

#     def __init__(self, objectstore):
#         self.objectstore = objectstore

#         # mime type to rdflib formats
#         self.rdf_formats = {
#             "application/rdf+xml": "xml",
#             "application/n3": "n3",
#             "text/turtle": "n3", # no turtle-specific parser in rdflib ATM, using N3 one because N3 is a superset of turtle
#             "text/plain": "nt",
#             "application/json": "json-ld",
#             "text/json": "json-ld",
#         }

#     def put_rdf(self, rdf, content_type):
#         """ Public method to PUT RDF into the store - where PUT replaces. """

#         version = 0 # FIXME XXX
#         objs = self.rdf_to_objs(rdf, content_type)
#         self.objectstore.add(objs, version)

#         return {"data": "", "status": 200, "reason": "OK"} 
        


#     def rdf_to_objs(self, rdf, content_type):
#         """ Convert rdf string of a content_type to an array of objects in JSON-LD expanded format as used in objectstore. """

#         rdf_type = self.rdf_formats[content_type]
#         rdfgraph = Graph()
#         rdfgraph.parse(data=rdf, format=rdf_type) # format = xml, n3 etc

#         all_obj = {}
#         for (s, p, o) in rdfgraph:
#             subject = unicode(s)
#             predicate = unicode(p)

#             if subject not in all_obj:
#                 all_obj[subject] = {}
#             if predicate not in all_obj[subject]:
#                 all_obj[subject][predicate] = []

#             object_value = unicode(o)
#             object = {}

#             if type(o) is type(Literal("")):
#                 typekey = "@value"

#                 if o.language is not None:
#                     object["@language"] = o.language
#                 if o.datatype is not None:
#                     object["@type"] = o.datatype
#             else:
#                 typekey = "@id"
            
#             object[typekey] = object_value


#             all_obj[subject][predicate].append(object)
       
#         objs = []
#         for subject in all_obj:
#             obj = all_obj[subject]
#             obj["@id"] = subject
#             objs.append(obj)

#         return objs


#     def post_rdf(self, rdf, content_type):
#         """ Public method to POST RDF into the store - where POST appends. """

#         latest = self.objectstore.get_latest()
#         version = latest["@version"] # FIXME ok?

#         objs = self.rdf_to_objs(rdf, content_type)

#         # include existing objs
#         for key in latest:
#             if key[0] != "@":
#                 obj = latest[key]
#                 obj["@id"] = key
#                 objs.append(obj)

#         self.objectstore.add(objs, version)

#         return {"data": "", "status": 200, "reason": "OK"} 


