#    This file is part of WebBox.
#
#    Copyright 2013 Daniel Alexander Smith
#    Copyright 2013 University of Southampton
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

import traceback, argparse, logging
from webbox.tests import WebBoxTests

wbtests = WebBoxTests()
parser = argparse.ArgumentParser(description='Run tests against a WebBox server.')
parser.add_argument('server', metavar='SERVER', type=str, nargs=1, help='URL of WebBox server, e.g. http://localhost:8211/')
parser.add_argument('username', metavar='USERNAME', type=str, nargs=1, help='Username')
parser.add_argument('password', metavar='PASSWORD', type=str, nargs=1, help='Password')
parser.add_argument('test', metavar='TEST', type=str, nargs=1, choices=wbtests.tests.keys(), help='Run a named test, one of: '+", ".join(wbtests.tests.keys()))
parser.add_argument('--box', action="store", type=str, help='Name of the Box (for tests that required it)')
parser.add_argument('--query', action="store", type=str, help='Query string (for tests that required it)')
parser.add_argument('--data', action="store", type=argparse.FileType('r'), help="Data file (e.g., JSON to import)")
parser.add_argument('--version', action="store", help="Current version of the box (or 0 if the box is empty)")
parser.add_argument('--from', action="store", help="From version (e.g., for 'diff')")
parser.add_argument('--to', action="store", help="To version (e.g., for 'diff')")
parser.add_argument('--return_objs', action="store", default="ids", help="Enable return of 'objects', 'ids', 'diff' (e.g., for 'diff')")
parser.add_argument('--debug', action="store_true", default=False, help="Enable output of debug logging")
parser.add_argument('--id', action="store", nargs="+", help="Limit to specific IDs (e.g., for get_by_ids)")

args = vars(parser.parse_args())

if args['debug']:
    logging.basicConfig(level='DEBUG')
else:
    logging.basicConfig(level='INFO')

try:
    test = args['test'][0]
    wbtests.set_args(args)
    wbtests.tests[test]()
except Exception as e:
    if args['debug']:
        traceback.print_exc()
    print "There was a problem: {0}".format(e)

