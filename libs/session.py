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

from zope.interface import Interface, Attribute, implements


class ISession(Interface):
    is_authenticated = Attribute("A bool which registers if a user has successfully authenticated.")
    userid = Attribute("User ID (from the DB) of the authenticated user.")
    username = Attribute("Username of the authenticated user.")

class WebBoxSession(object):
    """ Stored per user session to record if the user is authenticated etc. """
    implements(ISession)

    def __init__(self, session):
        self.is_authenticated = False
        self.userid = None
        self.username = None

    def setAuthenticated(self, val):
        self.is_authenticated = val
   
    def setUser(self, userid, username):
        self.userid = userid
        self.username = username
