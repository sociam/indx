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
    """

    def __init__(self, conn):
        """
            conn is a postgresql psycopg2 database connection, or connection pool.
        """
        self.conn = conn
        # TODO FIXME determine if autocommit has to be off for PL/pgsql support
        self.conn.autocommit = True

    def _notify(self, cur, version):
        """ Notify listeners (in postgres) of a new version (called after update/delete has completed). """
        result_d = Deferred()

        def err_cb(failure):
            logging.error("Objectstore _notify, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        self.conn.runQuery("SELECT wb_version_finished(%s)", [version]).addCallbacks(lambda success: result_d.callback(success), err_cb)
        return result_d


    def autocommit(self, value):
        """ Set autocommit on/off, for speeding up large INSERTs. """
        if self.conn.autocommit is False and value is True:
            # if we were in a transaction and now are not, then commit first
            self.conn.commit()

        self.conn.autocommit = value

    def listen(self, observer):
        """ Listen for updates to the box, and send callbacks when they occur.
        
            observer -- Function that is called when there is a notification.
        """
        result_d = Deferred()

        def err_cb(failure):
            logging.error("Objectstore listen, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        self.conn.addNotifyObserver(observer)
        self.conn.runOperation("LISTEN wb_new_version").addCallbacks(lambda _: result_d.callback(True), err_cb)
        return result_d

    def query(self, q):
        """ Perform a query and return results. """
        result_d = Deferred()

        query = ObjectStoreQuery()
        sql, params = query.to_sql(q)

        def results(rows):
            objs_out = self.rows_to_json(rows)
            result_d.callback(objs_out)
            return

        def err_cb(failure):
            logging.error("Objectstore query, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        self.conn.runQuery(sql, params).addCallbacks(results, err_cb)
        return result_d


    def value_to_json(self, obj_value, obj_type, obj_lang, obj_datatype):
        """ Serialise a single value into the result format.
        """
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

        return obj_struct


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

            obj_struct = self.value_to_json(obj_value, obj_type, obj_lang, obj_datatype)
            obj_out[subject][predicate].append(obj_struct)

            # add @id key to the object
            obj_out[subject]['@id'] = subject

        return obj_out


    def get_latest_objs(self, object_ids):
        """ Get the latest version of objects in the box, as expanded JSON-LD notation.

            object_ids -- ids of the objects to return
        """
        result_d = Deferred()

        def rows_cb(rows):
            obj_out = self.rows_to_json(rows)
            result_d.callback(obj_out)
       
        query = "SELECT version, triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_latest_triples WHERE subject = ANY(ARRAY["
        for i in range(len(object_ids)):
            if i > 0:
                query += ", "
            query += "%s"
        query += "])"

        def err_cb(failure):
            logging.error("Objectstore get_latest_objs, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return
 
        self.conn.runQuery(query, object_ids).addCallbacks(rows_cb, err_cb)
        return result_d


    def _ids_in_versions(self, versions):
        """ Get a list of IDs of objects in multiple versions of a box.

            versions -- Keyed list of versions, like {"from": 1, "to": 3}
        """
        result_d = Deferred()

        def err_cb(failure):
            logging.error("Objectstore _ids_in_versions, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        id_lists = {}

        def ver_cb(name, ids):
            logging.debug("_ids_in_versions ver_cb: name={0}, ids={1}".format(name, ids))
            if name is not None:
                id_lists[name] = ids

            if len(versions) > 0: 
                next_name, next_version = versions.popitem()
                self._ids_in_version(next_version).addCallbacks(lambda next_ids: ver_cb(next_name, next_ids), err_cb)
            else:
                result_d.callback(id_lists)

        ver_cb(None, None)
        return result_d


    def _ids_in_version(self, version):
        """ Get a list of IDs of objects in a specific version of the box.

            version -- Version of box to get IDs for
        """
        result_d = Deferred()

        def rows_cb(rows):
            logging.debug("_ids_in_version rows_cb: rows={0}".format(rows))
            ids = map(lambda row: row[0], rows)
            result_d.callback(ids)
            return

        def err_cb(failure):
            logging.error("Objectstore _ids_in_version, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        self.conn.runQuery("SELECT DISTINCT subject FROM wb_v_all_triples WHERE version = %s", [version]).addCallbacks(rows_cb, err_cb)
        return result_d


    def get_object_ids(self):
        """ Get a list of IDs of objects in this box.
        """
        result_d = Deferred()

        def err_cb(failure):
            logging.error("Objectstore get_object_ids, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def row_cb(rows, version):
            logging.debug("get_object_ids row_cb: version={0}, rows={1}".format(version, rows))
            ids = map(lambda row: row[0], rows)
            obj_out = {"ids": ids, "@version": version}
            result_d.callback(obj_out)
            return

        def ver_cb(version):
            logging.debug("get_object_ids ver_cb: {0}".format(version))
            if version == 0:
                return result_d.callback({"@version": 0 })
            self.conn.runQuery("SELECT DISTINCT subject FROM wb_v_latest_triples", []).addCallbacks(lambda rows2: row_cb(rows2, version), err_cb)
            return

        self._get_latest_ver().addCallbacks(ver_cb, err_cb)
        return result_d


    def get_latest(self):
        """ Get the latest version of the box, as expanded JSON-LD notation.
        """
        result_d = Deferred()

        def err_cb(failure):
            logging.error("Objectstore get_latest, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def row_cb(rows, version):
            logging.debug("get_latest row_cb: version={0}, rows={1}".format(version, rows))
            obj_out = self.rows_to_json(rows)
            if version is None:
                version = 0
            obj_out["@version"] = version
            result_d.callback(obj_out)
            return

        def ver_cb(version):
            logging.debug("get_latest ver_cb: {0}".format(version))
            self.conn.runQuery("SELECT version, triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_latest_triples", []).addCallbacks(lambda rows2: row_cb(rows2, version), err_cb) # ORDER BY is implicit, defined by the view, so no need to override it here
            return

        self._get_latest_ver().addCallbacks(ver_cb, err_cb)
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
            to_version -- The most recent version to check up to (can be None, in which can the latest version will be used)
            return_objs -- ['diff','objects','ids'] Diff of objects will be return, full objects will be returned, or a list of IDs will be returned
        """
        result_d = Deferred()
        def err_cb(failure):
            logging.error("Objectstore diff, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def diff_cb(rows, to_version_used):
            # callback used if we queried for diff of changed objects
            logging.debug("diff diff_cb: rows={0}".format(rows))

            changes = {}

            # triples in the "from" version have been deleted, triples in the "to" version have been added
            translation = {"from": "deleted", "to": "added"}

            for row in rows:
                # version is either "from" or "to"
                version, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype = row
                version = version[0] # must be either 'from' or 'to', is an array because we have to
                key = translation[version]
                if subject not in changes:
                    changes[subject] = {}
                if key not in changes[subject]:
                    changes[subject][key] = {}
                if predicate not in changes[subject][key]:
                    changes[subject][key][predicate] = []

                changes[subject][key][predicate].append(self.value_to_json(obj_value, obj_type, obj_lang, obj_datatype)) 

            def diff_ids_cb(data):
                logging.debug("diff diff_cb - diff_ids_cb: data={0}".format(data))

                # return full objects that have been added
                added_objs = {}
                for item_id in changes.keys():
                    if item_id in data['added']:
                        added_objs[item_id] = changes.pop(item_id)['added'] # items that have been added will have the "to_version" of the full object under 'added'

                # do not return the "deleted" changes for deleted objects
                for item_id in changes.keys():
                    if item_id in data['deleted']:
                        changes.pop(item_id) # remove

                obj_out = {"changed": changes, "added": added_objs, "deleted": data['deleted']}
                result_d.callback({"data": obj_out, "@latest_version": data['latest_version'], "@from_version": data['from_version'], "@to_version": data['to_version']})
                return

            # grab the latest version number also
            get_ids_diff(from_version, to_version_used).addCallbacks(diff_ids_cb, err_cb)
            return

        def objs_cb(rows, to_version_used):
            # callback used if we queried for full objects
            logging.debug("diff objs_cb: rows={0}".format(rows))
            obj_out = self.rows_to_json(rows)

            def ver_cb(version):
                logging.debug("diff objs_cb - ver_cb: {0}".format(version))
                obj_out["@version"] = to_version_used
                result_d.callback({"data": obj_out, "@latest_version": version, "@from_version": from_version, "@to_version": to_version_used})
                return

            # grab the latest version number also
            self._get_latest_ver().addCallbacks(ver_cb, err_cb)
            return

        def ids_cb(data):
            # callback used if we queried for the ids of changed objects only
            result_d.callback({"all_ids": data['all'], "added_ids": data['added'], "deleted_ids": data['deleted'], "changed_ids": data['changed'], "@latest_version": data['latest_version'], "@from_version": data['from_version'], "@to_version": data['to_version']})
            return

    
        def get_ids_diff(from_ver, to_ver):
            logging.debug("diff get_ids_diff: from_ver: {0}, to_ver: {1}".format(from_ver, to_ver))
            get_ids_result_d = Deferred()

            def get_ids_query_cb(rows):
                logging.debug("diff get_ids_query_cb: rows: {0}".format(rows))
                diff_id_list = map(lambda row: row[0], rows)

                def ids_vers_cb(id_lists):
                    logging.debug("diff ids_vers_cb: id_lists: {0}".format(id_lists))
                    from_ids = id_lists['from']
                    to_ids = id_lists['to']

                    def ver_cb(latest_version):
                        logging.debug("diff ver_cb: version: {0}".format(latest_version))

                        changed_id_list, added_id_list, deleted_id_list = [], [], []

                        for item in diff_id_list:
                            if item in from_ids and item in to_ids:
                                changed_id_list.append(item)
                            elif item in from_ids and item not in to_ids:
                                deleted_id_list.append(item)
                            elif item not in from_ids and item in to_ids:
                                added_id_list.append(item)

                        get_ids_result_d.callback({"all": diff_id_list, "added": added_id_list, "deleted": deleted_id_list, "changed": changed_id_list, "latest_version": latest_version, "from_version": from_ver, "to_version": to_ver})
                        return

                    # grab the latest version number also
                    self._get_latest_ver().addCallbacks(ver_cb, err_cb)
                    return

                self._ids_in_versions({"from": from_ver, "to": to_ver}).addCallbacks(ids_vers_cb, err_cb)
                return

            query = "SELECT wb_diff(%s, %s)"
            self.conn.runQuery(query, [from_ver, to_ver]).addCallbacks(get_ids_query_cb, err_cb)
            return get_ids_result_d

        def got_versions(to_version_used):
            # first callback once we have the to_version
            if return_objs == "diff":
                query = "SELECT * FROM wb_diff_changed(%s, %s)" # order is implicit, defined by the view, so no need to override it here
                self.conn.runQuery(query, [from_version, to_version_used]).addCallbacks(lambda rows: diff_cb(rows, to_version_used), err_cb)
            elif return_objs == "objects": 
                query = "SELECT version, triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_all_triples WHERE subject = ANY(SELECT wb_diff(%s, %s)) AND version = %s" # order is implicit, defined by the view, so no need to override it here
                self.conn.runQuery(query, [from_version, to_version_used, to_version_used]).addCallbacks(lambda rows: objs_cb(rows, to_version_used), err_cb)
            elif return_objs == "ids":
                get_ids_diff(from_version, to_version_used).addCallbacks(ids_cb, err_cb)
            else:
                result_d.errback(Failure(Exception("Did not specify valid value of return_objs.")))
            return

        logging.debug("diff to version: {0} type({1})".format(to_version, type(to_version)))

        if to_version is None:
            # if to_version is None, we get the latest version first
            logging.debug("diff to version is None, so getting latest.")
            self._get_latest_ver().addCallbacks(got_versions, err_cb)
        else:
            # else just call got_versions immediately
            logging.debug("diff to version not None, so using version {0}.".format(to_version))
            got_versions(to_version)
        return result_d
        

    def delete(self, id_list, specified_prev_version):
        """ Create a new version of the database, excluding those objects in the id list.

            id_list -- list of object IDs to exclude from the new version
            specified_prev_version -- the current version of the box, error returned if this isn't the current version

            returns information about the new version
        """
        result_d = Deferred()
        logging.debug("Objectstore delete")
    
        # TODO add this
        id_user = 1

        def err_cb(failure):
            logging.error("Objectstore delete, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)

        def cloned_cb(cur, new_ver):
            # has been cloned to a new version, and the objects in id_list were excluded, so we're done.
            logging.debug("Objectstore delete, cloned_cb new_ver: {0}".format(new_ver))
            self._notify(cur, new_ver)
            cloned_d = Deferred()
            cloned_d.callback({"@version": new_ver})
            return cloned_d


        def interaction_cb(cur):
            logging.debug("Objectstore delete, interaction_cb, cur: {0}".format(cur))
            d2 = cur.execute("BEGIN") # start transaction
            d2.addErrback(err_cb)
            d2.addCallback(lambda _: cur.execute("LOCK TABLE wb_triple_vers IN EXCLUSIVE MODE")) # lock to other writes, but not reads
            d2.addCallback(lambda _: cur.execute("LOCK TABLE wb_triples IN EXCLUSIVE MODE"))
            d2.addCallback(lambda _: cur.execute("LOCK TABLE wb_objects IN EXCLUSIVE MODE"))
            d2.addCallback(lambda _: cur.execute("LOCK TABLE wb_strings IN EXCLUSIVE MODE"))
            d2.addCallback(lambda _: cur.execute("LOCK TABLE wb_users IN EXCLUSIVE MODE"))
            d2.addCallback(lambda _: self._clone(cur, specified_prev_version, id_user, id_list))
            d2.addCallback(lambda new_ver: cloned_cb(cur, new_ver))
            d2.addCallback(lambda _: cur.execute("COMMIT"))
#            d2.addCallback(lambda _: cur.close())
            return d2

        d = self.conn.runInteraction(interaction_cb)
        new_ver = specified_prev_version + 1 # FIXME TODO GET FROM DB OR ADDED_CB ABOVE?
        d.addCallbacks(lambda _: result_d.callback({"@version": new_ver}), err_cb)

        # _clone checks the previous version, so no need to do that here
#        self._clone(specified_prev_version, id_user, id_list).addCallbacks(cloned_cb, err_cb)
        return result_d


    def _get_latest_ver(self):
        """ Get the latest version of the database and return it to the deferred.
        """
        result_d = Deferred()
        logging.debug("Objectstore _get_latest_ver")

        def err_cb(failure):
            logging.error("Objectstore _get_latest_ver err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def ver_cb(row):
            logging.debug("Objectstore _get_latest_ver ver_cb, row: {0}".format(row))

            # check for no existing version, and set to 0
            if row is None or len(row) < 1:
                version = 0
            else:
                version = row[0][0]
            if version is None:
                version = 0

            result_d.callback(version)
            return

        self.conn.runQuery("SELECT latest_version FROM wb_v_latest_version", []).addCallbacks(ver_cb, err_cb)
        return result_d


    def _check_ver(self, specified_prev_version):
        """ Find the current version, and check it matches the specified version.
            Returns a deferred, which receives either the current version if it matches the specified version,
            or an errback if it didn't match (with the Failure carrying a value of an IncorrectPreviousVersionException),
            or an errback if there was an error with the query.

            specified_prev_version -- The incoming version from the request.
        """
        result_d = Deferred()
        logging.debug("Objectstore _check_ver, specified_prev_version: {0}".format(specified_prev_version))

        def err_cb(failure):
            logging.error("Objectstore _check_ver err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return
        
        def ver_cb(actual_prev_version):
            logging.debug("Objectstore _check_ver ver_cb, version: {0}".format(actual_prev_version))

            # check user specified the current version
            if actual_prev_version != specified_prev_version:
                logging.debug("In objectstore _check_ver, the previous version of the box {0} didn't match the actual {1}".format(specified_prev_version, actual_prev_version))
                ipve = IncorrectPreviousVersionException("Actual previous version is {0}, specified previous version is: {1}".format(actual_prev_version, specified_prev_version))
                ipve.version = actual_prev_version
                failure = Failure(ipve)
                result_d.errback(failure)
                return
            else:
                # success, return the new version in a callback to the deferred
                result_d.callback(actual_prev_version)
                return

        self._get_latest_ver().addCallbacks(ver_cb, err_cb)
        return result_d


    def _clone(self, cur, specified_prev_version, id_user, id_list = []):
        """ Make a new version of the database, excluding objects with the ids specified.

            cur -- Cursor to execute the query in
            specified_prev_version -- the current version of the box, error returned if this isn't the current version
            id_user -- the ID of the user making the new version
            id_list -- list of object IDs to exclude from the new version (optional)
        """
        result_d = Deferred()
        logging.debug("Objectstore _clone, specified_prev_version: {0}".format(specified_prev_version))
   
        def err_cb(failure):
            logging.error("Objectstore _clone err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def cloned_cb(cur): # self is the deferred
            logging.debug("Objectstore _clone, cloned_cb cur: {0}".format(cur))
            result_d.callback(specified_prev_version + 1)
            return

        def ver_cb(row):
            logging.debug("Objectstore _clone ver_cb, row: {0}".format(row))

            parameters = [specified_prev_version, specified_prev_version + 1, id_user]
            # excludes these object IDs when it clones the previous version
            parameters.extend(id_list)

            query = "SELECT * FROM wb_clone_version(%s,%s,%s,ARRAY["
            for i in range(len(id_list)):
                if i > 0:
                    query += ", "
                query += "%s"
            query += "]::text[])"

            logging.debug("Objectstore _clone, query: {0} params: {1}".format(query, parameters))

            cur.execute(query, parameters).addCallbacks(cloned_cb, err_cb) # worked or errored
            return

        self._check_ver(specified_prev_version).addCallbacks(ver_cb, err_cb)
        return result_d
        

    def update(self, objs, specified_prev_version):
        """ Create a new version of the database, and insert only the objects references in the 'objs' dict. All other objects remain as they are in the specified_prev_version of the db.

            objs, json expanded notation of objects,
            specified_prev_version of the databse (must match max(version) of the db, or zero if the object doesn't exist, or the store will return a IncorrectPreviousVersionException

            returns information about the new version
        """
        result_d = Deferred()
        logging.debug("Objectstore update, specified_prev_version: {0}")
    
        # TODO add this
        id_user = 1

        def err_cb(failure):
            logging.error("Objectstore update, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)

        def cloned_cb(cur, new_ver):
            logging.debug("Objectstore update, cloned_cb new_ver: {0}".format(new_ver))
            cloned_d = Deferred()

            def added_cb(info):
                # added object successfully
                logging.debug("Objectstore update, added_cb info: {0}".format(info))
                self._notify(cur, new_ver) # TODO make sure this only runs on success
                cloned_d.callback({"@version": new_ver})
                return

            self._add_objs_to_version(cur, objs, new_ver, id_user).addCallbacks(added_cb, err_cb)
            return cloned_d

        id_list = self.ids_from_objs(objs)
        
        def interaction_cb(cur):
            logging.debug("Objectstore update, interaction_cb, cur: {0}".format(cur))
            d2 = cur.execute("BEGIN") # start transaction
            d2.addErrback(err_cb)
            d2.addCallback(lambda _: cur.execute("LOCK TABLE wb_triple_vers IN EXCLUSIVE MODE")) # lock to other writes, but not reads
            d2.addCallback(lambda _: cur.execute("LOCK TABLE wb_triples IN EXCLUSIVE MODE"))
            d2.addCallback(lambda _: cur.execute("LOCK TABLE wb_objects IN EXCLUSIVE MODE"))
            d2.addCallback(lambda _: cur.execute("LOCK TABLE wb_strings IN EXCLUSIVE MODE"))
            d2.addCallback(lambda _: cur.execute("LOCK TABLE wb_users IN EXCLUSIVE MODE"))
            d2.addCallback(lambda _: self._clone(cur, specified_prev_version, id_user, id_list))
            d2.addCallback(lambda new_ver: cloned_cb(cur, new_ver))
            d2.addCallback(lambda _: cur.execute("COMMIT"))
#            d2.addCallback(lambda _: cur.close())
            return d2

        d = self.conn.runInteraction(interaction_cb)
        new_ver = specified_prev_version + 1 # FIXME GET FROM DB, OR FROM ADDED_CB?
        d.addCallbacks(lambda _: result_d.callback({"@version": new_ver}), err_cb)

#        self._clone(specified_prev_version, id_user, id_list).addCallbacks(cloned_cb, err_cb)
        return result_d


    def _add_objs_to_version(self, cur, objs, version, id_user):
        """ Add objects to a specific version of the db.

            The function used in postgres now automatically increments the triple_order based on the order of insertion.

            This should only be called by "update" above, which wraps it in a locking transaction.

            cur -- Cursor to use to execute queries
            objs -- Objects to add
            version -- The version to add to
            id_user -- The id of the user that is making the change
        """
        logging.debug("Objectstore _add_objs_to_version")

        def err_cb(failure):
            logging.error("Objectstore _add_objs_to_version, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return


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
            cur.execute(query, params).addCallbacks(exec_queries, err_cb)
            return

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


