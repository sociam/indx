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
import json

# TODO turn this into an indx.js-type ORM? subscribe to box and keep the graph and resources/literals up to date

class Graph:
    """ Represents the JSON Graph from the INDX ObjectStore. """

    @staticmethod
    def value_from_row(obj_value, obj_type, obj_lang, obj_datatype):
        """ Create a value (Resource or Literal) from an INDX ObjectStore database row. """
        if obj_type == "resource":
            obj = Resource(obj_value)
        elif obj_type == "literal":
            obj = Literal(obj_value, obj_lang, obj_datatype)
        else:
            raise Exception("Unknown object type from database {0}".format(obj_type)) # TODO create a custom exception to throw
        return obj
        

    @staticmethod
    def from_rows(rows):
        """ Create a populated Graph from INDX ObjectStore database rows. """
        graph = Graph()

        for row in rows:
            logging.debug("ObjectStore_Types from_rows, row: {0}".format(row))
            (triple_order, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype) = row

            resource = graph.get(subject)

            if obj_type == "resource":
                obj = graph.get(obj_value) # maintain links to existing Resource in graph
            else:
                obj = Graph.value_from_row(obj_value, obj_type, obj_lang, obj_datatype)
            resource.add(predicate, obj)

        return graph


    def __init__(self):
        self.objects_by_id = {}

    def add(self, resource):
        """ Add a new resource object into the graph. """
        if not isinstance(resource, Resource):
            raise Exception("resource must be a Resource")
        self.objects_by_id[resource.id] = resource

    def get(self, id):
        """ Get an object by ID, or create a new one if it doesn't exist. """
        if id not in self.objects_by_id:
            resource = Resource(id)
            self.add(resource)
        return self.objects_by_id[id]

    def objects(self):
        """ Get the list of objects as a dict by id. """
        return self.objects_by_id

    def to_json(self):
        """ Get the list of object in the JSON format. """
        obj_out = {}
        for id, obj in self.objects().items():
            obj_out[id] = obj.to_json()
        return obj_out

    def __hash__(self):
        return hash(Graph) ^ hash(self.objects_by_id)

    def __eq__(self, other):
        return (isinstance(other, Graph) and
                self.objects_by_id == other.objects_by_id)

    __ne__ = lambda self, other: not self == other

    def __unicode__(self):
        return u"Graph: {0}".format(json.dumps(self.to_json()))

    def __str__(self):
        return "Graph: {0}".format(json.dumps(self.to_json()))

    def __repr__(self):
        return self.__str__()


class Resource:
    """ Represents a resource from the INDX ObjectStore. """

    def __init__(self, id):
        self.id = id
        self.model = {"@id": self.id}

    def add(self, property, value):
        """ Add a value to the existing array of values. Creates the property in the model if it doesn't already exist.
        
            property -- String/Unicode of a property
            value -- Either a Resource or a Literal
        """

        if not (isinstance(value, Resource) or isinstance(value, Literal)):
            raise Exception("value must be a Resource or a Literal")

        if property not in self.model:
            self.model[property] = []

        self.model[property].append(value)

    def get(self, property):
        """ Get the values of a property. If it does not exist, returns None. """

        if property in self.model:
            return self.model[property]
        else:
            return None


    def to_json(self, value_id_list = []):
        """ Convert to the JSON format.
        
            value_id_list -- List of IDs of resources already rendered, used inside to_json() calls internally to prevent infinite cycles (leave blank when called externally).
        """
        logging.debug("ObjectStore_Types Resource, to_json id: {0}, value_id_list: {1}".format(self.id, value_id_list))

        model = {}
        value_id_list_cpy = [row[:] for row in value_id_list]
        value_id_list_cpy.append(self.id) # prevent this id from being rendered by its children/descendents

        for property, values in self.model.items():
            logging.debug("ObjectStore_Types Resource, to_json, id: {0}, property: {1}, values: {2}".format(self.id, property, values))
            if property == "@id": # special case
                model[property] = values
            else:
                model[property] = []
                for value in values:
                    if isinstance(value, Resource) and value.id in value_id_list_cpy:
                        model[property].append({"@id": value.id, "@link_only": True}) # prevent cyclic rendering
                    else:
                        model[property].append(value.to_json(value_id_list = value_id_list_cpy))

        return model

    def __hash__(self):
        return hash(Resource) ^ hash(self.id) ^ hash(self.model)

    def __eq__(self, other):
        return (isinstance(other, Resource) and
                self.id == other.id and
                self.model == other.model)

    __ne__ = lambda self, other: not self == other

    def __unicode__(self):
        return u"Resource: {0}".format(json.dumps(self.to_json()))

    def __str__(self):
        return "Resource: {0}".format(json.dumps(self.to_json()))

    def __repr__(self):
        return self.__str__()


class Literal:
    """ Represents a literal from the INDX ObjectStore. """

    def __init__(self, value, language, type):
        self.value = value
        self.language = language
        self.type = type

    def to_json(self, value_id_list = []):
        """ Convert to the JSON format.
        
            value_id_list -- For compatibility with Resource
        """
        return {"@value": self.value,
                "@language": self.language or "",
                "@type": self.type or "",
               }

    def __hash__(self):
        return hash(Literal) ^ hash(self.value) ^ hash(self.language) ^ hash(self.type)

    def __eq__(self, other):
        return (isinstance(other, Literal) and
                self.value == other.value and
                self.language == other.language and
                self.type == other.type)

    __ne__ = lambda self, other: not self == other

    def __unicode__(self):
        return u"Literal: {0}".format(self.to_json())

    def __str__(self):
        return "Literal: {0}".format(self.to_json())

    def __repr__(self):
        return self.__str__()

