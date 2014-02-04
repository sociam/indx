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

            #self.table_counter += 1
            #table = "sub_{0}".format(self.table_counter)


            # single value
            if is_subquery:
                value_querypart = vals
                params_querypart = []
            else:
                value_querypart = "%s"
                params_querypart = ["{0}".format(vals)] # format is to convert to a string before querying


            if pred == "@id":
                query, params = self.create_subquery(subject = value_querypart, subject_operator = operator, inner_params = params_querypart)

#                query = "SELECT DISTINCT {0}.subject FROM wb_v_latest_triples AS {0} WHERE ({0}.subject {2} {1})".format(table, value_querypart, operator)
#                params = []
            else:
                query, params = self.create_subquery(predicate = pred, obj = value_querypart, obj_operator = operator, inner_params = params_querypart)
#                query = "SELECT DISTINCT {0}.subject FROM wb_v_latest_triples AS {0} WHERE ({0}.predicate = %s AND {0}.obj_value {2} {1})".format(table, value_querypart, operator)
#                params = [pred]

            #params.extend(params_querypart)
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
        if len(subqueries) > 0:
            return "(" + " INTERSECT ".join(subqueries) + ")", params
        else:
            return "", params # this means we can look at length of wheres in to_sql to determine if this is an empty query

    def create_subquery(self, subject = None, subject_operator = "=", predicate = None, predicate_operator = "=", obj = None, obj_operator = "=", inner_params = []):
        """ Try to create an optimal JOIN query without including / returning columns or tables we don't need here. """

        self.table_counter += 1

        params = []
        query = "SELECT j_triples_{0}.subject_uuid".format(self.table_counter)
        query += " FROM wb_latest_vers AS j_latest_{0} ".format(self.table_counter)
        query += " JOIN wb_triples j_triples_{0} ON j_triples_{0}.id_triple = j_latest_{0}.triple".format(self.table_counter)

        if predicate is not None:
            # join predicate value
            query += " JOIN wb_strings j_predicate_{0} ON j_predicate_{0}.uuid = j_triples_{0}.predicate_uuid".format(self.table_counter)

        if obj is not None:
            # join object value
            query += " JOIN wb_objects j_objects_{0} ON j_objects_{0}.id_object = j_triples_{0}.object".format(self.table_counter)
            query += " JOIN wb_strings j_object_{0} ON j_object_{0}.uuid = j_objects_{0}.obj_value_uuid".format(self.table_counter)

        wheres = []
        if subject is not None:
            query += " JOIN wb_strings j_subject_{0} ON j_subject_{0}.uuid = j_triples_{0}.subject_uuid".format(self.table_counter)
            wheres.append("j_subject_{1}.string {0} %s".format(subject_operator, self.table_counter))
            if subject != "%s":
                params.append(subject)
            else:
                params.extend(inner_params)

        if predicate is not None:
            wheres.append("j_predicate_{1}.string {0} %s".format(predicate_operator, self.table_counter))
            if predicate != "%s":
                params.append(predicate)
            else:
                params.extend(inner_params)

        if obj is not None:
            wheres.append("j_object_{1}.string {0} %s".format(obj_operator, self.table_counter))
            if obj != "%s":
                params.append(obj)
            else:
                params.extend(inner_params)

        subquery = query
        if len(wheres) > 0:
            subquery += " WHERE " + " AND ".join(wheres)
        return "(" + subquery + ")", params

        


    def to_sql(self, q, predicate_filter = None): 
        """ Convert the query 'q', return a tuple of sql query and array of parameters.
        
            q -- Query of objects to search for
            predicate_filter -- List of predicates to limit the result objects to (None means no restriction)
        """
        logging.debug("ObjectStoreQuery to_sql, q: {0}, predicate_filter: {1}".format(q, predicate_filter))

        # look through the constraints of the query
        query, params = self.process_predicates(q)

        # filter the predicates returned by the query
        where = ""
        if predicate_filter is not None:
            where = " WHERE j_predicate.string = ANY(%s)"
            params.extend([predicate_filter])

        sql = """WITH theselect AS ({0}) SELECT wb_latest_vers.triple_order, j_subject.string AS subject, 
            j_predicate.string AS predicate, j_object.string AS obj_value, 
            wb_objects.obj_type, wb_objects.obj_lang, wb_objects.obj_datatype, 
            j_subject.uuid AS subject_uuid
           FROM wb_latest_vers
           JOIN wb_triples ON wb_triples.id_triple = wb_latest_vers.triple
           JOIN wb_objects ON wb_objects.id_object = wb_triples.object
           JOIN wb_strings j_subject ON j_subject.uuid = wb_triples.subject_uuid
           JOIN wb_strings j_predicate ON j_predicate.uuid = wb_triples.predicate_uuid
           JOIN wb_strings j_object ON j_object.uuid = wb_objects.obj_value_uuid
            JOIN theselect ON theselect.subject_uuid = j_subject.uuid
            {1}
          ORDER BY wb_latest_vers.triple_order, j_object.uuid, j_object.chunk;
        """.format(query, where)

        logging.debug("ObjectStoreQuery to_sql, sql: {0}, params: {1}".format(sql, params))

        return (sql, params)

class InvalidObjectQueryException(Exception):
    pass

