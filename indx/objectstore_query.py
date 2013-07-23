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

    def __init__(self):
        self.exact_types = [types.IntType, types.LongType, types.BooleanType, types.FloatType, types.StringType, types.UnicodeType]

    def to_sql(self, q):
        """ Convert the query 'q', return a tuple of sql query and array of parameters. """
    
        # sql params
        params = []
        
        # to make up the query
        joins = []
        wheres = []

        join_counter = 0

        # look through the constraints of the query
        for predicate, val in q.items():
            if type(val) in self.exact_types:
                # exact match, so JOIN in the view
                if predicate == "@id": # _id is not in the db, it's the subject column
                    wheres.append("wb_v_latest_triples.subject = %s")
                    params.extend([val]) 

                else:

                    join_counter += 1
                    join_name = "j_{0}".format(join_counter)

                    join_table1 = "wb_v_latest_triples.subject"
                    join_table2 = "{0}.subject".format(join_name)

                    join = "JOIN wb_v_latest_triples AS {0} ON ({1} = {2}) ".format(join_name, join_table1, join_table2)
                    joins.append(join)

                    wheres.append("{0}.predicate = %s AND {0}.obj_value = %s".format(join_name))
                    params.extend([predicate, val])

        # same order as table
        selects = [
            "wb_v_latest_triples.version",
            "wb_v_latest_triples.triple_order",
            "wb_v_latest_triples.subject",
            "wb_v_latest_triples.predicate",
            "wb_v_latest_triples.obj_value",
            "wb_v_latest_triples.obj_type",
            "wb_v_latest_triples.obj_lang",
            "wb_v_latest_triples.obj_datatype"
        ]

        sql = "SELECT DISTINCT {0} FROM wb_v_latest_triples {1} WHERE {2}".format(", ".join(selects), " ".join(joins), " AND ".join(wheres)) 
        return (sql, params)



