#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Klek
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

class ResponseOverride(Exception):
    
    def __init__(self, status, reason, data=""):
        super(ResponseOverride, self).__init__()
        self.status = status
        self.reason = reason
        self.data = data

    def get_response(self):
        return {"status": self.status, "reason": self.reason, "data": self.data}

class AbstractException(Exception):
    
    def __init__(self, message=''):
        super(AbstractException, self).__init__()
        self.message = message
