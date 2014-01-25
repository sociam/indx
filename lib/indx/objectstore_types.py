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
import copy
from twisted.internet.defer import Deferred

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

            resource = graph.get(subject, root=True)

            if obj_type == "resource":
                obj = graph.get(obj_value, root=False) # maintain links to existing Resource in graph
            else:
                obj = Graph.value_from_row(obj_value, obj_type, obj_lang, obj_datatype)
            resource.add(predicate, obj)

        return graph


    def __init__(self):
        self.objects_by_id = {}
        self.root_object_ids = []

    def add(self, resource, root=True):
        """ Add a new resource object into the graph. """
        if not isinstance(resource, Resource):
            raise Exception("resource must be a Resource")
        self.objects_by_id[resource.id] = resource
        if root:
            self.root_object_ids.append(resource.id)

    def get(self, id, root=False):
        """ Get an object by ID, or create a new one if it doesn't exist. """
        if id not in self.objects_by_id:
            resource = Resource(id)
            self.add(resource, root=root)
        return self.objects_by_id[id]

    def objects(self):
        """ Get the list of objects as a dict by id. """
        return self.objects_by_id

    def to_json(self):
        """ Get the list of object in the JSON format. """
        obj_out = {}
        for id in self.root_object_ids:
            obj_out[id] = self.objects_by_id[id].to_json()
        return obj_out

    def replace_resource(self, id, resource):
        self.objects_by_id[id] = resource

    def expand_depth(self, depth, store, objs = None):
        """ Expand the depth of the graph to a minimum of 'depth', using the database connection 'conn' to request more objects as required. """
        return_d = Deferred()
        logging.debug("Objectstore Types, Graph, expand depth to depth '{0}'".format(depth))

        if objs is None:
            objs = copy.copy(self.root_object_ids)

        logging.debug("Objectstore Types, Graph, object at this depth: {0}".format(objs))

        def next_obj():
            if len(objs) == 0:
                logging.debug("Objectstore Types, Graph, sending callback.")
                return None
            else:
                id = objs.pop(0)
                return id

        def loop(id):
            logging.debug("Objectstore Types, Graph, loop")

            if id is None:
                return_d.callback(True)
                return

            obj = self.get(id)
            logging.debug("Objectstore Types, Graph, loop to object: {0}".format(id))

            def expanded(expanded_graph):
                expanded_d = Deferred()

                logging.debug("Objectstore Types, Graph, expanded")

                subobjs = []

                if expanded_graph is not None:
                    logging.debug("Objectstore Types, Graph, replacing expanded object: {0}".format(id))
                    resource = expanded_graph.get(id)
                    self.replace_resource(id, resource)
                    subobjs.append(resource)
                else:
                    resource = obj

                subdepth = depth - 1
                if subdepth > 0:
                    logging.debug("Objectstore Types, Graph, expanded, props: {0}".format(resource.props()))
                    for prop in resource.props():
                        # traverse depth of objects
                        logging.debug("Objectstore Types, Graph, expanded, val: {0}".format(resource.get(prop)))
                        for val in resource.get(prop):
                            if isinstance(val, Resource):
                                subobjs.append(val)
                
                logging.debug("Objectstore Types, Graph, expanded, subobjs: {0}".format(subobjs))

                if len(subobjs) > 0:
                    self.expand_depth(subdepth, store, map(lambda x: x.id, subobjs)).addCallbacks(lambda empty: expanded_d.callback(True), return_d.errback)
                else:
                    expanded_d.callback(True)
                    #loop(None)

                return expanded_d


            if obj.is_stub():
                # expand this object
                logging.debug("Objectstore Types, Graph, expanding object: {0}".format(id))
                store.get_latest_objs([id], render_json = False).addCallbacks(expanded, return_d.errback)
            else:
                logging.debug("Objectstore Types, Graph, object not being expanded.")
#                expanded(None)

            return next_obj()

        if depth >= 0:
            d = Deferred()
            
            first_obj = next_obj()
 
            def process_list(obj):
                if obj is None:
                    return_d.callback(True)
                    return
                else:
                    d.addCallback(loop)
                    d.addCallback(process_list)
                    return obj

            d.addCallback(process_list)
            d.callback(first_obj)

#            return_d.callback(True) # for outside
#            loop(None)
        else:
            return_d.callback(True)

        return return_d

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

    def getOneValue(self, property):
        """ Get the first value of a property and return its value. If it does not exist, return None."""
        val = self.getOne(property)
        if val is None:
            return None
        return val.value

    def getOne(self, property):
        """ Get the first value of a property. If it does not exist, returns None. """
        values = self.get(property)
        if values is None:
            return None
        else:
            return values[0]
    
    def get(self, property):
        """ Get the values of a property. If it does not exist, returns None. """

        if property in self.model:
            return self.model[property]
        else:
            return None

    def props(self):
        """ Get a list of properties of this resource. """
        properties = self.model.keys()
        properties.remove("@id")
        return properties

    def is_stub(self):
        return len(self.model.keys()) == 1


    def to_json(self, value_id_list = []):
        """ Convert to the JSON format.
        
            value_id_list -- List of IDs of resources already rendered, used inside to_json() calls internally to prevent infinite cycles (leave blank when called externally).
        """
        try:
            if len(value_id_list) > 256:
                logging.debug("ObjectStore_Types Resource, to_json id: {0}, value_id_list (first 256 out of {2}): {1}".format(self.id, value_id_list[:256], len(value_id_list)))
            else:
                logging.debug("ObjectStore_Types Resource, to_json id: {0}, value_id_list: {1}".format(self.id, value_id_list))
        except Exception as e:
            logging.debug("ObjectStore_Types Resource, to_json, debug1")

        model = {}
        value_id_list_cpy = copy.copy(value_id_list)
        value_id_list_cpy.append(self.id) # prevent this id from being rendered by its children/descendents

        for property, values in self.model.items():
            try:
                logging.debug("ObjectStore_Types Resource, to_json, id: {0}, property: {1}, values: {2}".format(self.id, property, values))
            except Exception as e:
                logging.debug("ObjectStore_Types Resource, to_json, debug2")

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

