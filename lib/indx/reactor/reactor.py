#    Copyright (C) 2011-2014 University of Southampton
#    Copyright (C) 2011-2014 Daniel Alexander Smith
#    Copyright (C) 2011-2014 Max Van Kleek
#    Copyright (C) 2011-2014 Nigel R. Shadbolt
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

class IndxReactor:

    def __init__(self):
        self.subscribers = []
        self.mappings = []
        
    def add_subscriber(self, subscriber):
        self.subscribers.append(subscriber)

    def del_subscriber(self, subscriber):
        try:
            self.subscribers.remove(subscriber)
        except Exception as e:
            pass

    def send(self, msg, match_properties={}):
        """ Send a message to subscribers that match the properties specified. """
        map(lambda sub: sub.callback(msg), filter(lambda x: x.matches(match_properties), self.subscribers))

