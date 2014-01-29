#!/bin/bash
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

# set up the virtualenv
virtualenv env
echo "export PYTHONPATH=\"\$VIRTUAL_ENV/../lib:\$PYTHONPATH\"" >> env/bin/activate
source env/bin/activate

# install the required modules
# emax changed from "--ignore-installed" b/c that wreaks havoc w/ virutalnev
pip install --upgrade -r requirements.txt


# install doc and test framework dependencies
#(cd lib/docs; npm install)
#(cd lib/tests; npm install)