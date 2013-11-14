#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Kleek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License, version 3,
#    as published by the Free Software Foundation.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.

import logging
from twisted.internet.defer import Deferred
from twisted.internet import threads
from twisted.python.failure import Failure
from indx.objectstore_query import ObjectStoreQuery
from indx.object_diff import ObjectSetDiff

RAW_LISTENERS = {} # one connection per box to listen to updates

class ObjectStoreAsync:
    """ Stores objects in a database, handling import, export and versioning.
    """

    def __init__(self, conns, username, boxid, appid, clientip):
        """
            conn is a postgresql psycopg2 database connection, or connection pool.
        """
        self.conn = conns['conn']
        self.conns = conns
        self.username = username
        self.boxid = boxid
        self.appid = appid
        self.clientip = clientip

        # TODO FIXME determine if autocommit has to be off for PL/pgsql support
        self.conn.autocommit = True
        self.loggerClass = logging
        self.loggerExtra = {}

    def setLoggerClass(self, loggerClass, extra = None):
        """ Set the class to call .log() on. """
        self.loggerClass = loggerClass
        if extra is not None:
            self.loggerExtra = extra


    def log(self, logLevel, message):
        self.loggerClass.log(logLevel, message, extra = self.loggerExtra)
    
    def debug(self, message):
        self.log(logging.DEBUG, message)

    def error(self, message):
        self.log(logging.ERROR, message)


    def _notify(self, cur, version):
        """ Notify listeners (in postgres) of a new version (called after update/delete has completed). """
        self.debug("ObjectStoreAsync _notify, version: {0}".format(version))
        result_d = Deferred()

        def err_cb(failure):
            self.error("Objectstore _notify, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def new_ver_done(success):
            self._curexec(cur, "SELECT * FROM wb_version_finished(%s)", [version]).addCallbacks(result_d.callback, err_cb)

        self._curexec(cur,
                "INSERT INTO wb_versions (version, updated, username, appid, clientip) VALUES (%s, CURRENT_TIMESTAMP, %s, %s, %s)",
                [version, self.username, self.appid, self.clientip]).addCallbacks(new_ver_done, err_cb)

        return result_d


    def autocommit(self, value):
        """ Set autocommit on/off, for speeding up large INSERTs. """
        if self.conn.autocommit is False and value is True:
            # if we were in a transaction and now are not, then commit first
            self.conn.commit()

        self.conn.autocommit = value

    def unlisten(self, observer):
        """ Stop listening to updates to the box by this observer. """
        logging.debug("Objectstore unlisten.")
        RAW_LISTENERS[self.boxid].unsubscribe(observer)


    def listen(self, observer):
        """ Listen for updates to the box, and send callbacks when they occur.
        
            observer -- Function that is called when there is a notification.
        """
        logging.debug("Objectstore listen")

        if self.boxid in RAW_LISTENERS:
            RAW_LISTENERS[self.boxid].subscribe(observer)
        else:
            """ We create box in RAW_LISTENERS immediately to try to avoid a race condition in the 'if' above.
                This means we have to add the store via a function call, rather than through the constructor.
                This is because the store is created through a callback, so there is a delay.
                It works out OK because subscribers will always be added to the list at the point of
                subscription, but they only receive notifications when the notification connection has been established.
            """
            RAW_LISTENERS[self.boxid] = ConnectionSharer(self.boxid, self)
            RAW_LISTENERS[self.boxid].subscribe(observer)

            def err_cb(failure):
                logging.error("Token: subscribe, error on getting raw store: {0}".format(failure))
                failure.trap(Exception)
                raise failure.value # TODO check that exceptions are OK - I assume so becaus this function doesn't return a Deferred

            def raw_conn_cb(conn):
                logging.debug("Objectstore listen, raw_conn_cb")
                RAW_LISTENERS[self.boxid].add_conn(conn)
            
            self.conns['raw_conn']().addCallbacks(raw_conn_cb, err_cb)


    def query(self, q, predicate_filter = None):
        """ Perform a query and return results.
        
            q -- Query of objects to search for
            predicate_filter -- List of predicates to limit the result objects to (None means no restriction)
        """
        result_d = Deferred()

        query = ObjectStoreQuery()
        sql, params = query.to_sql(q, predicate_filter = predicate_filter)

        def results(rows):
            objs_out = self.rows_to_json(rows)
            result_d.callback(objs_out)
            return

        def err_cb(failure):
            self.error("Objectstore query, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        self.conn.runQuery(sql, params).addCallbacks(results, err_cb)
        return result_d


    def value_to_json(self, obj_value, obj_type, obj_lang, obj_datatype):
        """ Serialise a single value into the result format. """
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
            (triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype) = row

            #if "@version" not in obj_out:
            #    if version is None:
            #        version = 0
            #    obj_out["@version"] = version

            if subject not in obj_out:
                obj_out[subject] = {}

            if predicate not in obj_out[subject]:
                obj_out[subject][predicate] = []

            obj_struct = self.value_to_json(obj_value, obj_type, obj_lang, obj_datatype)
            obj_out[subject][predicate].append(obj_struct)

            # add @id key to the object
            obj_out[subject]['@id'] = subject

        return obj_out


    def get_latest_objs(self, object_ids, cur = None):
        """ Get the latest version of objects in the box, as expanded JSON-LD notation.

            object_ids -- ids of the objects to return
            cur -- Database cursor if the caller is in a transaction (optional)
        """
        self.debug("ObjectStoreASync - get_latest_objs, object_ids: {0}".format(object_ids))
        result_d = Deferred()

        # ensure object_ids is a list and not a single id
        if type(object_ids) != type([]):
            object_ids = [object_ids]

        def rows_cb(rows, version):
            self.error("Objectstore get_latest_objs, rows_cb, rows: {0}, version: {1}".format(rows, version))
            obj_out = self.rows_to_json(rows)
            obj_out["@version"] = version
            result_d.callback(obj_out)
       

        def err_cb(failure):
            self.error("Objectstore get_latest_objs, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)

        def ver_cb(version):
            self.debug("get_latest_objs ver_cb: {0}".format(version))
            if version == 0:
                return result_d.callback({"@version": 0 })

            query = "SELECT triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_latest_triples WHERE subject = ANY(%s)"


            if cur is None:
                self.conn.runQuery(query, [object_ids]).addCallbacks(lambda rows: rows_cb(rows, version), err_cb)
            else:

                def exec_cb(cur):
                    self.debug("Objectstore get_latest_objs exec_cb, cur: {0}".format(cur))
                    rows = cur.fetchall()
                    rows_cb(rows, version)

                self._curexec(cur, query, [object_ids]).addCallbacks(exec_cb, err_cb)

        self._get_latest_ver(cur).addCallbacks(ver_cb, err_cb)

        return result_d


    def _ids_in_versions(self, versions):
        """ Get a list of IDs of objects in multiple versions of a box.

            versions -- Keyed list of versions, like {"from": 1, "to": 3}
        """
        result_d = Deferred()

        def err_cb(failure):
            self.error("Objectstore _ids_in_versions, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        id_lists = {}

        def ver_cb(name, ids):
            self.debug("_ids_in_versions ver_cb: name={0}, ids={1}".format(name, ids))
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
            self.debug("_ids_in_version rows_cb: rows={0}".format(rows))
            ids = map(lambda row: row[0], rows)
            result_d.callback(ids)
            return

        def err_cb(failure):
            self.error("Objectstore _ids_in_version, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        self.conn.runQuery("SELECT DISTINCT subject FROM wb_v_all_triples WHERE version = %s", [version]).addCallbacks(rows_cb, err_cb)
        return result_d


    def get_object_ids(self):
        """ Get a list of IDs of objects in this box.
        """
        result_d = Deferred()

        def err_cb(failure):
            self.error("Objectstore get_object_ids, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def row_cb(rows, version):
            self.debug("get_object_ids row_cb: version={0}, len(rows)={1}".format(version, len(rows)))
            ids = map(lambda row: row[0], rows)
            obj_out = {"ids": ids, "@version": version}
            result_d.callback(obj_out)
            return

        def ver_cb(version):
            self.debug("get_object_ids ver_cb: {0}".format(version))
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
            self.error("Objectstore get_latest, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def row_cb(rows, version):
            self.debug("get_latest row_cb: version={0}, rows={1}".format(version, len(rows)))
            obj_out = self.rows_to_json(rows)
            if version is None:
                version = 0
            obj_out["@version"] = version
            result_d.callback(obj_out)
            return

        def ver_cb(version):
            self.debug("get_latest ver_cb: {0}".format(version))
            self.conn.runQuery("SELECT triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_latest_triples", []).addCallbacks(lambda rows2: row_cb(rows2, version), err_cb) # ORDER BY is implicit, defined by the view, so no need to override it here
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


    def _get_diff_versions(self, versions):
        """ Query for the diffs of the versions in the list 'versions'. """
        result_d = Deferred()
        self.debug("ObjectStore _get_diff_versions, versions: {0}".format(versions))
   
        if len(versions) == 1:
            query = "SELECT * FROM wb_v_diffs WHERE version = %s"
            params = [versions[0]]
        else:
            query = "SELECT * FROM wb_v_diffs WHERE version = ANY(%s)"
            params = [versions]

        self.conn.runQuery(query, params).addCallbacks(result_d.callback, result_d.errback)
        return result_d

    def _db_diff_to_diff(self, diff_rows):
        """ Translate database rows to JSON diff changes. """
        self.debug("ObjectStore _db_diff_to_diff, diff_rows: {0}".format(diff_rows))

        diff = {"changed": {}, "added": {}, "deleted": []}
        for row in diff_rows:
            version, diff_type, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype, object_order = row
            
            if diff_type == "remove_predicate":
                if subject not in diff['changed']:
                    diff['changed'][subject] = {}
                if "deleted" not in diff['changed'][subject]:
                    diff['changed'][subject]["deleted"] = {}
                diff['changed'][subject]["deleted"][predicate] = []

            elif diff_type == "remove_subject":
                diff['deleted'].append(subject)

            elif diff_type == "add_subject":
                if subject not in diff['added']:
                    diff['added'][subject] = {}

            elif diff_type == "add_predicate":
                if subject not in diff['changed']:
                    diff['changed']['added'][subject] = {}
                if "added" not in diff['changed'][subject]:
                    diff['changed'][subject]["added"] = {}
                diff['changed'][subject]["added"][predicate] = []

            elif diff_type == "replace_objects":
                if subject not in diff['changed']:
                    diff['changed'][subject] = {}
                if "replaced" not in diff['changed'][subject]:
                    diff['changed'][subject]["replaced"] = {}
                if predicate not in diff['changed'][subject]["replaced"]:
                    diff['changed'][subject]["replaced"][predicate] = []
                diff['changed'][subject]["replaced"][predicate].append(self.value_to_json(obj_value, obj_type, obj_lang, obj_datatype))

            elif diff_type == "add_triple":
                if subject not in diff['changed']:
                    diff['changed'][subject] = {}
                if "added" not in diff['changed'][subject]:
                    diff['changed'][subject]["added"] = {}
                if predicate not in diff['changed'][subject]["added"]:
                    diff['changed'][subject]["added"][predicate] = []
                diff['changed'][subject]["added"][predicate].append(self.value_to_json(obj_value, obj_type, obj_lang, obj_datatype))

            else:
                raise Exception("Unknown diff type from database")

        return diff

    def _get_diff_combined(self, from_version, to_version):
        """ Get a combined diff from from_version to to_version. """
        self.debug("ObjectStore _get_diff_combined, from_version: {0}, to_version: {1}".format(from_version, to_version))
        result_d = Deferred()

        def diff_cb(diff_rows):
            self.debug("ObjectStore _get_diff_combined, diff_cb diff_rows: {0}".format(diff_rows))
            diffs = {}
            for row in diff_rows:
                version = row[0]
                if version not in diffs:
                    diffs[version] = []
                diffs[version].append(row)

            version_list = sorted(diffs.keys())
            diff = {"changed": {}, "added": {}, "deleted": []}
            for version in version_list:
                new_diff = self._db_diff_to_diff(diffs[version])
                diff = self.diff_on_diff(diff, new_diff)
            result_d.callback(diff)

        versions = range(from_version+1, to_version+1) 
        self._get_diff_versions(versions).addCallbacks(diff_cb, result_d.errback)
        return result_d


    def diff_on_diff(self, existing_diff, next_ver_diff):
        """ Return a JSON-type diff after applying a new JSON-type diff to it."""
        # FIXME does this need to live in object_diff.py ?
        self.debug("ObjectStore diff_on_diff, existing_diff: {0}, next_ver_diff: {1}".format(existing_diff, next_ver_diff))

        # This function plays the diff from next_ver_diff onto existing_diff and returns it

        for uri in next_ver_diff['deleted']:
            if uri not in existing_diff['deleted']:
                existing_diff['deleted'].append(uri)

            if uri in existing_diff['changed']:
                del existing_diff['changed'][uri]

            if uri in existing_diff['added']:
                del existing_diff['added'][uri]

        for uri in next_ver_diff['added']:
            while uri in existing_diff['deleted']: # have to use "while" in case there are multiple refs in the array
                existing_diff['deleted'].remove(uri)
            
            if uri in existing_diff['added']:
                existing_diff['added'][uri].update(next_ver_diff['added'][uri])
            else:
                existing_diff['added'][uri] = next_ver_diff['added'][uri]

        for uri in next_ver_diff['changed']:
            # /added/pred /replaced/pred /deleted/pred

            if "added" in next_ver_diff['changed'][uri]:
                # added in the new diff
                if uri in existing_diff['changed']:
                    # extend existing
                    if "added" not in existing_diff['changed'][uri]:
                        existing_diff['changed'][uri]['added'] = {}
                    existing_diff['changed'][uri]['added'].update( next_ver_diff['changed'][uri]['added'] )
                else:
                    existing_diff['changed'][uri] = next_ver_diff['changed'][uri]

            if "replaced" in next_ver_diff['changed'][uri]:
                # replaced in the new diff

                if uri in existing_diff['changed']:

                    #if "added" in existing_diff['changed'][uri]:
                    #    # if they are added, then add to that, instead of creating a new "changed" entry
                    #    existing_diff['changed'][uri]["added"].update( next_ver_diff['changed'][uri]['replaced'] )

                    if "replaced" in existing_diff['changed'][uri]:
                        existing_diff['changed'][uri]["replaced"].update( next_ver_diff['changed'][uri]['replaced'] )

                    if "deleted" in existing_diff['changed'][uri]:
                        # remove reference to deleted, and instead replace it all
                        del existing_diff['changed'][uri]['deleted']
                        existing_diff['changed'][uri]["replaced"] = next_ver_diff['changed'][uri]['replaced']

                elif uri in existing_diff['deleted']:
                    del existing_diff['deleted'][uri]

                    if uri not in existing_diff['changed']:
                        existing_diff['changed'][uri] = {}
                    if "replaced" not in existing_diff['changed'][uri]:
                        existing_diff['changed'][uri]['replaced'] = {}
                    existing_diff['changed'][uri]['replaced'].update( next_ver_diff['changed'][uri]['replaced'] )
                else:
                    if uri not in existing_diff['changed']:
                        existing_diff['changed'][uri] = {}
                    if "replaced" not in existing_diff['changed'][uri]:
                        existing_diff['changed'][uri]['replaced'] = {}
                    existing_diff['changed'][uri]['replaced'].update( next_ver_diff['changed'][uri]['replaced'] )

            if "deleted" in next_ver_diff['changed'][uri]:
                # deleted in the new diff, remove all 'added' and 'replaced' in existing diff
                if "added" in existing_diff['changed'][uri]:
                    del existing_diff['changed'][uri]['added'] 
                if "replaced" in existing_diff['changed'][uri]:
                    del existing_diff['changed'][uri]['replaced']
                if "deleted" not in existing_diff['changed'][uri]:
                    existing_diff['changed'][uri]['deleted'] = {}
                existing_diff['changed'][uri]['deleted'].update( next_ver_diff['changed'][uri]['deleted'] )

        return existing_diff


    def diff_to_ids(self, diff):
        """ Extract only the IDs from a full diff. """

        ids = {"added": [], "changed": [], "deleted": []}
        for id in diff['added']:
            ids['added'].append(id)
        for id in diff['changed']:
            ids['changed'].append(id)
        for id in diff['deleted']:
            ids['deleted'].append(id)

        return ids


    def diff(self, from_version, to_version, return_objs):
        """ Return the differences between two versions of the database.

            from_version -- The earliest version to check from
            to_version -- The most recent version to check up to (can be None, in which can the latest version will be used)
            return_objs -- ['diff','objects','ids'] Diff of objects will be return, full objects will be returned, or a list of IDs will be returned
        """
        self.debug("ObjectStore diff, from_version: {0}, to_version: {1}, return_objs: {2}".format(from_version, to_version, return_objs))
        result_d = Deferred()
        def err_cb(failure):
            self.error("Objectstore diff, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def diff_cb(to_version_used, combined_diff, latest_ver):
            # handles return_objs = "diff"
            self.debug("ObjectStore diff, diff_cb, rows: {0}".format(combined_diff))
            result_d.callback({"data": combined_diff, "@to_version": to_version_used, "@from_version": from_version, "@latest_version": latest_ver})

        def ids_cb(to_version_used, combined_diff, latest_ver):
            # handles return_objs = "ids"
            self.debug("ObjectStore diff, ids_cb, rows: {0}".format(combined_diff))
            result_d.callback({"data": self.diff_to_ids(combined_diff), "@to_version": to_version_used, "@from_version": from_version, "@latest_version": latest_ver})

        def got_versions(to_version_used, latest_ver):
            self.debug("ObjectStore diff, got_versions, to_version_used: {0}, latest_ver".format(to_version_used, latest_ver))
            # first callback once we have the to_version
            if return_objs == "diff":
                self._get_diff_combined(from_version, to_version_used).addCallbacks(lambda combined_diff: diff_cb(to_version_used, combined_diff, latest_ver), err_cb)
            elif return_objs == "objects": 
                # TODO implement
                result_d.callback(None)
            elif return_objs == "ids":
                self._get_diff_combined(from_version, to_version_used).addCallbacks(lambda combined_diff: ids_cb(to_version_used, combined_diff, latest_ver), err_cb)
            else:
                result_d.errback(Failure(Exception("Did not specify valid value of return_objs.")))
            return

        self.debug("diff to version: {0} type({1})".format(to_version, type(to_version)))

        if to_version is None:
            # if to_version is None, we get the latest version first
            self.debug("diff to version is None, so getting latest.")
            self._get_latest_ver().addCallbacks(lambda ver: got_versions(ver, ver), err_cb)
            
        else:
            # else just call got_versions immediately
            self.debug("diff to version not None, so using version {0}.".format(to_version))
            self._get_latest_ver().addCallbacks(lambda ver: got_versions(to_version, ver), err_cb)

        return result_d

## 
##         def diff_cb(rows, to_version_used):
##             # callback used if we queried for diff of changed objects
##             self.debug("diff diff_cb: rows={0}".format(rows))
## 
##             changes = {}
## 
##             # triples in the "from" version have been deleted, triples in the "to" version have been added
##             translation = {"from": "deleted", "to": "added"}
## 
##             for row in rows:
##                 # version is either "from" or "to"
##                 version, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype = row
##                 version = version[0] # must be either 'from' or 'to', is an array because we have to
##                 key = translation[version]
##                 if subject not in changes:
##                     changes[subject] = {}
##                 if key not in changes[subject]:
##                     changes[subject][key] = {}
##                 if predicate not in changes[subject][key]:
##                     changes[subject][key][predicate] = []
## 
##                 changes[subject][key][predicate].append(self.value_to_json(obj_value, obj_type, obj_lang, obj_datatype)) 
## 
##             def diff_ids_cb(data):
##                 self.debug("diff diff_cb - diff_ids_cb: data={0}".format(data))
## 
##                 # return full objects that have been added
##                 added_objs = {}
##                 for item_id in changes.keys():
##                     if item_id in data['added']:
##                         added_objs[item_id] = changes.pop(item_id)['added'] # items that have been added will have the "to_version" of the full object under 'added'
## 
##                 # do not return the "deleted" changes for deleted objects
##                 for item_id in changes.keys():
##                     if item_id in data['deleted']:
##                         changes.pop(item_id) # remove
## 
##                 obj_out = {"changed": changes, "added": added_objs, "deleted": data['deleted']}
##                 result_d.callback({"data": obj_out, "@latest_version": data['latest_version'], "@from_version": data['from_version'], "@to_version": data['to_version']})
##                 return
## 
##             # grab the latest version number also
##             get_ids_diff(from_version, to_version_used).addCallbacks(diff_ids_cb, err_cb)
##             return
## 
##         def objs_cb(rows, to_version_used):
##             # callback used if we queried for full objects
##             self.debug("diff objs_cb: rows={0}".format(rows))
##             obj_out = self.rows_to_json(rows)
## 
##             def ver_cb(version):
##                 self.debug("diff objs_cb - ver_cb: {0}".format(version))
##                 obj_out["@version"] = to_version_used
##                 result_d.callback({"data": obj_out, "@latest_version": version, "@from_version": from_version, "@to_version": to_version_used})
##                 return
## 
##             # grab the latest version number also
##             self._get_latest_ver().addCallbacks(ver_cb, err_cb)
##             return
## 
##         def ids_cb(data):
##             # callback used if we queried for the ids of changed objects only
##             result_d.callback({"all_ids": data['all'], "added_ids": data['added'], "deleted_ids": data['deleted'], "changed_ids": data['changed'], "@latest_version": data['latest_version'], "@from_version": data['from_version'], "@to_version": data['to_version']})
##             return
## 
##     
##         def get_ids_diff(from_ver, to_ver):
##             self.debug("diff get_ids_diff: from_ver: {0}, to_ver: {1}".format(from_ver, to_ver))
##             get_ids_result_d = Deferred()
## 
##             def get_ids_query_cb(rows):
##                 self.debug("diff get_ids_query_cb: rows: {0}".format(rows))
##                 diff_id_list = map(lambda row: row[0], rows)
## 
##                 def ids_vers_cb(id_lists):
##                     self.debug("diff ids_vers_cb: id_lists: {0}".format(id_lists))
##                     from_ids = id_lists['from']
##                     to_ids = id_lists['to']
## 
##                     def ver_cb(latest_version):
##                         self.debug("diff ver_cb: version: {0}".format(latest_version))
## 
##                         changed_id_list, added_id_list, deleted_id_list = [], [], []
## 
##                         for item in diff_id_list:
##                             if item in from_ids and item in to_ids:
##                                 changed_id_list.append(item)
##                             elif item in from_ids and item not in to_ids:
##                                 deleted_id_list.append(item)
##                             elif item not in from_ids and item in to_ids:
##                                 added_id_list.append(item)
## 
##                         get_ids_result_d.callback({"all": diff_id_list, "added": added_id_list, "deleted": deleted_id_list, "changed": changed_id_list, "latest_version": latest_version, "from_version": from_ver, "to_version": to_ver})
##                         return
## 
##                     # grab the latest version number also
##                     self._get_latest_ver().addCallbacks(ver_cb, err_cb)
##                     return
## 
##                 self._ids_in_versions({"from": from_ver, "to": to_ver}).addCallbacks(ids_vers_cb, err_cb)
##                 return
## 
##             query = "SELECT wb_diff(%s, %s)"
##             self.conn.runQuery(query, [from_ver, to_ver]).addCallbacks(get_ids_query_cb, err_cb)
##             return get_ids_result_d
## 
##         def got_versions(to_version_used):
##             # first callback once we have the to_version
##             if return_objs == "diff":
##                 query = "SELECT * FROM wb_diff_changed(%s, %s)" # order is implicit, defined by the view, so no need to override it here
##                 self.conn.runQuery(query, [from_version, to_version_used]).addCallbacks(lambda rows: diff_cb(rows, to_version_used), err_cb)
##             elif return_objs == "objects": 
##                 query = "SELECT triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_all_triples WHERE subject = ANY(SELECT wb_diff(%s, %s)) AND version = %s" # order is implicit, defined by the view, so no need to override it here
##                 self.conn.runQuery(query, [from_version, to_version_used, to_version_used]).addCallbacks(lambda rows: objs_cb(rows, to_version_used), err_cb)
##             elif return_objs == "ids":
##                 get_ids_diff(from_version, to_version_used).addCallbacks(ids_cb, err_cb)
##             else:
##                 result_d.errback(Failure(Exception("Did not specify valid value of return_objs.")))
##             return
## 
##         self.debug("diff to version: {0} type({1})".format(to_version, type(to_version)))
## 
##         if to_version is None:
##             # if to_version is None, we get the latest version first
##             self.debug("diff to version is None, so getting latest.")
##             self._get_latest_ver().addCallbacks(got_versions, err_cb)
##         else:
##             # else just call got_versions immediately
##             self.debug("diff to version not None, so using version {0}.".format(to_version))
##             got_versions(to_version)
##         return result_d
        

    def delete(self, id_list, specified_prev_version):
        """ Create a new version of the database, excluding those objects in the id list.

            id_list -- list of object IDs to exclude from the new version
            specified_prev_version -- the current version of the box, error returned if this isn't the current version

            returns information about the new version
        """
        self.debug("Objectstore delete") 
        # delegate the whole operation to update
        return self.update([], specified_prev_version, delete_ids=id_list)


    def _log_connections(self):
        """ Log the state of the connection pool (for debugging disconnections). """
        try:
            self.debug("_log_connections: State of connection pool")
            size = range(len(self.conn.connections))
            count = 0
            for connection in self.conn.connections:
                count += 1
                self.debug("_log_connections: connection {0}/{1}: {2}".format(count, size, vars(connection)))
        except Exception as e:
            self.error("_log_connections: could not check state of connections: {0}".format(e))


    def _get_latest_ver(self, cur=None):
        """ Get the latest version of the database and return it to the deferred.

            cur -- Database cursor if the caller is in a transaction (optional)
        """
        result_d = Deferred()
        self.debug("Objectstore _get_latest_ver, cur: {0}".format(cur))

        def err_cb(failure):
            self.error("Objectstore _get_latest_ver err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def ver_cb(row):
            self.debug("Objectstore _get_latest_ver ver_cb, row: {0}".format(row))

            # check for no existing version, and set to 0
            if row is None or len(row) < 1:
                version = 0
            else:
                version = row[0][0]
            if version is None:
                version = 0

            result_d.callback(version)
            return

        if cur is None:
            self.conn.runQuery("SELECT latest_version FROM wb_v_latest_version", []).addCallbacks(ver_cb, err_cb)
        else:

            def exec_cb(cur):
                self.debug("Objectstore _get_latest_ver exec_cb, cur: {0}".format(cur))
                rows = cur.fetchall()
                ver_cb(rows)

            self._curexec(cur, "SELECT latest_version FROM wb_v_latest_version", []).addCallbacks(exec_cb, err_cb)

        return result_d


    def _check_ver(self, cur, specified_prev_version):
        """ Find the current version, and check it matches the specified version.
            Returns a deferred, which receives either the current version if it matches the specified version,
            or an errback if it didn't match (with the Failure carrying a value of an IncorrectPreviousVersionException),
            or an errback if there was an error with the query.

            specified_prev_version -- The incoming version from the request.
        """
        result_d = Deferred()
        self.debug("Objectstore _check_ver, specified_prev_version: {0}".format(specified_prev_version))

        def err_cb(failure):
            self.error("Objectstore _check_ver err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return
        
        def ver_cb(actual_prev_version):
            self.debug("Objectstore _check_ver ver_cb, version: {0}".format(actual_prev_version))

            # check user specified the current version
            if actual_prev_version != specified_prev_version:
                self.debug("In objectstore _check_ver, the previous version of the box {0} didn't match the actual {1}".format(specified_prev_version, actual_prev_version))
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


##    def _clone(self, cur, specified_prev_version, id_list = [], files_id_list = []):
##        """ Make a new version of the database, excluding objects with the ids specified.
##
##            cur -- Cursor to execute the query in
##            specified_prev_version -- the current version of the box, error returned if this isn't the current version
##            id_list -- list of object IDs to exclude from the new version (optional)
##            files_id_list -- list of file OIDs to exclude from the new version of the wb_files table (optional)
##        """
##        result_d = Deferred()
##        self.debug("Objectstore _clone, specified_prev_version: {0}".format(specified_prev_version))
##   
##        def err_cb(failure):
##            self.error("Objectstore _clone err_cb, failure: {0}".format(failure))
##            result_d.errback(failure)
##            return
##
##        def cloned_cb(cur): # self is the deferred
##            self.debug("Objectstore _clone, cloned_cb cur: {0}".format(cur))
##
##            def files_cloned_cb(cur):
##                self.debug("Objectstore _clone, files_cloned_cb cur: {0}".format(cur))
##                result_d.callback(specified_prev_version + 1)
##                return
##
##            files_parameters = [specified_prev_version, specified_prev_version + 1]
##            # excludes these file OIDs when it clones the previous version
##            files_parameters.extend(files_id_list)
##
##            files_query = "SELECT * FROM wb_clone_files_version(%s,%s,ARRAY["
##            for j in range(len(files_id_list)):
##                if j > 0:
##                    files_query += ", "
##                files_query += "%s"
##            files_query += "]::text[])"
##
##            self.debug("Objectstore _clone, files_query: {0} files_params: {1}".format(files_query, files_parameters))
##            self._curexec(cur, files_query, files_parameters).addCallbacks(files_cloned_cb, err_cb) # worked or errored
##            return
##
##        parameters = [specified_prev_version, specified_prev_version + 1]
##        # excludes these object IDs when it clones the previous version
##        parameters.extend(id_list)
##
##        query = "SELECT * FROM wb_clone_version(%s,%s,ARRAY["
##        for i in range(len(id_list)):
##            if i > 0:
##                query += ", "
##            query += "%s"
##        query += "]::text[])"
##
##        self.debug("Objectstore _clone, query: {0} params: {1}".format(query, parameters))
##        self._curexec(cur, query, parameters).addCallbacks(cloned_cb, err_cb) # worked or errored
##
##        return result_d
       

    def _curexec(self, cur, *args, **kwargs):
        """ Execute a query on a Cursor, and log what we're going. """
        self.debug("Objectstore _curexec, args: {0}, kwargs: {1}".format(args, kwargs))
        return cur.execute(*args, **kwargs)


    def update(self, objs, specified_prev_version, delete_ids=[], new_files_oids=[], delete_files_ids=[]):
        """ Create a new version of the database, and insert only the objects references in the 'objs' dict. All other objects remain as they are in the specified_prev_version of the db.

            objs -- json expanded notation of objects,
            specified_prev_version -- ...of the database (must match max(version) of the db, or zero if the object doesn't exist, or the store will return a IncorrectPreviousVersionException
            delete_ids -- remove these objects (array of integers)
            new_files_oids -- array of tuples of (file_oid, file_id, contenttype) of files to add/replace to this version
            delete_files_ids -- array of integers (oids) of files to not include in this version

            returns integer of the new version
        """
        result_d = Deferred()
        self.debug("Objectstore update, specified_prev_version: {0}".format(specified_prev_version))
        from twisted.internet.defer import setDebugging
        setDebugging(True)
   
        def err_cb(failure):
            self.error("Objectstore update err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        # TODO XXX deal with new_files_oids and delete_files_oids


##         ### OLD STUFF FROM HERE
## 
##         # subject ids to not include in the clone
##         id_list = self.ids_from_objs(objs)
##         id_list.extend(delete_ids)
## 
##         # files to not include in the clone
##         files_id_list = []
##         files_id_list.extend(map(lambda x: x[1], new_files_oids)) # extract ids from the new files list
##         files_id_list.extend(delete_files_ids)
##         
        def interaction_cb(cur):
            self.debug("Objectstore update, interaction_cb, cur: {0}".format(cur))
            interaction_d = Deferred()
 
            def interaction_err_cb(failure):
                self.debug("Objectstore update, interaction_err_cb, failure: {0}".format(failure))
                interaction_d.errback(failure) 
## 
##             def cloned_cb(new_ver):
##                 self.debug("Objectstore update, cloned_cb new_ver: {0}".format(new_ver))
## 
##                 def added_cb(info):
##                     # added object successfully
##                     self.debug("Objectstore update, added_cb info: {0}".format(info))
## 
##                     def files_added_cb(info):
##                         self.debug("Objectstore update, files_added_cb info: {0}".format(info))
##                         self._notify(cur, new_ver).addCallbacks(lambda _: interaction_d.callback({"@version": new_ver}), interaction_err_cb)
## 
##                     self._add_files_to_version(cur, new_files_oids, new_ver).addCallbacks(files_added_cb, interaction_err_cb)
## 
##                 if len(objs) > 0: # skip if we're just deleting
##                     self._add_objs_to_version(cur, objs, new_ver).addCallbacks(added_cb, interaction_err_cb)
##                 else:
##                     added_cb(new_ver)
## 
            def ver_cb(latest_ver):
                self.debug("Objectstore update, ver_cb, latest_ver: {0}".format(latest_ver))
                latest_ver = latest_ver[0][0] or 0

                def do_check():
                    self.debug("Objectstore do_check")
                    if latest_ver == specified_prev_version:
                        new_ver = latest_ver + 1

                        def check_err_cb(failure):
                            self.debug("Objectstore check_err_cb, failure: {0}".format(failure))
                            interaction_d.errback(failure)

                        def compare_cb(val):
                            self.debug("Objectstore update, compare_cb, val: {0}".format(val))

                            # do adding files etc here

                            def files_added_cb(info):
                                self.debug("Objectstore update, files_added_cb info: {0}".format(info))
                                self._notify(cur, new_ver).addCallbacks(lambda _: interaction_d.callback({"@version": new_ver}), check_err_cb)

                            self._add_files_to_version(cur, new_files_oids, new_ver).addCallbacks(files_added_cb, check_err_cb)


                        def objs_cb(objs_full):
                            self.debug("Objectstore update, objs_cb, val: {0}".format(objs_full))
                            # add all delete_ids to objs1 and not objs2 so that they get deleted by the ObjectSetDiff
                            for obj_id in delete_ids:
                                if obj_id in objs_full:
                                    objs_full[obj_id] = {"@id": obj_id}

                            for obj_id in delete_ids:
                                objs_full[obj_id] = {"@id": obj_id}

                            # remove "@version" etc from objs_full
                            non_obj_keys = []
                            for key in objs_full:
                                if key[0] == "@":
                                    non_obj_keys.append(key)
                            for key in non_obj_keys:
                                del objs_full[key]

                            objs_full = objs_full.values() # objs_full is "id: {obj}", so extract just the objs
 
                            set_diff = ObjectSetDiff(self.conn, objs_full, objs, new_ver)
                            set_diff.compare(cur).addCallbacks(compare_cb, check_err_cb) # changes the DB for us

                        # add full objects from db to objs_orig if their id is in objs         
                        objs_ids = map(lambda x: x['@id'], objs)
                        self.get_latest_objs(objs_ids, cur).addCallbacks(objs_cb, check_err_cb)


##                         self._clone(cur, specified_prev_version, id_list = id_list, files_id_list = files_id_list).addCallbacks(cloned_cb, check_err_cb)
                    else:
                        self.debug("In objectstore update, the previous version of the box {0} didn't match the actual {1}".format(specified_prev_version, latest_ver))
                        ipve = IncorrectPreviousVersionException("Actual previous version is {0}, specified previous version is: {1}".format(latest_ver, specified_prev_version))
                        ipve.version = latest_ver
                        return Failure(ipve)

                def ver_err_cb(failure):
                    self.debug("Objectstore ver_err_cb, failure: {0}".format(failure))
                    self.debug("ver_err_cb is calling errback on ver_d")
                    interaction_d.errback(failure)

                def check_cb(value):
                    self.debug("Objectstore check_cb, value: {0}".format(value))
                    pass

                d = threads.deferToThread(do_check)
                d.addCallbacks(check_cb, ver_err_cb)

            def lock_cb(val):
                self.debug("Objectstore update, lock_cb, val: {0}".format(val))

                def exec_cb(cur):
                    self.debug("Objectstore update, exec_cb, cur: {0}".format(cur))
                    rows = cur.fetchall()
                    ver_cb(rows)

                self._curexec(cur, "SELECT latest_version FROM wb_v_latest_version").addCallbacks(exec_cb, interaction_err_cb)

            self._curexec(cur, "LOCK TABLE wb_files, wb_versions, wb_latest_vers, wb_triples, wb_users, wb_vers_diffs, wb_latest_subjects IN EXCLUSIVE MODE").addCallbacks(lock_cb, interaction_err_cb) # lock to other writes, but not reads
##             
            return interaction_d
 
 
        def interaction_complete_d(ver_response):
            self.debug("Interaction_complete_d: {0}".format(ver_response))
            ##self.conn.runOperation("VACUUM").addCallbacks(lambda _: result_d.callback(ver_response), err_cb)
            result_d.callback(ver_response)
 
        self.conn.runInteraction(interaction_cb).addCallbacks(interaction_complete_d, err_cb)
        return result_d


    def _add_files_to_version(self, cur, new_files_oids, version):
        """ Add files to a specific version of the db, called after a clone (with exclusions for the new files) has already run.

            It is wrapped in a locking transaction by "update" above.

            cur -- Cursor to execute queries
            new_files_oids -- array of tuples of (file_oid, file_id) of files to add/replace to this version
            version -- The new version to add to
        """
        self.debug("Objectstore _add_files_to_version, version: {0}".format(version))
        result_d = Deferred()

        def err_cb(failure):
            self.error("Objectstore _add_files_to_version, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return
       
        # do nothing if this is empty, clone would have created the new version entirely
        if len(new_files_oids) == 0:
            result_d.callback(version)
            return result_d

        query = "INSERT INTO wb_files (data, version, file_id, contenttype) VALUES "
        params = []
        for fil in new_files_oids:
            file_oid, file_id, contenttype = fil

            if len(params) != 0:
                query += ", "

            query += "(%s, %s, %s, %s)"
            params.extend([file_oid, version, file_id, contenttype])

        def added_cb(info):
            self.debug("Objectstore _add_files_to_version, added_cb, info: {0}".format(info))
            result_d.callback(info)

        self._curexec(cur, query, params).addCallbacks(added_cb, err_cb)
        return result_d


    def _add_objs_to_version(self, cur, objs, version):
        """ Add objects to a specific version of the db.

            The function used in postgres now automatically increments the triple_order based on the order of insertion.

            This should only be called by "update" above, which wraps it in a locking transaction.

            cur -- Cursor to use to execute queries
            objs -- Objects to add
            version -- The version to add to
        """
        self.debug("Objectstore _add_objs_to_version, version: {0}".format(version))
        result_d = Deferred()

        def err_cb(failure):
            self.error("Objectstore _add_objs_to_version, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        queries = []
        for obj in objs:
            self.debug("Objectstore _add_objs_to_version, encoding an object: {0}".format(obj))

            if "@id" in obj:
                uri = obj["@id"]
            else:
                result_d.errback(Failure(Exception("@id required in all objects")))
                return result_d
#                raise Exception("@id required in all objects")

            for predicate in obj:
                if len(predicate) < 1:
                    continue

                if predicate[0] == "@" or predicate[0] == "_":
                    continue # skip over json_ld predicates

                sub_objs = obj[predicate]

                if sub_objs is not None:
                    # turn single object into an array
                    if type(sub_objs) != type([]):
                        sub_objs = [sub_objs]

                    for object in sub_objs:
                        if type(object) != type({}):
                            if type(object) != type(u"") and type(object) != type(""):
                                object = unicode(object)
                            object = {"@value": object} # turn single value into a literal

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

                        queries.append( ("SELECT * FROM wb_add_triple_to_version(%s, %s, %s, %s, %s, %s, %s)", [version, uri, predicate, value, thetype, language, datatype]) )

        def exec_queries(var):
            self.debug("Objectstore add_version exec_queries")

            if len(queries) < 1:
                self.debug("Objectstore add_version exec_queries finished, calling back")
                result_d.callback((version))
                return
            
            (query, params) = queries.pop(0)
            self._curexec(cur, query, params).addCallbacks(exec_queries, err_cb)
            return

        exec_queries(None)
        return result_d


    def list_files(self):
        """ List all of the files in the latest version of the box.

            return a deferred
        """
        result_d = Deferred()

        def err_cb(failure):
            self.error("Objectstore list_files, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)

        def list_cb(rows):
            out = {"data":[]}
            for row in rows:
                version, file_id, contenttype = row
                if "@version" not in out:
                    out["@version"] = version

                out['data'].append({"@id": file_id, "content-type": contenttype})

            result_d.callback(out)

        query = "SELECT version, file_id, contenttype FROM wb_files WHERE version = (SELECT latest_version FROM wb_v_latest_version)"
        self.conn.runQuery(query).addCallbacks(list_cb, err_cb)
        return result_d

    def update_files(self, specified_prev_version, new_files=[], delete_files_ids=[]):
        """ Create a new version of the database by adding files, or removing existing ones.

            specified_prev_version -- The current version of the database, will error if this is incorrect
            new_files -- Array of (file_id, file_data, contenttype) tuples to add.
            delete_files_ids -- File IDs to remove from the new version.

            return a deferred
        """
        result_d = Deferred()
        self.debug("ObjectStoreAsync update_file, specified_prev_version: {0}".format(specified_prev_version))

        def err_cb(failure):
            self.error("Objectstore update_files, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)

        if len(new_files) == 0 and len(delete_files_ids) == 0:
            self.debug("Objectstore update_files, new_files and delete_files_ids both empty, erroring.")
            err = Exception("You must specify some new files or some oids to delete, neither were specified.")
            failure = Failure(err)
            result_d.errback(failure)
            return result_d

        sync_conn = self.conns['sync_conn']() # get a syncronous connection to the database without knowing the password
        new_files_oids = []
        for fil in new_files:
            file_id, file_data, contenttype = fil
            oid = self._add_file_data(sync_conn, file_data)
            new_files_oids.append((oid, file_id, contenttype))
        sync_conn.commit()
        sync_conn.close() # close it immediately, to reduce the risk of running out of available connections (because we're outside of the pool here)

        # punt the actual updating to the update function
        self.update([], specified_prev_version, new_files_oids = new_files_oids, delete_files_ids = delete_files_ids).addCallbacks(lambda ver: result_d.callback(ver), err_cb)
        return result_d


    def _add_file_data(self, conn, data):
        """ Add a new Large Object into the database with this data.

            conn -- A synchronous connection (that has autocommit = False)
            data -- File bytes
            return the oid of the new object.
        """
        self.debug("ObjectStoreAsync add_file_data, opening new lobject with connection: {0}".format(self.conn))
        lobj = conn.lobject()
        lobj.write(data) # FIXME this is not async. txpostgres may not support this :(
        oid = lobj.oid
        lobj.close()
        return oid


    def get_latest_file(self, file_id):
        """ Get the latest version of a file with this file_id.

            file_id -- The file_id of the file to retrieve.
            Returns a deferred, which calls a callback with the file data.
        """
        self.debug("ObjectStoreAsync get_latest_file, file_id: {0}".format(file_id))
        result_d = Deferred()

        def err_cb(failure):
            self.error("Objectstore get_latest_file, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)

        def file_cb(row):
            self.debug("ObjectStoreAsync get_latest_file file_db, row: {0}".format(row))
            if len(row) < 1:
                # there is no file by that name in this box
                e = FileNotFoundException()
                return result_d.errback(Failure(e))

            try:
                file_oid = row[0][0]
                contenttype = row[0][1]
            except Exception as e:
                self.error("ObjectStoreAsync get_latest_file file_db error1: {0}".format(e))
                failure = Failure(e)
                return result_d.errback(failure)

            sync_conn = self.conns['sync_conn']() # get a syncronous connection to the database without knowing the password
            try:
                obj = self._get_file_data(sync_conn, file_oid)
            except Exception as e:
                self.error("ObjectStoreAsync get_latest_file file_db error2: {0}".format(e))
                sync_conn.close()
                failure = Failure(e)
                return result_d.errback(failure)
                
            sync_conn.close()
            result_d.callback((obj, contenttype))

        query = "SELECT data, contenttype FROM wb_files WHERE version = (SELECT MAX(version) FROM wb_files) AND file_id = %s"
        self.conn.runQuery(query, [file_id]).addCallbacks(file_cb, err_cb) 
        return result_d


    def _get_file_data(self, conn, oid):
        """ Get a Large Object from the database with this id.

            conn -- A synchronous connection (that has autocommit = False)
            data -- File bytes
            return the object's bytes.
        """
        self.debug("ObjectStoreAsync get_file_data, oid: {0}".format(oid))
        lobj = conn.lobject(oid, "r")
        obj = lobj.read() # FIXME this is not async. txpostgres may not support this :(
        lobj.close()
        return obj


class IncorrectPreviousVersionException(BaseException):
    """ The specified previous version did not match the actual previous version. """
    pass

class FileNotFoundException(BaseException):
    """ A file was requested, but no file by that name was found in the database. """
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


class ConnectionSharer:
    """ Shares a single non-pooled connection to a box that hangs on a LISTEN call.
    
        The first authenticated user opens the connection and registers as a subscriber.
        
        Later authenticated users only subscribe to it. Each user receives the same update (that a change was made), they then each call a diff (or whatever they want to do) using their own authenticated and pooled connections - this is designed so that we have a single LISTEN call per database, but do not rely on that connection's permissions at all, that is handled by the individual user's connection pool privileges.
    """

    def __init__(self, box, store):
        """
            box -- The name of the box.
        """
        self.box = box
        self.store = store
        self.subscribers = []

    def add_conn(self, conn):
        """ A connection has been connected, so we can start listening.
            conn -- A raw connection using a non-pooled connection to the box (that supports adding an observer)
        """
        self.conn = conn
        self.listen()

    def unsubscribe(self, observer):
        """ Unsubscribe this observer to this box's updates. """
        self.subscribers.remove(observer)

    def subscribe(self, observer):
        """ Subscribe to this box's updates.

        observer -- A function to call when an update occurs. Parameter sent is re-dispatched from the database.
        """
        self.subscribers.append(observer)

    def listen(self):
        """ Start listening to INDX updates. """

        def observer(notify):
            """ Receive a notification update from the store, and dispatch to subscribers. """
            logging.debug("Received a notification in the ConnectionSharer for box {0}.".format(self.box))

            def err_cb(failure):
                # send something to listener?
                failure.trap(Exception)
                logging.error("ConnectionSharer observer error from diff: {0} {1}".format(failure, failure.value))

            def diff_cb(data):
                logging.debug("ConnectionSharer observer dispatching diff to {0} subscribers, diff: {1}".format(len(self.subscribers), data))

                for observer in self.subscribers:
                    observer(data)

            version = int(notify.payload)
            old_version = version - 1 # TODO do this a better way?

            self.store.diff(old_version, version, "diff").addCallbacks(diff_cb, err_cb)

        def err_cb(failure):
            logging.error("ConnectionSharer listen, err_cb, failure: {0}".format(failure))

        def done_cb(val):
            logging.debug("ConnectionSharer listen, done_cb, val: {0}".format(val))

        self.conn.addNotifyObserver(observer)
        self.conn.runOperation("LISTEN wb_new_version").addCallbacks(done_cb, err_cb)

