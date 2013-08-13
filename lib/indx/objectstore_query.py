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

import types

class ObjectStoreQuery:
    """ Handles JSON queries to an objectstore. """

    exact_types = [types.IntType, types.LongType, types.BooleanType, types.FloatType, types.StringType, types.UnicodeType]
    operator_map = {
        "gt": ">",
        "lt": "<",
        "ge": ">=",
        "le": "<="
    }

    def __init__(self):
        # sql params
        self.params = []

        # to make up the query
        self.joins = []
        self.wheres = []

        self.join_counter = 0

    def do_join(self, predicate, val, operator = "="):
        """ Add a join to the query, with a WHERE constraint based on the 'operator' specified. """

        self.join_counter += 1
        join_name = "j_{0}".format(self.join_counter)

        join_table1 = "wb_v_latest_triples.subject"
        join_table2 = "{0}.subject".format(join_name)

        join = "JOIN wb_v_latest_triples AS {0} ON ({1} = {2}) ".format(join_name, join_table1, join_table2)
        self.joins.append(join)

        self.wheres.append("{0}.predicate = %s AND {0}.obj_value {1} %s".format(join_name, operator))
        self.params.extend([predicate, val])

    def to_sql(self, q, predicate_filter = None): 
        """ Convert the query 'q', return a tuple of sql query and array of parameters.
        
            q -- Query of objects to search for
            predicate_filter -- List of predicates to limit the result objects to (None means no restriction)
        """

        # look through the constraints of the query
        for predicate, val in q.items():
            if type(val) in self.exact_types:
                # exact match, so JOIN in the view
                if predicate == "@id": # _id is not in the db, it's the subject column
                    self.wheres.append("wb_v_latest_triples.subject = %s")
                    self.params.extend([val]) 
                else:
                    self.do_join(predicate, val) # this is the standard case, where the query was like {"foo": "bar"}, where the key foo has to be bar.

            elif type(val) == type({}):
                # when the value is a dict, then we check to see what it means
                # looks like this:
                # 
                # {"number": {"ge": 5} }   - means number >= 5

                acted = False # track to see if we did anything, raise an exception if we didnt

                # looks for an operator in the map, ignores keys we don't know
                for operator in self.operator_map:
                    if operator in val:
                        subval = val[operator]
                        self.do_join(predicate, subval, operator = self.operator_map[operator])
                        acted = True

                if not acted:
                    raise InvalidObjectQueryException("No valid operator in val: {0}".format(val))

            else:
                raise InvalidObjectQueryException("Invalid type of val: {0}".format(val))

        if predicate_filter is not None:
            self.wheres.append("wb_v_latest_triples.predicate = ANY(%s)")
            self.params.extend([predicate_filter])

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

        sql = "SELECT DISTINCT {0} FROM wb_v_latest_triples {1} WHERE {2}".format(", ".join(selects), " ".join(self.joins), " AND ".join(self.wheres)) 
        return (sql, self.params)

class InvalidObjectQueryException(Exception):
    pass

