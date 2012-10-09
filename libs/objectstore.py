#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
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

class ObjectStore:
    """ Stores objects in a database, handling import, export and versioning. """

    def __init__(self, conn):
        """
            conn is a postgresql psycopg2 database connection
        """
        self.conn = conn

        # TODO FIXME determine if autocommit has to be off for PL/pgsql support
        self.conn.autocommit = True

    def get_latest(self, uri):
        """ Get the latest version of an object, as expanded JSON-LD notation.
            uri of the object
        """
        
        cur = self.conn.cursor()

        cur.execute("SELECT MAX(wb_data.version) FROM wb_data WHERE wb_data.subject = %s", [uri])
        item = cur.fetchone()
        latest_version = item[0]

        if latest_version is None:
            # FIXME throw an exception here instead?
            return None

        cur.execute("SELECT wb_data.predicate, wb_data.object_order, wb_objects.obj_type, wb_objects.obj_value, wb_objects.obj_lang, wb_objects.obj_datatype FROM wb_data JOIN wb_objects ON (wb_data.object = wb_objects.id_object) WHERE wb_data.subject = %s AND wb_data.version = %s ORDER BY wb_data.predicate, wb_data.object_order", [uri, latest_version])
        rows = cur.fetchall()

        obj_out = {"@version": latest_version}
        for row in rows:
            (predicate, obj_order, obj_type, obj_value, obj_lang, obj_datatype) = row
            if predicate not in obj_out:
                obj_out[predicate] = []

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


            obj_out[predicate].append(obj_struct)
    
        return obj_out


    def add_multi(self, objs):
        """ Add multiple objects, where the URIs and previous versions are included in the structure. """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here

        for obj in objs:
            if "@id" in obj:
                uri = obj["@id"]
            else:
                raise Exception("No @id in object")

            if "@prev_ver" in obj:
                prev_ver = int(obj["@prev_ver"])
            else:
                raise Exception("No @prev_ver in object")

            # remove these from the object, and keep the rest as the object we will insert/update
            del obj["@id"]
            del obj["@prev_ver"]

            self.add(uri, obj, prev_ver)


    def add(self, uri, obj, specified_prev_version):
        """ Add a new object, or new version of an object, to the database.

            uri of the object,
            obj, json expanded notation of the object,
            specified_prev_version of the objec (must match max(version) of the object, or zero if the object doesn't exist, or the store will return a IncorrectPreviousVersionException
        """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here

        cur = self.conn.cursor()

        cur.execute("SELECT MAX(wb_data.version) FROM wb_data WHERE wb_data.subject = %s", [uri])
        row = cur.fetchone()
        actual_prev_version = row[0]

        version_correct = False
        if actual_prev_version is None and specified_prev_version == 0:
            version_correct = True
        elif actual_prev_version == specified_prev_version:
            version_correct = True

        if not version_correct:
            raise IncorrectPreviousVersionException("Actual previous version is {0}, specified previous version is: {1}".format(actual_prev_version, specified_prev_version))


        if actual_prev_version is None:
            new_version = 1
        else:
            new_version = actual_prev_version + 1

        # version is correct, update it
        obj_ids = self.get_obj_ids(obj)

        for predicate in obj_ids:
            ids = obj_ids[predicate]
            obj_order = 0
            for id in ids:
                cur.execute("INSERT INTO wb_data (subject, predicate, object, object_order, version) VALUES (%s, %s, %s, %s, %s)", [uri, predicate, id, obj_order, new_version])
                obj_order += 1
    


    def get_obj_ids(self, obj):
        """ Get the foreign key IDs of all of the objects, adding them if necessary, and return a structure with FK IDs instead of uris.
            obj is the object structure in JSON expanded notation.
        """

        # TODO FIXME XXX lock the table(s) as appropriate inside a transaction (PL/pgspl?) here

        cur = self.conn.cursor()

        obj_ids = {}
        for predicate in obj:
            pred_objs = []
            objs = obj[predicate]
            for object in objs:
                if "@value" in object:
                    type = "literal"
                    value = object["@value"]
                elif "@id" in object:
                    type = "resource"
                    value = object["@id"]

                language = None
                if "@language" in object:
                    language = object["@language"]

                datatype = None
                if "@type" in object:
                    datatype = object["@type"]

                cur.execute("SELECT wb_objects.id_object FROM wb_objects WHERE wb_objects.obj_type = %s AND wb_objects.obj_value = %s AND wb_objects.obj_lang "+("IS" if language is None else "=")+" %s AND wb_objects.obj_datatype "+("IS" if language is None else "=")+" %s", [type, value, language, datatype])
                existing_id = cur.fetchone()

                if existing_id is None:
                    # INSERT new version
                    cur.execute("INSERT INTO wb_objects (obj_type, obj_value, obj_lang, obj_datatype) VALUES (%s, %s, %s, %s) RETURNING id_object", [type, value, language, datatype])
                    existing_id = cur.fetchone()
                    self.conn.commit()

                # Put the ID into the data structure 
                pred_objs.append(existing_id)

            obj_ids[predicate] = pred_objs

        return obj_ids

class IncorrectPreviousVersionException(BaseException):
    """ The specified previous version did not match the actual previous version. """
    pass

