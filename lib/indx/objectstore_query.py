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
import types

class ObjectStoreQuery:
    """ Handles JSON queries to an objectstore. """

    exact_types = [types.IntType, types.LongType, types.BooleanType, types.FloatType, types.StringType, types.UnicodeType]
    operator_map = {
        "$gt": ">",
        "$lt": "<",
        "$ge": ">=",
        "$le": "<="
    }
    logical_map = {
        "$or": "UNION",
        "$and": "INTERSECT",
    }

    def __init__(self):
        logging.debug("ObjectStoreQuery __init__")

        self.table_counter = 0

# SELECT DISTINCT wb_v_latest_triples.triple_order, wb_v_latest_triples.subject, wb_v_latest_triples.predicate, wb_v_latest_triples.obj_value, wb_v_latest_triples.obj_type, wb_v_latest_triples.obj_lang, wb_v_latest_triples.obj_datatype
# 
# FROM wb_v_latest_triples
# 
# WHERE wb_v_latest_triples.subject IN
#     (
#       SELECT DISTINCT subj_2.subject FROM wb_v_latest_triples AS subj_2
#          WHERE (subj_2.predicate = 'boxes'
# 	        AND subj_2.obj_value = ALL
# 	            (SELECT DISTINCT subj_1.subject FROM wb_v_latest_triples AS subj_1
#                         WHERE (subj_1.predicate = 'box' AND subj_1.obj_value = 'box1')
#                      INTERSECT
#                      SELECT DISTINCT subj_1.subject FROM wb_v_latest_triples AS subj_1
#                         WHERE (subj_1.predicate = 'box' AND subj_1.obj_value = 'box2')
#                     )
#                )
#     INTERSECT SELECT DISTINCT subj_2.subject FROM wb_v_latest_triples AS subj_2
#          WHERE (subj_2.predicate = 'boxes'
# 	        AND subj_2.obj_value = ALL
# 	            (SELECT DISTINCT subj_1.subject FROM wb_v_latest_triples AS subj_1
#                         WHERE (subj_1.predicate = 'box' AND subj_1.obj_value = 'box2')
#                         -- UNION / INTERSECT
#                     )
#                )  
#     )
# 

    def process_predicates(self, q):
        """ Process a query and return the query fragment (without surrounding SELECT / FROM etc) about the predicates.
            This function is recursable.
        """
        logging.debug("ObjectStoreQuery process_predicates: {0}".format(q))

        subqueries = []
        params = []

        def gen_subquery(pred, vals, is_subquery = False, operator = "="):

            self.table_counter += 1
            table = "sub_{0}".format(self.table_counter)


            # single value
            if is_subquery:
                value_querypart = vals
                params_querypart = []
            else:
                value_querypart = "%s"
                params_querypart = ["{0}".format(vals)] # format is to convert to a string before querying


            if pred == "@id":
                query = "SELECT DISTINCT {0}.subject FROM wb_v_latest_triples AS {0} WHERE ({0}.subject {2} {1})".format(table, value_querypart, operator)
                params = []
            else:
                query = "SELECT DISTINCT {0}.subject FROM wb_v_latest_triples AS {0} WHERE ({0}.predicate = %s AND {0}.obj_value {2} {1})".format(table, value_querypart, operator)
                params = [pred]

            params.extend(params_querypart)
            return query, params


        for predicate, val in q.items():

            if predicate in self.logical_map:
                # when the predicate matches a logical operator
                # e.g. {"$or": [ {"type": "foobar"}, {"type": "baz"} ] }
                # process each of the values in the value list and join with the logical operator
                logical_oper = " {0} ".format(self.logical_map[predicate])

                new_subqueries = []
                for sub_item in val:
                    new_subquery, new_params = self.process_predicates(sub_item)
                    new_subqueries.append(new_subquery)
                    params.extend(new_params)

                # joins the subqueries using UNION or INTERSECT (logical_oper)
                subqueries.append(logical_oper.join(new_subqueries))

            elif type(val) in self.exact_types:
                # exact match, e.g. a string, int, boolean, etc.
                new_subquery, new_params = gen_subquery(predicate, val)
                subqueries.append(new_subquery)
                params.extend(new_params)

            elif type(val) == type({}):
                # when the value is a dict, then we check to see what it means
                # looks like this:
                # 
                # {"number": {"$ge": 5} }   - means number >= 5

                acted = False # track to see if we did anything, raise an exception if we didnt

                # looks for an operator in the map, ignores keys we don't know
                for operator, sub_val in self.operator_map.items():
                    if operator in val:
                        sql_operator = self.operator_map[operator]

                        value = val[operator]

                        new_subquery, new_params = gen_subquery(predicate, value, operator = sql_operator)
                        subqueries.append(new_subquery)
                        params.extend(new_params)

                        acted = True
                        break

                # if there was an operator, then we use it, otherwise we do submatches on them as keys
                if not acted:

                    new_subquery, new_params = self.process_predicates(val)
                    new_subquery2, new_params2 = gen_subquery(predicate, "ALL({0})".format(new_subquery), is_subquery = True)

                    subqueries.append(new_subquery2)
                    params.extend(new_params2) # inner query params come after
                    params.extend(new_params)

            else:
                raise InvalidObjectQueryException("Invalid type of val: {0}".format(val))

        # INTERSET means that the default is AND if no $or or $and is specified.
        return " INTERSECT ".join(subqueries), params


    def to_sql(self, q, predicate_filter = None): 
        """ Convert the query 'q', return a tuple of sql query and array of parameters.
        
            q -- Query of objects to search for
            predicate_filter -- List of predicates to limit the result objects to (None means no restriction)
        """
        logging.debug("ObjectStoreQuery to_sql, q: {0}, predicate_filter: {1}".format(q, predicate_filter))

        # look through the constraints of the query
        wheres, params = self.process_predicates(q)

        # filter the predicates returned by the query
        if predicate_filter is not None:
            wheres = "{0} AND wb_v_latest_triples.predicate = ANY(%s)".format(wheres)
            params.extend([predicate_filter])

        # same order as table
        selects = [
            "wb_v_latest_triples.triple_order",
            "wb_v_latest_triples.subject",
            "wb_v_latest_triples.predicate",
            "wb_v_latest_triples.obj_value",
            "wb_v_latest_triples.obj_type",
            "wb_v_latest_triples.obj_lang",
            "wb_v_latest_triples.obj_datatype"
        ]

        sql = "SELECT DISTINCT {0} FROM wb_v_latest_triples ".format(", ".join(selects))
        if len(wheres) > 0:
            sql += " WHERE wb_v_latest_triples.subject IN ({0})".format(wheres)

        logging.debug("ObjectStoreQuery to_sql, sql: {0}, params: {1}".format(sql, params))

        return (sql, params)

class InvalidObjectQueryException(Exception):
    pass

