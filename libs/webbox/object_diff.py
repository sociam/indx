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
from twisted.internet.defer import Deferred
from twisted.python.failure import Failure
import logging

class ObjectSetDiff:
    """ Determine the differences between two sets of objects, identified by
        an "@id" predicate (required). Gives a list of SQL INSERT diffs for
        each object as well as the objects that have been added and removed.
    """

    def __init__(self, conn, objs1, objs2):
        """ Compare two objects in an INDX database. """
        self.conn = conn
        self.objs1 = objs1
        self.objs2 = objs2

    def reset_queries(self):
        self.queries = {
            "diff": {
                "values": [],
                "params": [],
                "query_prefix": "INSERT INTO wb_diff_vers (version, diff_type, subject, predicate, object, object_order) VALUES "
            }
        }

    def run_queries(self):
        pass

    def compare(self):
        """ Compare the two sets of objects, prepare SQL queries to INSERT the diff into the database. """
        result_d = Deferred()
        self.reset_queries()

        if self.objs1 is None or self.objs2 is None:
            raise Exception("ObjectSet is None, cannot compare.")

        ids = {}

        # add IDs of object from the first set to the ids dict,
        #  then remove them as they are processed in objectset2,
        #  then process the remaining ones that must be not present in objectset2
        for obj in self.objs1:
            obj_id = obj["@id"]
            ids[obj_id] = obj

        for obj in self.objs2:
            obj_id = obj["@id"]
            if obj_id not in ids:
                # NEW SUBJECT
                self.add_diff_query("add_subject", obj_id)
                for predicate, sub_objs in obj.items():
                    if predicate[0] is "@":
                        continue

                    if sub_objs is None or len(sub_objs) < 1:
                        self.add_diff_query("add_predicate", obj_id, predicate = predicate)
                    else:   
                        for sub_obj in sub_objs:
                            self.add_diff_query("add_triple", obj_id, predicate = predicate, sub_obj = sub_obj)

                    # TODO XXX do latest_vers query
            else:
                # SUBJECT IN BOTH - DIFF THEM
                
                # DIFF and do diff queries
                

                # TODO XXX do latest_vers_query
            
            del ids[obj_id] # remove this object from ids

        # check for removed subjects, e.g. ids still in ids 
        for obj_id, obj in ids.items():
            # SUBJECT REMOVED
            self.add_diff_query("remove_subject", obj_id)

            # TODO XXX do latest_vers query

        def err_cb(failure):
            logging.error("ObjectSetDiff compare, err_cb, failure: {0}".format(failure))
            result_d.errback(failure)
            return

        self.run_queries().addCallbacks(lambda result: result_d.callback(result), err_cb)
        return result_d

    def add_diff_query(self, diff_type, subject, predicate = None, sub_obj = None, object_order = None):
        """ Make the queries used to INSERT into the wb_vers_diffs table. """

        if sub_obj is not None:
            obj_type, obj_value, obj_lang, obj_datatype = self.obj_to_obj_tuple(sub_obj)
            self.queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), wb_get_object_id(%s, %s, %s, %s), %s)")
            self.queries['diff']['params'].append(self.version, diff_type, subject, predicate, obj_type, obj_value, obj_lang, obj_datatype, object_order)
        else:
            self.queries['diff']['values'].append("(%s, %s, wb_get_string_id(%s), wb_get_string_id(%s), NULL, NULL)")
            self.queries['diff']['params'].append(self.version, diff_type, subject, predicate)
        return
        
    def make_latest_query(...
        """ Make the queries used to INSERT/DELETE from the wb_latest_vers table. """
        pass


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

