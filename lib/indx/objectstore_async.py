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
import os
import json
import copy
from twisted.internet.defer import Deferred
from twisted.internet import threads
from twisted.python.failure import Failure
from indx.objectstore_query import ObjectStoreQuery
from indx.object_diff import ObjectSetDiff
from indx.objectstore_types import Graph, Literal, Resource
from indx.object_commit import ObjectCommit
from indx.reactor import IndxSubscriber

class ObjectStoreAsync:
    """ Stores objects in a database, handling import, export and versioning.
    """

    def __init__(self, indx_reactor, conns, username, boxid, appid, clientip, server_id):
        """
        """
        self.indx_reactor = indx_reactor
        self.conns = conns
        self.username = username
        self.boxid = boxid
        self.appid = appid
        self.clientip = clientip

        self.loggerClass = logging
        self.loggerExtra = {}
        self.server_id = server_id
        self.connection_sharer = ConnectionSharer(self.indx_reactor, self.boxid, self)

    def schema_upgrade(self):
        """ Perform INDX schema upgrades.
        
            conn -- Connection to INDX database.
        """
        return_d = Deferred()

        fh_schemas = self.indx_reactor.open(os.path.join(os.path.dirname(__file__),"..","data","indx-schemas.json")) # FIXME put into config
        schemas = json.loads(fh_schemas)

        def indx_conn_cb(indx_conn):
            logging.debug("Objectstore schema_upgrade, indx_conn_cb")

            def interaction_cb(indx_cur, *args, **kwargs):
                logging.debug("Objectstore schema_upgrade, interaction_cb, args: {0}, kwargs: {1}".format(args, kwargs))
                interaction_d = Deferred()

                def lock_cb(*args):
                    def conn_cb(conn):
                        logging.debug("Objectstore schema_upgrade, conn_cb")

                        def upgrade_from_version(next_version):
                            """ Upgrade the schema from the specified version. """
                            logging.debug("Objectstore schema_upgrade from next_version {0}".format(next_version))

                            sql_total = []
                            indx_sql_total = []
                            last_version = next_version # keep track of the last applied version - this will be saved in the tbl_indx_core k/v table
                            while next_version != "":
                                logging.debug("Objectstore schema_upgrade adding sql from version: {0}".format(next_version))
                                sql_total.append("\n".join(schemas['store-updates']['versions'][next_version]['sql']))
                                last_version = next_version
                                if 'next-version' not in schemas['store-updates']['versions'][next_version]:
                                    break

                                next_version = schemas['store-updates']['versions'][next_version]['next-version']

                            logging.debug("Objectstore schema_upgrade saving last_version as {0}".format(last_version))
                            indx_sql_total.append("DELETE FROM tbl_indx_core WHERE key = 'box_last_schema_version' AND boxid = '" + self.boxid + "';")
                            indx_sql_total.append("INSERT INTO tbl_indx_core (key, value, boxid) VALUES ('box_last_schema_version', '" + last_version + "', '" + self.boxid + "');")

                            # execute queries one at a time
                            def do_next_query(*args, **kw):
                                if len(sql_total) < 1:

                                    def do_next_indx_query(*args, **kw):
                                        if len(indx_sql_total) < 1:
                                            interaction_d.callback(None)
                                            return

                                        query = indx_sql_total.pop(0)
                                        self._curexec(indx_cur, query).addCallbacks(do_next_indx_query, interaction_d.errback)

                                    do_next_indx_query(None)
                                else:
                                    query = sql_total.pop(0)
                                    conn.runOperation(query).addCallbacks(do_next_query, interaction_d.errback)

                            do_next_query(None)


                        # query from a version onwards
                        query = "SELECT value FROM tbl_indx_core WHERE key = %s AND boxid = %s"
                        params = ['box_last_schema_version', self.boxid]

                        def version_cb(*args):
                            rows = indx_cur.fetchall()
                            if len(rows) < 1:
                                # no previous version
                                first_version = schemas['store-updates']['first-version']
                                upgrade_from_version(first_version)
                                return
                            else:
                                this_version = rows[0][0]
                                if 'next-version' in schemas['store-updates']['versions'][this_version]:
                                    next_version = schemas['store-updates']['versions'][this_version]['next-version']
                                else:
                                    interaction_d.callback(True)
                                    return # no next version

                                if next_version == "":
                                    interaction_d.callback(True)
                                    return # no next version

                                upgrade_from_version(next_version)
                                return

                        self._curexec(indx_cur, query, params).addCallbacks(version_cb, interaction_d.errback)
                
                    self.conns['conn']().addCallbacks(conn_cb, interaction_d.errback)

                self._curexec(indx_cur, "LOCK TABLE tbl_acl, tbl_indx_core, tbl_keychain, tbl_tokens, tbl_users IN EXCLUSIVE MODE").addCallbacks(lock_cb, interaction_d.errback) # lock to other writes (and write locks), but not reads
                return interaction_d

            inter_d = indx_conn.runInteraction(interaction_cb)
            inter_d.addCallbacks(return_d.callback, return_d.errback)
        
        self.conns['indx_conn']().addCallbacks(indx_conn_cb, return_d.errback)
        return return_d


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


    def _notify(self, cur, version, commits = None, propagate = True):
        """ Notify listeners (in postgres) of a new version (called after update/delete has completed). """
        self.debug("ObjectStoreAsync _notify, version: {0}".format(version))
        result_d = Deferred()

        def err_cb(failure):
            self.error("Objectstore _notify, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def new_ver_done(success):
            if propagate:
                # via indx reactor
                self.indx_reactor.send({"version": version}, {"type": "version_update", "box": self.boxid})

                # and via database
                self._curexec(cur, "SELECT * FROM wb_version_finished(%s)", [version]).addCallbacks(result_d.callback, err_cb)
            else:
                result_d.callback(True)

        def add_version(empty):
            self._curexec(cur,
                    "INSERT INTO wb_versions (version, updated, username, appid, clientip, commits) VALUES (%s, CURRENT_TIMESTAMP, %s, %s, %s, %s)",
                    [version, self.username, self.appid, self.clientip, commits]).addCallbacks(new_ver_done, err_cb)

        if commits is None:
            commit = ObjectCommit(self.server_id, version)
            commits = [commit.commit_id]
            commit.save(cur).addCallbacks(add_version, result_d.errback)
        else:
            add_version(None)

        return result_d

    def unlisten(self, f_id):
        """ Stop listening to updates to the box by this observer. """
        logging.debug("Objectstore unlisten to {0}".format(f_id))
        return self.connection_sharer.unsubscribe(f_id)

    def listen(self, observer, f_id):
        """ Listen for updates to the box, and send callbacks when they occur.
        
            observer -- Function that is called when there is a notification.
        """
        logging.debug("Objectstore listen to {0}".format(f_id))
        return self.connection_sharer.subscribe(observer, f_id) # returns a deferred

    def query(self, q, predicate_filter = None, render_json = True, depth = 0):
        """ Perform a query and return results.
        
            q -- Query of objects to search for
            predicate_filter -- List of predicates to limit the result objects to (None means no restriction)
        """
        result_d = Deferred()

        query = ObjectStoreQuery()
        sql, params = query.to_sql(q, predicate_filter = predicate_filter)
 
        def conn_cb(conn, *args, **kw):
            logging.debug("Objectstore query, conn_cb")

            def results_cb(rows, *args, **kw):
                logging.debug("Objectstore query, results_cb")
                graph = Graph.from_rows(self.combine_long_string_rows(rows))

                def expanded_cb(*args, **kw):
                    logging.debug("Objectstore query, expanded_cb")
                    if render_json:
                        objs_out = graph.to_json()
                        result_d.callback(objs_out)
                    else:
                        result_d.callback(graph)

                if depth > 0:
                    graph.expand_depth(depth, self).addCallbacks(expanded_cb, result_d.errback)
                else:
                    expanded_cb(None)

            conn.runQuery(sql, params).addCallbacks(results_cb, result_d.errback)
        
        self.conns['conn']().addCallbacks(conn_cb, result_d.errback)

        return result_d

    def get_latest_objs(self, object_ids, cur = None, render_json = True):
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
            self.debug("Objectstore get_latest_objs, rows_cb, rows: {0}, version: {1}".format(rows, version))
            graph = Graph.from_rows(rows)
            if render_json:
                obj_out = graph.to_json()
                result_d.callback({"data": obj_out, "@version": version}) 
            else:
                result_d.callback(graph)

        def err_cb(failure):
            self.error("Objectstore get_latest_objs, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)

        def ver_cb(version):
            self.debug("get_latest_objs ver_cb: {0}".format(version))
            if version == 0:
                if render_json:
                    return result_d.callback({"data": {}, "@version": 0})
                else:
                    return result_d.callback(Graph())

            query = "SELECT id_results.triple_order as triple_order, j_subject.string as subject, j_predicate.string as predicate, j_object.string as obj_value, wb_objects.obj_type, wb_objects.obj_lang, wb_objects.obj_datatype, j_object.uuid, j_object.chunk FROM (WITH theid AS (SELECT unnest(wb_get_string_ids(%s)) AS someid) SELECT * FROM wb_latest_vers JOIN wb_triples ON wb_latest_vers.triple = wb_triples.id_triple WHERE subject_uuid IN (SELECT someid FROM theid)) AS id_results JOIN wb_strings j_subject ON j_subject.uuid = id_results.subject_uuid JOIN wb_strings j_predicate ON j_predicate.uuid = id_results.predicate_uuid JOIN wb_objects ON wb_objects.id_object = id_results.object JOIN wb_strings j_object ON j_object.uuid = wb_objects.obj_value_uuid ORDER BY triple_order, j_object.uuid, j_object.chunk"
#            query = "SELECT triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_latest_triples WHERE subject = ANY(%s)"


            if cur is None:
                def conn_cb(conn):
                    logging.debug("Objectstore get_latest_objs, conn_cb")
                    conn.runQuery(query, [object_ids]).addCallbacks(lambda rows: rows_cb(self.combine_long_string_rows(rows), version), err_cb)
                
                self.conns['conn']().addCallbacks(conn_cb, result_d.errback)
            else:

                def exec_cb(cur):
                    self.debug("Objectstore get_latest_objs exec_cb, cur: {0}".format(cur))
                    rows = cur.fetchall()
                    rows_cb(self.combine_long_string_rows(rows), version)

                self._curexec(cur, query, [object_ids]).addCallbacks(exec_cb, err_cb)

        self._get_latest_ver(cur).addCallbacks(ver_cb, err_cb)

        return result_d


    def combine_long_string_rows(self, rows, diff_row = False):
        logging.debug("Objectstore combine_long_string_rows for len(rows) = {0}, diff_row = {1}".format(len(rows), diff_row))

        new_rows = []
        prev_uuid = None
        this_row = ()

        if diff_row:
            uuid_index = 9
            chunk_index = 10
            obj_index = 4
        else:
            uuid_index = 7
            chunk_index = 8
            obj_index = 3

        # query must order by triples and then [uuid, chunk], so we can just loop through once here
        prev_chunk = 0
        for row in rows:

            uuid = row[uuid_index]
            chunk = row[chunk_index]

            if uuid == prev_uuid and prev_uuid != None and chunk > prev_chunk:
                # extend the object value string, everything else the same
                this_row[obj_index] += row[obj_index]
            else:
                if len(this_row) > 0:
                    new_rows.append(this_row)
                this_row = list(copy.copy(row[0:uuid_index])) # without uuid
                prev_uuid = uuid

            prev_chunk = chunk

        if len(this_row) > 0:
            new_rows.append(this_row)
        
        logging.debug("Objectstore combine_long_string_rows completed, len(new_rows) = {0}".format(len(new_rows)))
        return new_rows


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

        def conn_cb(conn):
            logging.debug("Objectstore _ids_in_version, conn_cb")
            # TODO optimise
            conn.runQuery("SELECT DISTINCT subject FROM wb_v_all_triples WHERE version = %s", [version]).addCallbacks(rows_cb, err_cb)
        
        self.conns['conn']().addCallbacks(conn_cb, result_d.errback)

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

            def conn_cb(conn):
                logging.debug("Objectstore get_object_ids, conn_cb")
                conn.runQuery("SELECT DISTINCT j_subject.string AS subject FROM wb_latest_vers JOIN wb_triples ON wb_triples.id_triple = wb_latest_vers.triple JOIN wb_strings j_subject ON j_subject.uuid = wb_triples.subject_uuid", []).addCallbacks(lambda rows2: row_cb(rows2, version), err_cb)
            
            self.conns['conn']().addCallbacks(conn_cb, result_d.errback)

        self._get_latest_ver().addCallbacks(ver_cb, err_cb)
        return result_d


    def get_latest(self, render_json = True):
        """ Get the latest version of the box, as expanded JSON-LD notation.
        """
        result_d = Deferred()

        def err_cb(failure):
            self.error("Objectstore get_latest, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        def row_cb(rows, version):
            self.debug("get_latest row_cb: version={0}, rows={1}".format(version, len(rows)))
            graph = Graph.from_rows(rows)
            if render_json:
                obj_out = graph.to_json()
                result_d.callback({"data": obj_out, "@version": version or 0})
            else:
                result_d.callback(graph)

        def ver_cb(version):
            self.debug("get_latest ver_cb: {0}".format(version))

            def conn_cb(conn):
                logging.debug("Objectstore get_latest, conn_cb")
                conn.runQuery("SELECT triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype, uuid, chunk FROM wb_v_latest_triples", []).addCallbacks(lambda rows2: row_cb(self.combine_long_string_rows(rows2), version), err_cb) # ORDER BY is implicit, defined by the view, so no need to override it here
            
            self.conns['conn']().addCallbacks(conn_cb, result_d.errback)

            return

        self._get_latest_ver().addCallbacks(ver_cb, err_cb)
        return result_d


    def ids_from_objs(self, objs):
        """ Return the object IDs from a set of objects.
        """
        return [x['@id'] for x in objs]


    def _get_diff_versions(self, versions):
        """ Query for the diffs of the versions in the list 'versions'. """
        result_d = Deferred()
        self.debug("ObjectStore _get_diff_versions, versions: {0}".format(versions))
   
        if len(versions) == 1:
            query = "SELECT version, diff_type, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype, object_order, uuid, chunk FROM wb_v_diffs WHERE version = %s"
            params = [versions[0]]
        else:
            query = "SELECT version, diff_type, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype, object_order, uuid, chunk FROM wb_v_diffs WHERE version = ANY(%s)"
            params = [versions]


        def conn_cb(conn):
            logging.debug("Objectstore _get_diff_versions, conn_cb")
            conn.runQuery(query, params).addCallbacks(lambda rows: result_d.callback(self.combine_long_string_rows(rows, diff_row = True)), result_d.errback)
        
        self.conns['conn']().addCallbacks(conn_cb, result_d.errback)
        return result_d



    def apply_diff(self, diff, commits):
        """ Apply a JSON-type diff to the database, appending to the wb_vers_diff table and modifying the wb_latest_vers table. """
        logging.debug("Objectstore apply_diff, apply_diff")
        result_d = Deferred()

        def interaction_cb(cur):
            logging.debug("Objectstore apply_diff, interaction_cb")
            iresult_d = Deferred()

            def lock_cb(empty):

                def ver_cb(cur_version):
                    logging.debug("Objectstore apply_diff, ver_cb")
                    new_version = cur_version + 1
                    ver_cb.order = 0 # TODO move this somewhere else?

                    queries = {
                        "subjects": {
                            "values": [],
                            "params": [],
                            "query_prefix": "INSERT INTO wb_latest_subjects (id_subject) VALUES "
                        },
                        "diff": {
                            "values": [],
                            "params": [],
                            "query_prefix": "INSERT INTO wb_vers_diffs (version, diff_type, subject, predicate, object, object_order) VALUES "
                        },
                        "prelatest": { # queries that are to be run immediately before latest. i.e., DELETE FROM before new INSERT INTO are run when replacing objects
                            "queries": [], # just bare queries, no prefixing/rendering
                        },
                        "latest": {
                            "values": [],
                            "params": [],
                            "query_prefix": "INSERT INTO wb_latest_vers (triple, triple_order) VALUES "
                        },
                    }

                    def obj_to_tuples(val):
                        logging.debug("Objectstore apply_diff, obj_to_tuples")
                        if "@id" in val:
                            value = val['@id']
                            thetype = 'resource'
                            language = ''
                            datatype = ''
                        else:
                            value = val['@value']
                            thetype = 'literal'
                            language = val['@language']
                            datatype = val['@type']

                        return value, thetype, language, datatype


                    def add_obj(uri, obj):
                        logging.debug("Objectstore apply_diff, add_obj")

                        queries['subjects']['values'].append("(wb_get_string_id(%s))")
                        queries['subjects']['params'].extend([uri])

                        for pred, values in obj.items():
                            for val in values:
                                ver_cb.order += 1 
                                value, thetype, language, datatype = obj_to_tuples(val)

                                # change 'latest' table
                                queries['latest']['values'].append("(wb_get_triple_id(%s, %s, %s, %s, %s, %s), %s)")
                                queries['latest']['params'].extend([uri, pred, value, thetype, language, datatype, ver_cb.order])
                                
                                # append to 'diff' table

                                # add_subject
                                queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), NULL, NULL)")
                                queries['diff']['params'].extend([new_version, 'add_subject', uri, pred])            

                                # add_predicate
                                queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), NULL, NULL)")
                                queries['diff']['params'].extend([new_version, 'add_predicate', uri, pred])            

                                # add_triple
                                queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), wb_get_object_id(%s, %s, %s, %s), %s)")
                                queries['diff']['params'].extend([new_version, 'add_triple', uri, pred, thetype, value, language, datatype, ver_cb.order])            


                    if 'deleted' in diff:
                        urilist = diff['deleted']
                        if len(urilist) > 0:
                            queries['prelatest']['queries'].append(("DELETE FROM wb_latest_vers USING wb_triples, wb_strings AS subjects WHERE subjects.uuid = wb_triples.subject_uuid AND wb_latest_vers.triple = wb_triples.id_triple AND subjects.string = ANY(%s)", [urilist]))

                        for uri in urilist:
                            queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), NULL, NULL)")
                            queries['diff']['params'].extend([new_version, 'remove_subject', uri, None])


                    if 'added' in diff:
                        for uri, obj in diff['added'].items():
                            obj = obj['added'] # all objects are under the key 'added'
                            add_obj(uri, obj)


                    if 'changed' in diff:
                        for uri, changes in diff['changed'].items():
                            if 'added' in changes:
                                add_obj(uri, changes['added'])
                                
                            if 'deleted' in changes:
                                # remove_predicate
                                for pred, vals in changes['deleted'].items():
                                    queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), NULL, NULL)")
                                    queries['diff']['params'].extend([new_version, 'remove_predicate', uri, pred])
                                    

                            if 'replaced' in changes:
                                # remove_predicate
                                for pred, vals in changes['replaced'].items():
                                    queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), NULL, NULL)")
                                    queries['diff']['params'].extend([new_version, 'remove_predicate', uri, pred])

                                # add_predicate
                                for pred, vals in changes['replaced'].items():
                                    queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), NULL, NULL)")
                                    queries['diff']['params'].extend([new_version, 'add_predicate', uri, pred])

                                # add_triple
                                for pred, vals in changes['replaced'].items():
                                    for val in vals:
                                        ver_cb.order += 1
                                        value, thetype, language, datatype = obj_to_tuples(val)
                                        queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), wb_get_object_id(%s, %s, %s, %s), %s)")
                                        queries['diff']['params'].extend([new_version, 'add_triple', uri, pred, thetype, value, language, datatype, ver_cb.order])            
                   

                    # TODO replace_objects never used, check this is ok?

                    # do queries
                    def gen_queries(keys, cur, max_params = None):
                        """ Check if the number of parameters in the queries is above the MAX_PARAMS_PER_QUERY, and if so, render that query and reset it. """
                        logging.debug("Objectstore apply_diff, gen_queries")
                        result2_d = Deferred()

                        if max_params is None:
                            #max_params = self.MAX_PARAMS_PER_QUERY
                            max_params = 1

                        def run_next(empty):
                            logging.debug("Objectstore apply_diff, run_next")
                            if len(keys) < 1:
                                result2_d.callback(True)
                            else:
                                quer = keys.pop(0)

                                # max_params == 0 override is required because if quer is 'latest' and has no params, 'prelatest' might still have queries
                                if len(queries[quer]['params']) > max_params or max_params == 0:
                                    logging.debug("ObjectStore apply_diff gen_queries, queries for {0}, queries are: {1}".format(quer, queries['prelatest']['queries']))
                                    querylist = []
                                
                                    # do prelatest before latest, only when latest has hit max_params
                                    if quer == 'latest':
                                        querylist.extend(queries['prelatest']['queries'])
                                        queries['prelatest']['queries'] = [] # empty the list of queries

                                    if len(queries[quer]['values']) > 0:
                                        query = queries[quer]['query_prefix'] + ", ".join(queries[quer]['values'])
                                        params = queries[quer]['params']

                                        querylist.append( (query, params) ) # querylist is tuples of (query, params)

                                        queries[quer]['values'] = []
                                        queries[quer]['params'] = []

                                    def run_querylist(empty):

                                        if len(querylist) < 1:
                                            run_next(None)
                                        else:
                                            qp_pair = querylist.pop(0)
                                            query, params = qp_pair

                                            logging.debug("ObjectStore apply_diff, run_querylist running: query: {0}, params: {1}".format(query,params))
                                            cur.execute(query, params).addCallbacks(run_querylist, result2_d.errback)

                                    run_querylist(None)
                                else:
                                    run_next(None)

                        run_next(None)
                        return result2_d

                    def commits_cb(empty):

                        def diff_cb(empty):
                            logging.debug("Objectstore apply_diff, diff_cb")

                            def latest_cb(empty):
                                logging.debug("Objectstore apply_diff, latest_cb")
                                self._notify(cur, new_version, commits = commits.keys(), propagate = False).addCallbacks(lambda _: iresult_d.callback({"@version": new_version}), iresult_d.errback)

                            gen_queries(['latest', 'subjects'], cur, max_params = 0).addCallbacks(latest_cb, iresult_d.errback)

                        gen_queries(['diff'], cur, max_params = 0).addCallbacks(diff_cb, iresult_d.errback)

                    self.store_commits(commits, cur = cur).addCallbacks(commits_cb, iresult_d.errback)
     
                self._get_latest_ver(cur).addCallbacks(ver_cb, iresult_d.errback)


            self._curexec(cur, "LOCK TABLE ix_commits, wb_files, wb_versions, wb_latest_vers, wb_triples, wb_users, wb_vers_diffs, wb_latest_subjects IN EXCLUSIVE MODE").addCallbacks(lock_cb, iresult_d.errback) # lock to other writes, but not reads
            return iresult_d

        def iconn_cb(conn):
            logging.debug("Objectstore apply_diff, iconn_cb")
            conn.runInteraction(interaction_cb).addCallbacks(result_d.callback, result_d.errback)
        
        self.conns['conn']().addCallbacks(iconn_cb, result_d.errback)
        return result_d


    def order_diff_rows(self, diff_rows):
        """ Re-order the diff_rows so that add_predicate etc comes before add_triple. """

        diff_type_index = 1 # of the sql row result

        new_diff_rows = []

        order = [
            "remove_predicate",
            "remove_subject",
            "replace_objects",
            "add_subject",
            "add_predicate",
            "add_triple",
        ]

        by_type = {}
        map(lambda typ: by_type.update({typ: []}), order) # init the object
        map(lambda x: by_type[x[diff_type_index]].append(x), diff_rows) # add the diff_rows, indx by type

        for orde in order:
            new_diff_rows.extend(by_type[orde])
        
        return new_diff_rows


    def _db_diff_to_diff(self, diff_rows):
        """ Translate database rows to JSON diff changes. """
        self.debug("ObjectStore _db_diff_to_diff, diff_rows: {0}".format(diff_rows))

        diff_rows = self.order_diff_rows(diff_rows)

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
                subkey = 'changed'
                if subject in diff['added']:
                    subkey = 'added'

                if subject not in diff[subkey]:
                    diff[subkey]['added'][subject] = {}
                if "added" not in diff[subkey][subject]:
                    diff[subkey][subject]["added"] = {}
                diff[subkey][subject]["added"][predicate] = []

            elif diff_type == "replace_objects":
                subkey = 'changed'
                if subject in diff['added']:
                    subkey = 'added'

                if subject not in diff[subkey]:
                    diff[subkey][subject] = {}
                if "replaced" not in diff[subkey][subject]:
                    diff[subkey][subject]["replaced"] = {}
                if predicate not in diff[subkey][subject]["replaced"]:
                    diff[subkey][subject]["replaced"][predicate] = []
                obj = Graph.value_from_row(obj_value, obj_type, obj_lang, obj_datatype) # TODO check this renders resources correctly
                diff[subkey][subject]["replaced"][predicate].append(obj.to_json())

            elif diff_type == "add_triple":
                subkey = 'changed'
                if subject in diff['added']:
                    subkey = 'added'

                if subject not in diff[subkey]:
                    diff[subkey][subject] = {}
                if "added" not in diff[subkey][subject]:
                    diff[subkey][subject]["added"] = {}
                if predicate not in diff[subkey][subject]["added"]:
                    diff[subkey][subject]["added"][predicate] = []
                obj = Graph.value_from_row(obj_value, obj_type, obj_lang, obj_datatype) # TODO check this renders resources correctly
                obj_json = obj.to_json()
                logging.debug("ObjectStore _db_diff_to_diff, obj_json: {0}".format(obj_json))
                diff[subkey][subject]["added"][predicate].append(obj_json)

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
                logging.debug("ObjectStore _get_diff_combined new_diff: {0}".format(new_diff))
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
    
            # TODO look in existing_diff['added'] and if there is the uri in there, then act differently.
            is_new = uri in existing_diff['added']
            if is_new:
                subkey = "added"
            else:
                subkey = "changed"


            if "added" in next_ver_diff['changed'][uri]:
                # added in the new diff
                if uri in existing_diff[subkey]:
                    # extend existing
                    if "added" not in existing_diff[subkey][uri]:
                        existing_diff[subkey][uri]['added'] = {}
                    existing_diff[subkey][uri]['added'].update( next_ver_diff['changed'][uri]['added'] )
                else:
                    existing_diff[subkey][uri] = next_ver_diff['changed'][uri]

            if "replaced" in next_ver_diff['changed'][uri]:
                # replaced in the new diff

                if uri in existing_diff[subkey]:
                    # subkey is 'added', or 'changed'

                    if "added" in existing_diff[subkey][uri]:
                        existing_diff[subkey][uri]["added"] = next_ver_diff['changed'][uri]['replaced']
                    elif "replaced" in existing_diff[subkey][uri]:
                        existing_diff[subkey][uri]["replaced"] = next_ver_diff['changed'][uri]['replaced']
                    elif "deleted" in existing_diff[subkey][uri]:
                        del existing_diff[subkey][uri]["deleted"]
                        existing_diff[subkey][uri]["replaced"] = next_ver_diff['changed'][uri]['replaced']

                elif uri in existing_diff['deleted']:
                    subkey = "deleted"
                    existing_diff['deleted'].remove(uri)

                    if uri not in existing_diff['changed']:
                        existing_diff['changed'][uri] = {}
                    if "replaced" not in existing_diff['changed'][uri]:
                        existing_diff['changed'][uri]['replaced'] = {}
                    existing_diff['changed'][uri]['replaced'].update( next_ver_diff['changed'][uri]['replaced'] )
                else:
                    # uri not in existing diff
                    existing_diff['changed'][uri] = {}
                    existing_diff['changed'][uri]['replaced'] = next_ver_diff['changed'][uri]['replaced']

            if "deleted" in next_ver_diff['changed'][uri]:
                # deleted in the new diff, remove all 'added' and 'replaced' in existing diff
                if uri in existing_diff['changed']:
                    if "added" in existing_diff['changed'][uri]:
                        del existing_diff['changed'][uri]['added'] 
                    if "replaced" in existing_diff['changed'][uri]:
                        del existing_diff['changed'][uri]['replaced']
                    if "deleted" not in existing_diff['changed'][uri]:
                        existing_diff['changed'][uri]['deleted'] = {}
                    existing_diff['changed'][uri]['deleted'] = next_ver_diff['changed'][uri]['deleted']

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

        def diff_cb(to_version_used, combined_diff, latest_ver, commits):
            # handles return_objs = "diff"
            self.debug("ObjectStore diff, diff_cb, rows: {0}".format(combined_diff))
            result_d.callback({"data": combined_diff, "@to_version": to_version_used, "@from_version": from_version, "@latest_version": latest_ver, "@commits": commits})

        def ids_cb(to_version_used, combined_diff, latest_ver, commits):
            # handles return_objs = "ids"
            self.debug("ObjectStore diff, ids_cb, rows: {0}".format(combined_diff))
            result_d.callback({"data": self.diff_to_ids(combined_diff), "@to_version": to_version_used, "@from_version": from_version, "@latest_version": latest_ver, "@commits": commits})

        def got_versions(to_version_used, latest_ver):
            self.debug("ObjectStore diff, got_versions, to_version_used: {0}, latest_ver".format(to_version_used, latest_ver))

            def commits_cb(commits):

                # first callback once we have the to_version
                if return_objs == "diff":
                    self._get_diff_combined(from_version, to_version_used).addCallbacks(lambda combined_diff: diff_cb(to_version_used, combined_diff, latest_ver, commits), err_cb)
                elif return_objs == "objects": 
                    # TODO implement
                    result_d.callback(None)
                elif return_objs == "ids":
                    self._get_diff_combined(from_version, to_version_used).addCallbacks(lambda combined_diff: ids_cb(to_version_used, combined_diff, latest_ver, commits), err_cb)
                else:
                    result_d.errback(Failure(Exception("Did not specify valid value of return_objs.")))
            
            self.get_commits_in_versions(range(from_version + 1, to_version_used + 1)).addCallbacks(commits_cb, result_d.errback)


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

    def delete(self, id_list, specified_prev_version):
        """ Create a new version of the database, excluding those objects in the id list.

            id_list -- list of object IDs to exclude from the new version
            specified_prev_version -- the current version of the box, error returned if this isn't the current version

            returns information about the new version
        """
        self.debug("Objectstore delete") 
        # delegate the whole operation to update
        return self.update([], specified_prev_version, delete_ids=id_list)

    def _vers_without_commits(self, from_version, to_version, commits):
        """ Return the versions, in the range given, that do not contain any of the commits listen. """
        result_d = Deferred()

        query = "SELECT version, commits FROM wb_versions WHERE version >= %s AND version <= %s"
        params = [from_version, to_version]

        def conn_cb(conn):

            def vers_cb(rows):

                # TODO optimise this by doing it in postgresql
                versions_to_get = []
                for row in rows:
                    version, version_commits = row

                    all_in = True
                    for version_commit in version_commits:
                        if version_commit not in commits:
                            all_in = False
                            break

                    if not all_in:
                        versions_to_get.append(version)

                result_d.callback(versions_to_get)

            conn.runQuery(query, params).addCallbacks(vers_cb, result_d.errback)

        self.conns['conn']().addCallbacks(conn_cb, result_d.errback)

        return result_d


    def store_commits(self, commits, cur = None):
        """ Store commits in the commits table unless they are already there. """
        result_d = Deferred()

        the_commits = copy.copy(commits)

        logging.debug("ObjectStore store_commits: {0}".format(the_commits))

        def connected(conn):

            def loop(empty):
                if len(the_commits) < 1:
                    result_d.callback(True)
                    return

                commit_id, commit = the_commits.popitem()
                query = "SELECT commit_hash FROM ix_commits WHERE commit_hash = %s"
           
                def checked_cb(rows):
                    #if cur is not None:
                    #    rows = cur.fetchall()

                    if len(rows) > 0:
                        return loop(None)

                    ins_query = "INSERT INTO ix_commits (commit_hash, date, server_id, original_version, commit_log) VALUES (%s, %s, %s, %s, %s)"
                    ins_params = [commit['commit_hash'], commit['date'], commit['server_id'], commit['original_version'], commit['commit_log']]

                    if cur is None:
                        conn.runOperation(ins_query, ins_params).addCallbacks(loop, result_d.errback)
                    else:
                        cur.execute(ins_query, ins_params).addCallbacks(loop, result_d.errback) 
                    
                if cur is None:
                    conn.runQuery(query, [commit['commit_hash']]).addCallbacks(lambda rows: checked_cb(rows), result_d.errback)
                else:
                    cur.execute(query, [commit['commit_hash']]).addCallbacks(lambda cur: checked_cb(cur.fetchall()), result_d.errback)

            loop(None)


        if cur is None:
            self.conns['conn']().addCallbacks(connected, result_d.errback)
        else:
            connected(None)

        return result_d


    def get_commits_in_versions(self, versions, cur=None):
        result_d = Deferred()
        self.debug("Objectstore get_commits_in_version, cur: {0}".format(cur))

        query = "SELECT version, commits FROM wb_versions WHERE version = ANY(%s)"
        params = [versions]

        def ver_cb(rows):
            all_commits = []
            for row in rows:
                version, commits = row
                all_commits.extend(commits)

            query2 = "SELECT commit_hash, date, server_id, original_version, commit_log FROM ix_commits WHERE commit_hash = ANY(%s)"
            params2 = [all_commits]

            def commits_cb(rows):
                commit_data = {}
                for row in rows:
                    commit_hash, date, server_id, original_version, commit_log = row
                    commit_data[commit_hash] = {"commit_hash": commit_hash, "date": date, "server_id": server_id, "original_version": original_version, "commit_log": commit_log}

                result_d.callback(commit_data)


            if cur is None:
                def conn_cb(conn):
                    logging.debug("Objectstore get_commits_in_versions, ver_cb")
                    conn.runQuery(query2, params2).addCallbacks(commits_cb, result_d.errback)
                
                self.conns['conn']().addCallbacks(conn_cb, result_d.errback)
            else:

                def exec_cb2(cur):
                    self.debug("Objectstore get_commits_in_versions exec_cb2, cur: {0}".format(cur))
                    rows = cur.fetchall()
                    commits_cb(rows)

                self._curexec(cur, query2, params2).addCallbacks(exec_cb2, result_d.errback)


        if cur is None:
            def conn_cb(conn):
                logging.debug("Objectstore get_commits_in_versions, conn_cb")
                conn.runQuery(query, params).addCallbacks(ver_cb, result_d.errback)
            
            self.conns['conn']().addCallbacks(conn_cb, result_d.errback)
        else:

            def exec_cb(cur):
                self.debug("Objectstore get_commits_in_versions exec_cb, cur: {0}".format(cur))
                rows = cur.fetchall()
                ver_cb(rows)

            self._curexec(cur, query, params).addCallbacks(exec_cb, result_d.errback)

        return result_d



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
            def conn_cb(conn):
                logging.debug("Objectstore _get_latest_ver, conn_cb")
                conn.runQuery("SELECT latest_version FROM wb_v_latest_version", []).addCallbacks(ver_cb, err_cb)
            
            self.conns['conn']().addCallbacks(conn_cb, result_d.errback)
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


    def _curexec(self, cur, *args, **kwargs):
        """ Execute a query on a Cursor, and log what we're going. """
        self.debug("Objectstore _curexec, args: {0}, kwargs: {1}".format(args, kwargs))
        return cur.execute(*args, **kwargs)


    def update(self, objs, specified_prev_version, delete_ids=[], new_files_oids=[], delete_files_ids=[], propagate = True):
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

            def ver_cb(latest_ver):
                self.debug("Objectstore update, ver_cb, latest_ver: {0}".format(latest_ver))

                def do_update(new_ver):
                    self.debug("Objectstore update, do_update, new_ver: {0}".format(new_ver))

                    def check_err_cb(failure):
                        self.debug("Objectstore check_err_cb, failure: {0}".format(failure))
                        interaction_d.errback(failure)

                    def compare_cb(val):
                        self.debug("Objectstore update, compare_cb, val: {0}".format(val))

                        # do adding files etc here

                        def files_added_cb(info):
                            self.debug("Objectstore update, files_added_cb info: {0}".format(info))
                            self._notify(cur, new_ver, propagate = propagate).addCallbacks(lambda _: interaction_d.callback({"@version": new_ver}), check_err_cb)

                        self._add_files_to_version(cur, new_files_oids, new_ver).addCallbacks(files_added_cb, check_err_cb)


                    def objs_cb(objs_full):
                        self.debug("Objectstore update, objs_cb, val: {0}".format(objs_full))
                        objs_full = objs_full['data']
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

                        def conn_cb(conn):
                            logging.debug("Objectstore update, conn_cb")
                            set_diff = ObjectSetDiff(conn, objs_full, objs, new_ver)
                            set_diff.compare(cur).addCallbacks(compare_cb, check_err_cb) # changes the DB for us
                        
                        self.conns['conn']().addCallbacks(conn_cb, result_d.errback)


                    # add full objects from db to objs_orig if their id is in objs         
                    objs_ids = self.ids_from_objs(objs)
                    self.get_latest_objs(objs_ids, cur).addCallbacks(objs_cb, check_err_cb)

                def prev_ver_exception():
                    # version did not match current / previous version, so throw errback
                    self.debug("Objectstore update, prev_ver_exception")
                    self.debug("In objectstore update, the previous version of the box {0} didn't match the actual {1}".format(specified_prev_version, latest_ver))
                    ipve = IncorrectPreviousVersionException("Actual previous version is {0}, specified previous version is: {1}".format(latest_ver, specified_prev_version))
                    ipve.version = latest_ver
                    interaction_d.errback(Failure(ipve))
                    return
                # emax foobarred this >
                # if latest_ver - 1 == specified_prev_version: # crashing cos latest_ver was None
                if latest_ver is not None and latest_ver - 1 == specified_prev_version:
                    self.debug("Objectstore update, latest_ver - 1 == specified_prev_version")
                    # this update is a batch update to the previous version
                    # allow this if the update doesn't include object IDs already modified in this version update
                    
                    id_list = self.ids_from_objs(objs)
                    
                    def in_ver_cb(cur):
                        rows = cur.fetchall()
                        if len(rows) > 0:
                            # one or more of the objects altered in this update were already altered in a diff for this version
                            return prev_ver_exception()
                        else:
                            new_ver = latest_ver # don't increment version
                            return do_update(new_ver)

                    self._curexec(cur, "SELECT DISTINCT j_subject.string FROM wb_vers_diffs JOIN wb_strings j_subject ON (wb_vers_diffs.subject_uuid = j_subject.uuid) WHERE j_subject.string = ANY(%s) LIMIT 1", [id_list]).addCallbacks(in_ver_cb, interaction_err_cb)
                    return
                # emax foobarred this >
                # elif latest_ver == specified_prev_version:
                elif (latest_ver == specified_prev_version) or (latest_ver is None and specified_prev_version == 0):
                    self.debug("Objectstore update, latest_ver == specified_prev_version")
                    # specified the current version, so the backend generates a new version

                    # emax foobarred this
                    # new_ver = latest_ver + 1 
                    new_ver = latest_ver + 1 if latest_ver is not None else 1
                    do_update(new_ver)
                    return

                return prev_ver_exception()


            def lock_cb(val):
                self.debug("Objectstore update, lock_cb, val: {0}".format(val))

                def exec_cb(cur):
                    self.debug("Objectstore update, exec_cb, cur: {0}".format(cur))
                    rows = cur.fetchall()

                    # get the latest version number
                    if len(rows) > 0:
                        latest_ver = rows[0][0]
                    else:
                        latest_ver = 0

                    ver_cb(latest_ver)

                self._curexec(cur, "SELECT latest_version FROM wb_v_latest_version").addCallbacks(exec_cb, interaction_err_cb)

            self._curexec(cur, "LOCK TABLE ix_commits, wb_files, wb_versions, wb_latest_vers, wb_triples, wb_users, wb_vers_diffs, wb_latest_subjects IN EXCLUSIVE MODE").addCallbacks(lock_cb, interaction_err_cb) # lock to other writes, but not reads
##             
            return interaction_d
 
 
        def interaction_complete_d(ver_response):
            self.debug("Interaction_complete_d: {0}".format(ver_response))
            ##self.conn.runOperation("VACUUM").addCallbacks(lambda _: result_d.callback(ver_response), err_cb)
            result_d.callback(ver_response)
 
        def iconn_cb(conn):
            logging.debug("Objectstore update, iconn_cb")
            conn.runInteraction(interaction_cb).addCallbacks(interaction_complete_d, err_cb)
        
        self.conns['conn']().addCallbacks(iconn_cb, result_d.errback)
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

        def conn_cb(conn):
            logging.debug("Objectstore list_files, conn_cb")
            conn.runQuery(query).addCallbacks(list_cb, err_cb)
        
        self.conns['conn']().addCallbacks(conn_cb, result_d.errback)
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
        self.debug("ObjectStoreAsync add_file_data, opening new lobject with connection: {0}".format(conn))
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

        def conn_cb(conn):
            logging.debug("Objectstore get_latest_file, conn_cb")
            conn.runQuery(query, [file_id]).addCallbacks(file_cb, err_cb) 
        
        self.conns['conn']().addCallbacks(conn_cb, result_d.errback)
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

    def __init__(self, indx_reactor, box, store):
        """
            box -- The name of the box.
        """
        self.indx_reactor = indx_reactor
        self.box = box
        self.store = store
        self.subscribers = {} # id -> (observer, query)
        self.indx_subscriber = self.listen()

    def runQuery(self, query):
        """ Runs the query on the existing store and returns the IDs that match it. """
        return_d = Deferred()

        def query_cb(graph):
            ids = graph.get_objectids()
            return_d.callback(ids)

        self.store.query(query, render_json=False, depth=0).addCallbacks(query_cb, return_d.errback)
        return return_d

    def unsubscribe(self, f_id):
        """ Unsubscribe this observer to this box's updates. """
        del self.subscribers[f_id]

    def subscribe(self, observer, f_id, query):
        """ Subscribe to this box's updates.

        observer -- A function to call when an update occurs. Parameter sent is re-dispatched from the database.
        """
        return_d = Deferred()
        self.subscribers[f_id] = (observer, query)
        self.runQuery(query).addCallbacks(return_d.callback, return_d.errback)
        return return_d


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

                for f_id, val in self.subscribers.items():
                    observer, query = val
                    observer(data)

            version = int(notify['version'])
            old_version = version - 1 # TODO do this a better way? (if we moved away from int versions, we would return the old and new version in the payload instead of calcualting it here.)

            self.store.diff(old_version, version, "diff").addCallbacks(diff_cb, err_cb)

        indx_subscriber = IndxSubscriber({"type": "version_update", "box": self.box}, observer)
        self.indx_reactor.add_subscriber(indx_subscriber)
        return indx_subscriber

