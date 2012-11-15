#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith, Max Van Kleek
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

import logging, traceback, json
from twisted.web.resource import Resource
from webbox.webserver.handlers.base import BaseHandler
import webbox.webbox_pg2 as database

class AdminHandler(BaseHandler):
    """ Add/remove boxes, add/remove users, change config. """
    base_path = 'admin'
    def init_db(self, request):
        """ Initialise database, with specified postgres root credentials. """
        root_user = request.args['input_user'][0]
        root_password = request.args['input_password'][0]

        self.webbox.initialise_object_store(root_user, root_password)

        # send them back to the webbox start page
        # request.redirect(str(self.webbox.get_base_url()))
        # request.finish()
        self.return_ok(request)
        pass
        
    def create_box(self, request):
        """ Create a new box. """
        args = self.get_post_args(request)
        name = args['name'][0]
        username = self.get_session(request).username
        password = self.get_session(request).password
        logging.debug("Creating box {0} for user {1}".format(name,username))
        try:
            database.create_box(name,username,password)
            self.webserver.start_box(name)
            self.return_created(request)
        except Exception as e:
            logging.error('Error creating box {0} {1} '.format(name,e))
            self.return_internal_error(request)

    def list_boxes(self,request):
        username = self.get_session(request).username
        password = self.get_session(request).password

        def boxes(db_list):
            return self.return_ok(request, data={"list": db_list})

        database.list_boxes(username, password).addCallback(boxes)

    def create_user(self, request):
        args = self.get_post_args(request)
        new_username = args['username'][0]
        new_password = args['password'][0]

        # postgres webbox user
        username = self.webserver.config['webbox']['db']['user']
        username = self.webserver.config['webbox']['db']['password']

        logging.debug("Creating new user with username: {0}".format(new_username))
        try:
            def created(result):
                return self.return_ok()

            d = database.create_user(new_username, new_password, username, password)
            d.addCallback(created)
        except Exception as e:
            logging.error("Error creating new user {0}".format(new_username))
            self.return_internal_error(request)

        
AdminHandler.subhandlers = [
    {
        'prefix': 'init_db',
        'methods': ['POST'],
        'require_auth': False,
        'require_token': False,
        'handler': AdminHandler.init_db,
        'content-type':'text/plain', # optional
        'accept':['application/json']                
    },
    {
        'prefix': 'list_boxes',
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': AdminHandler.list_boxes,
        'content-type':'text/plain', # optional
        'accept':['application/json']
    },    
    {
        'prefix': 'create_box',
        'methods': ['POST'],
        'require_auth': True,
        'require_token': False,
        'handler': AdminHandler.create_box,
        'content-type':'text/plain', # optional
        'accept':['application/json']
    },
    {
        'prefix': 'create_box',
        'methods': ['POST'],
        'require_auth': False,
        'require_token': False,
        'handler': BaseHandler.return_forbidden,
        'content-type':'text/plain', # optional
        'accept':['application/json']
    },
    {
        'prefix': 'create_user',
        'methods': ['POST'],
        'require_auth': True,
        'require_token': False,
        'handler': AdminHandler.create_user,
        'content-type':'text/plain', # optional
        'accept':['application/json']
    },
    { 
        'prefix':'*',
        'methods': ['OPTIONS'],
        'require_auth': False,
        'require_token': False,
        'handler': BaseHandler.return_ok,
        'content-type':'text/plain', # optional
        'accept':['application/json']
   }
]
