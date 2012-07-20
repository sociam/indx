#!/bin/bash

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
#    Foobar is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.


# set up the virtualenv
virtualenv -p /usr/local/bin/python env
source env/bin/activate

# install cython separately (doesn't work in requirements.txt for me)
pip install- --upgrade cython

# install the required modules
#pip install --ignore-installed --upgrade -r requirements.txt
pip install --ignore-installed -r requirements.txt

# for the py4s setup.py, it requires 4store sources here
# assume you have 4store in webbox/../
mkdir env/build
ln -s ../../../4store env/build/4store
pip install --upgrade git+git://github.com/danielsmith-eu/py4s.git#egg=py4s

