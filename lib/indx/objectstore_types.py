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

        # e.g. if the from_rows tried to add it as a root object, we should do that here, it might already be added as a non-root if it was in the 'object' column
        if root and id not in self.root_object_ids:
            self.root_object_ids.append(id)

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

    def to_flat_json(self):
        """ Get the list of objects in a flat format (not nested). """
        objs_out = []

        for obj in self.objects_by_id.values():
            objs_out.append(obj.as_stub())

        return objs_out

    def root_objects(self):
        objs = {}
        for id in self.root_object_ids:
            objs[id] = self.get(id)
        return objs

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
            logging.debug("Objectstore Types, Graph, loop, id: {0}".format(id))
            loop_d = Deferred()

            if id is None:
                loop_d.callback(True)
                return

            obj = self.get(id)
            logging.debug("Objectstore Types, Graph, loop to object: {0}".format(id))

            def expanded(expanded_graph):
                expanded_d = Deferred()

                logging.debug("Objectstore Types, Graph, expanded, graph: {0}".format(expanded_graph))

                subobjs = []

                if expanded_graph is not None:
                    logging.debug("Objectstore Types, Graph, replacing expanded object: {0}".format(id))
                    resource = expanded_graph.get(id)
                    resource.set_expanded()
                    self.replace_resource(id, resource)

                    for resource_id, resource in expanded_graph.objects().items():
                        if resource_id not in subobjs:
                            subobjs.append(resource_id)
                else:
                    resource = obj

                subdepth = depth - 1
                if subdepth > 0:
                    for expanded_id, expanded_resource in expanded_graph.objects().items():
                        logging.debug("Objectstore Types, Graph, expanded, props: {0}".format(expanded_resource.props()))
                        for prop in expanded_resource.props():
                            # traverse depth of objects
                            logging.debug("Objectstore Types, Graph, expanded, val: {0}".format(expanded_resource.get(prop)))
                            for val in expanded_resource.get(prop):
                                if isinstance(val, Resource) and val.id not in subobjs:
                                    subobjs.append(val.id)
                
                logging.debug("Objectstore Types, Graph, expanded, subobjs: {0}".format(subobjs))

                if len(subobjs) > 0:
                    logging.debug("Objectstore Types, subobjs: {0}".format(subobjs))
                    self.expand_depth(subdepth, store, subobjs).addCallbacks(lambda empty: expanded_d.callback(True), return_d.errback)
                else:
                    expanded_d.callback(True)

                return expanded_d


            if not obj.expanded_already():
                # expand this object
                logging.debug("Objectstore Types, Graph, expanding object: {0}".format(id))
                #store.get_latest_objs([id], render_json = False).addCallbacks(lambda empty: loop_d.callback(next_obj()), return_d.errback)

                def latest_cb(objs):
                    expanded(objs).addCallbacks(lambda empty: loop_d.callback(next_obj()), return_d.errback)

                store.get_latest_objs([id], render_json = False).addCallbacks(latest_cb, return_d.errback)
            else:
                logging.debug("Objectstore Types, Graph, object not being expanded.")
                loop_d.callback(next_obj())

            return loop_d

        if depth >= 0:
            d = Deferred() # this deferred will call the 'loop' function for us
            first_obj = next_obj() # get the first object from the list
 
            def process_list(obj):
                if obj is None:
                    return_d.callback(True) # if the list if empty, end the function
                    return
                else:
                    d.addCallback(loop) # run the loop on this object, loop calls next_obj() to the next callback
                    d.addCallback(process_list) # when loop finishes, the deferred will call process_list, with the next object from above
                    return obj

            d.addCallback(process_list) # make the deferred call the process_list function first
            d.callback(first_obj) # pass the first_obj to the process_list function

        else:
            return_d.callback(True) # don't do anything if depth is zero, end immediately

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
        self.expanded = False

    def set_expanded(self):
        self.expanded = True

    def expanded_already(self):
        """ Has this resource been expanded already? """
        return self.expanded

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

    def as_stub(self):
        """ Return in the JSON format, without nested links. """
        model = {}

        for property, values in self.model.items():

            if property == "@id": # special case
                model[property] = values
            else:
                model[property] = []
                for value in values:
                    if isinstance(value, Resource):
                        model[property].append({"@id": value.id})
                    else:
                        model[property].append(value.to_json())

        return model


    def to_json(self, value_id_list = []):
        """ Convert to the JSON format.
        
            value_id_list -- List of IDs of resources already rendered, used inside to_json() calls internally to prevent infinite cycles (leave blank when called externally).
        """
        model = {}
        value_id_list_cpy = copy.copy(value_id_list)
        value_id_list_cpy.append(self.id) # prevent this id from being rendered by its children/descendents

        for property, values in self.model.items():

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

