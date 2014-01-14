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
from twisted.internet.defer import Deferred
import logging
import collections
import pprint

class ObjectSetDiff:
    """ Determine the differences between two sets of objects, identified by
        an "@id" predicate (required). Gives a list of SQL INSERT diffs for
        each object as well as the objects that have been added and removed.
    """

    MAX_PARAMS_PER_QUERY = 10000 # split queries up into separate queries if there are more parameters than this

    def __init__(self, conn, objs1, objs2, version):
        """ Compare two objects in an INDX database. """
        logging.debug("ObjectSetDiff conn: {0}, objs1: {1}, objs2: {2}, version: {3}".format(conn, objs1, objs2, version))
        self.conn = conn
        self.objs1 = objs1
        self.objs2 = objs2
        self.version = version

    def reset_queries(self):
        self.queries = {
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
            "latest_diffs": {
                "add_predicate": [],
                "remove_predicate": [],
                "add_subject": [],
                "add_triple": [],
                "remove_subject": [],
                "replace_objects": [],
            },
        }


    def gen_queries(self, keys, cur, max_params = None):
        """ Check if the number of parameters in the queries is above the MAX_PARAMS_PER_QUERY, and if so, render that query and reset it. """
        result_d = Deferred()

        if max_params is None:
            max_params = self.MAX_PARAMS_PER_QUERY

        def run_next(empty):

            if len(keys) < 1:
                result_d.callback(True)
            else:
                quer = keys.pop(0)

                # max_params == 0 override is required because if quer is 'latest' and has no params, 'prelatest' might still have queries
                if len(self.queries[quer]['params']) > max_params or max_params == 0:

                    logging.debug("ObjectSetDiff gen_queries, queries for {0}, queries are: {1}".format(quer, self.queries['prelatest']['queries']))

                    querylist = []
                
                    # do prelatest before latest, only when latest has hit max_params
                    if quer == 'latest':
                        querylist.extend(self.queries['prelatest']['queries'])
                        self.queries['prelatest']['queries'] = [] # empty the list of queries

                    if len(self.queries[quer]['values']) > 0:
                        query = self.queries[quer]['query_prefix'] + ", ".join(self.queries[quer]['values'])
                        params = self.queries[quer]['params']

                        querylist.append( (query, params) ) # querylist is tuples of (query, params)

                        self.queries[quer]['values'] = []
                        self.queries[quer]['params'] = []

                    def run_querylist(empty):

                        if len(querylist) < 1:
                            run_next(None)
                        else:
                            qp_pair = querylist.pop(0)
                            query, params = qp_pair

                            logging.debug("ObjectSetDiff gen_queries, run_querylist running: query: {0}, params: {1}".format(query,params))
                            cur.execute(query, params).addCallbacks(run_querylist, result_d.errback)

                    run_querylist(None)
                else:
                    run_next(None)

        run_next(None)

        return result_d

    def run_queries(self, cur):
        """ Run all of the queries. """
        result_d = Deferred()


        def diff_cb(results):

            def applied_cb(results):

                def latest_cb(results):
                    result_d.callback(True)

                self.gen_queries(['latest', 'subjects'], cur, max_params = 0).addCallbacks(latest_cb, result_d.errback)

            self.apply_diffs_to_latest(cur).addCallbacks(applied_cb, result_d.errback)

        self.gen_queries(['diff'], cur, max_params = 0).addCallbacks(diff_cb, result_d.errback)

#        queries = collections.deque(self.gen_queries(['diff'], max_params = 0))
#        queries.extend(self.apply_diffs_to_latest())
#        queries.extend(self.gen_queries(['latest','subjects'], max_params = 0))
#
#        if len(queries) > 0:
#            logging.debug("ObjectSetDiff run_queries, queries: {0}".format(pprint.pformat(queries[0])))
#        else:
#            logging.debug("ObjectSetDiff run_queries, queries: [empty]")
#
#
#        def exec_queries():
#            logging.debug("ObjectSetDiff exec_queries, len(queries): {0}".format(len(queries)))
#            if len(queries) < 1:
#                logging.debug("ObjectSetDiff exec_queries callback sent")
#                result_d.callback(None)
#                return
#
#            def ran_cb(result):
#                # TODO check value
#                logging.debug("ObjectSetDiff run_queries, ran_cb, result: {0}".format(ran_cb))
#                exec_queries()
#
#            def err_cb(failure):
#                result_d.errback(failure)
#
#            query, params = queries.popleft()
#            logging.debug("ObjectSetDiff run_queries, query: {0}, params: {1}".format(query,params))
#            cur.execute(query, params).addCallbacks(ran_cb, err_cb)
#
#        exec_queries()

        return result_d

    def compare(self, cur):
        """ Compare the two sets of objects, prepare SQL queries to INSERT the diff into the database. """
        result_d = Deferred()

        self.reset_queries()

        if self.objs1 is None or self.objs2 is None:
            raise Exception("ObjectSet is None, cannot compare.")

        ids = {}
        logging.debug("ObjectSetDiff compare, objs1: {0}, objs2: {1}".format(self.objs1, self.objs2))

        # add IDs of object from the first set to the ids dict,
        #  then remove them as they are processed in objectset2,
        #  then process the remaining ones that must be not present in objectset2
        for obj in self.objs1:
            obj_id = obj["@id"]
            ids[obj_id] = obj

        
        def next_obj2(empty):

            if len(self.objs2) < 1:

                # check for removed subjects, e.g. ids still in ids 
                for obj_id, obj in ids.items():
                    # SUBJECT REMOVED
                    self.add_diff_query(cur, "remove_subject", obj_id)

                self.run_queries(cur).addCallbacks(result_d.callback, result_d.errback)
                return

            obj = self.objs2.pop(0)

            obj_id = obj["@id"]
            if obj_id not in ids:
                # NEW SUBJECT
                self.add_diff_query(cur, "add_subject", obj_id)
                for predicate, sub_objs in obj.items():
                    if len(predicate) > 0 and predicate[0] == "@":
                        continue

                    if sub_objs is None or len(sub_objs) < 1:
                        self.add_diff_query(cur, "add_predicate", obj_id, predicate = predicate)
                    else:
                        order = 1
                        for sub_obj in sub_objs:
                            self.add_diff_query(cur, "add_triple", obj_id, predicate = predicate, sub_obj = sub_obj, object_order = order)
                            order += 1

            else:
                # SUBJECT IN BOTH - DIFF THEM
                
                prev_obj = ids[obj_id]

                all_predicates = set(obj.keys() + prev_obj.keys())
                
                for predicate in all_predicates:
                    if len(predicate) > 0 and predicate[0] == "@":
                        continue


                    if predicate not in obj.keys():
                        # predicate removed
                        self.add_diff_query(cur, "remove_predicate", obj_id, predicate = predicate)
                    elif predicate not in prev_obj.keys():
                        # predicate added
                        sub_objs = obj[predicate]

                        if sub_objs is None or len(sub_objs) < 1:
                            self.add_diff_query(cur, "add_predicate", obj_id, predicate = predicate)
                        else:
                            order = 1
                            for sub_obj in sub_objs:
                                self.add_diff_query(cur, "add_triple", obj_id, predicate = predicate, sub_obj = sub_obj, object_order = order)
                                order += 1

                    else:
                        # predicate in both, diff values
                        prev_sub_objs = prev_obj[predicate]
                        sub_objs = obj[predicate]
                        
                        if prev_sub_objs == sub_objs:
                            # the same, do nothing here
                            pass
                        else:
                            # not the same, remove the previous, add the new
                            if sub_objs is None or len(sub_objs) < 1:
                                self.add_diff_query(cur, "replace_objects", obj_id, predicate = predicate, sub_obj = None)
                            else:
                                order = 1
                                for sub_obj in sub_objs:
                                    self.add_diff_query(cur, "replace_objects", obj_id, predicate = predicate, sub_obj = sub_obj, object_order = order)
                                    order += 1

                del ids[obj_id] # remove this object from ids

            self.gen_queries(['diff'], cur).addCallbacks(next_obj2, result_d.errback) # render queries periodically

        next_obj2(None)

        return result_d

    def add_diff_query(self, cur, diff_type, subject, predicate = None, sub_obj = None, object_order = None):
        """ Make the queries used to INSERT into the wb_vers_diffs table. """

        if sub_obj is not None:
            obj_type, obj_value, obj_lang, obj_datatype = self.obj_to_obj_tuple(sub_obj)
            self.queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), wb_get_object_id(%s, %s, %s, %s), %s)")
            self.queries['diff']['params'].extend([self.version, diff_type, subject, predicate, obj_type, obj_value, obj_lang, obj_datatype, object_order])
        else:
            self.queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), NULL, NULL)")
            self.queries['diff']['params'].extend([self.version, diff_type, subject, predicate])

        # apply the diff to the latest table
        self.queries['latest_diffs'][diff_type].append((subject, predicate, sub_obj, object_order))
        return


#         params = []
#         query_arr = []
#         for subj in self.queries['subjects']:
#             params.append(subj)
#             query_arr.append("%s")
#         query_array = "ARRAY[{0}]".format(",".join(query_arr))
#         query = "SELECT * FROM wb_multi_subject_add({0})".format(query_array)
# 
#         return (query, params)

    def apply_diffs_to_latest(self, cur):
        """ Make the queries used to INSERT/DELETE from the wb_latest_vers table. """
        
        for row in self.queries['latest_diffs']['remove_subject']:
            subject, predicate, sub_obj, object_order = row
            self.queries['prelatest']['queries'].append(("DELETE FROM wb_latest_vers USING wb_triples, wb_strings AS subjects WHERE subjects.id_string = wb_triples.subject AND wb_latest_vers.triple = wb_triples.id_triple AND subjects.string = %s", [subject])) # XXX TODO test

        for row in self.queries['latest_diffs']['remove_predicate']:
            subject, predicate, sub_obj, object_order = row
            self.queries['prelatest']['queries'].append(("DELETE FROM wb_latest_vers USING wb_triples, wb_strings AS predicates, wb_strings AS subjects WHERE wb_latest_vers.triple = wb_triples.id_triple AND predicates.id_string = wb_triples.predicate AND subjects.id_string = wb_triples.subject AND subjects.string = %s AND predicates.string = %s", [subject, predicate])) # XXX TODO test ## same as below
        
        for row in self.queries['latest_diffs']['replace_objects']:
            subject, predicate, sub_obj, object_order = row
            # remove existing first
            self.queries['prelatest']['queries'].append(("DELETE FROM wb_latest_vers USING wb_triples, wb_strings AS predicates, wb_strings AS subjects WHERE wb_latest_vers.triple = wb_triples.id_triple AND predicates.id_string = wb_triples.predicate AND subjects.id_string = wb_triples.subject AND subjects.string = %s AND predicates.string = %s", [subject, predicate])) # XXX TODO test ## same as above, remove everything with subject AND predicate



        order = 0
        # this is two loops because we don't want to remove the new objects (this can be optimised if required/in future)
        for row in self.queries['latest_diffs']['replace_objects']:
            subject, predicate, sub_obj, object_order = row

            if sub_obj is not None:
                thetype, value, language, datatype = self.obj_to_obj_tuple(sub_obj)
            else:
                thetype, value, language, datatype = None, None, None, None

            # then add new
#            queries.append(("SELECT * FROM wb_add_triple_to_latest(%s, %s, %s, %s, %s, %s)", [subject, predicate, value, thetype, language, datatype]))
            order += 1
            self.queries['latest']['values'].append("(wb_get_triple_id(%s, %s, %s, %s, %s, %s), %s)")
            self.queries['latest']['params'].extend([subject, predicate, value, thetype, language, datatype, order])

        for row in self.queries['latest_diffs']['add_subject']:
            subject, predicate, sub_obj, object_order = row
#            queries.append(("SELECT * FROM wb_add_triple_to_latest(%s, %s, %s, %s, %s, %s)", [subject, None, None, None, None, None]))
#            order += 1

            # FIXME XXX just do an insert check into wb_latest_subjects
##            self.queries['latest']['values'].append("(wb_get_triple_id(%s, NULL, NULL, NULL, NULL, NULL), %s)")
##            self.queries['latest']['params'].extend([subject, order])
#            queries.append(("INSERT INTO wb_latest_subjects (id_subject) SELECT wb_get_string_id(%s) WHERE NOT EXISTS (SELECT id_subject FROM wb_latest_subjects WHERE id_subject = wb_get_string_id(%s))", [subject, subject]))
            #self.queries['subjects'].append(subject)
            for subj in self.queries['subjects']['params']:
                if subj[0] != subject:
                    self.queries['subjects']['values'].append("(wb_get_string_id(%s))")
                    self.queries['subjects']['params'].extend([subject])

        for row in self.queries['latest_diffs']['add_predicate']:
            subject, predicate, sub_obj, object_order = row
#            queries.append(("SELECT * FROM wb_add_triple_to_latest(%s, %s, %s, %s, %s, %s)", [subject, predicate, None, None, None, None]))
            order += 1
            self.queries['latest']['values'].append("(wb_get_triple_id(%s, %s, NULL, NULL, NULL, NULL), %s)")
            self.queries['latest']['params'].extend([subject, predicate, order])

        for row in self.queries['latest_diffs']['add_triple']:
            subject, predicate, sub_obj, object_order = row

            order += 1
            if sub_obj is not None:
                thetype, value, language, datatype = self.obj_to_obj_tuple(sub_obj)
                self.queries['latest']['values'].append("(wb_get_triple_id(%s, %s, %s, %s, %s, %s), %s)")
                self.queries['latest']['params'].extend([subject, predicate, value, thetype, language, datatype, order])
            else:
                thetype, value, language, datatype = None, None, None, None
                self.queries['latest']['values'].append("(wb_get_triple_id(%s, %s, NULL, NULL, NULL, NULL), %s)")
                self.queries['latest']['params'].extend([subject, predicate, order])

            #queries.append(("SELECT * FROM wb_add_triple_to_latest(%s, %s, %s, %s, %s, %s)", [subject, predicate, value, thetype, language, datatype]))

        # returns the deferred
        return self.gen_queries(['latest','subjects'], cur) # render queries periodically
#        return queries


    def obj_to_obj_tuple(self, sub_obj):
        """ Return a tuple of (type, value, language, datatype) used in SQL queries. """
        if type(sub_obj) != type({}):
            if type(sub_obj) != type(u"") and type(sub_obj) != type(""):
                sub_obj = unicode(sub_obj)
            sub_obj = {"@value": sub_obj} # turn single value into a literal

        if "@value" in sub_obj:
            thetype = "literal"
            value = sub_obj["@value"]
            if type(value) != type(u"") and type(value) != type(""):
                value = unicode(value)
        elif "@id" in sub_obj:
            thetype = "resource"
            value = sub_obj["@id"]

        language = ''
        if "@language" in sub_obj:
            language = sub_obj["@language"]

        datatype = ''
        if "@type" in sub_obj:
            datatype = sub_obj["@type"]

        return (thetype, value, language, datatype)


#    def get_string_ids(self, strings):
#        """ Get the DB id of a string. """
#        logging.debug("ObjectSetDiff get_string_ids, strings: {0}".format(string))
#        result_d = Deferred()
#
#        def results(rows):
#            logging.debug("ObjectSetDiff get_string_ids, result, rows: {0}".format(rows))
#            try:
#                result_d.callback(rows[0])
#            except Exception as e:
#                logging.error("ObjectSetDiff get_string_ids, result, exception: {0}".format(e))
#                result_d.errback(Failure(e))
#
#        def err_cb(failure):
#            logging.error("ObjectSetDiff get_string_ids, err_cb, failure: {0}".format(failure))
#            result_d.errback(failure)
#            return
#
#        self.conn.runQuery("SELECT " + ("wb_get_string_id(%s), " * len(strings))[:-2], strings).addCallbacks(results, err_cb)
#        return result_d
#
#    def get_object_id(self, obj_type, obj_value, obj_lang, obj_datatype):
#        """ Get the DB id of an object. """
#        logging.debug("ObjectSetDiff get_string_id, obj_type: {0}, obj_value: {1}, obj_lang: {2}, obj_datatype: {3}".format(
#            obj_type, obj_value, obj_lang, obj_datatype))
#        result_d = Deferred()
#
#        def results(rows):
#            logging.debug("ObjectSetDiff get_object_id, result, rows: {0}".format(rows))
#            try:
#                result_d.callback(rows[0][0])
#            except Exception as e:
#                logging.error("ObjectSetDiff get_object_id, result, exception: {0}".format(e))
#                result_d.errback(Failure(e))
#
#        def err_cb(failure):
#            logging.error("ObjectSetDiff get_object_id, err_cb, failure: {0}".format(failure))
#            result_d.errback(failure)
#            return
#
#        self.conn.runQuery("SELECT wb_get_object_id(%s,%s,%s,%s)", [obj_type, obj_value, obj_lang, obj_datatype]).addCallbacks(results, err_cb)
#        return result_d

