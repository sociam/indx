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

import os
import logging
import sys
import getpass
import argparse
import json
import copy
from indx.server import WebServer
from twisted.internet import reactor

def setup_logger(logfile, stdout, error_log):
    """ Set up the logger, based on options. """
    formatter = logging.Formatter('%(name)s\t%(levelname)s\t%(asctime)s\t%(message)s')

    log_handler = logging.FileHandler(logfile, "a")
    log_handler.setLevel(logging.DEBUG)
    log_handler.setFormatter(formatter)

    logger = logging.getLogger() # root logger
    logger.setLevel(logging.DEBUG)
    map(lambda handler: logger.removeHandler(handler), logger.handlers) # remove default handler(s)
    logger.addHandler(log_handler) # add out new handlers with their specific formatting

    if stdout:
        stdout_handler = logging.StreamHandler(stream=sys.stdout)
        stdout_handler.setLevel(logging.DEBUG)
        stdout_handler.setFormatter(formatter)
        logger.addHandler(stdout_handler)

    if error_log:
        error_log_handler = logging.FileHandler(error_log, "a")
        error_log_handler.setLevel(logging.ERROR)
        error_log_handler.setFormatter(formatter)
        logger.addHandler(error_log_handler)

def deep_update(original, updates, route):
    """ Update an original multi-level dict with individual updates that miss out key/values. """

    new_route = copy.copy(route)

    newvalue = updates
    while len(new_route) > 0:
        node = new_route.pop(0)
        newvalue = newvalue[node]

    if type(newvalue) == type({}):
        for key in newvalue.keys():
            next_route = copy.copy(route)
            next_route.append(key)
            original = deep_update(original, updates, next_route)
    else:
        new_route = copy.copy(route)
        oldvalue = original
        while len(new_route) > 0:
            node = new_route.pop(0)
            if len(new_route) == 0:
                oldvalue[node] = newvalue
            else:
                oldvalue = oldvalue[node]

    return original


""" Set up the arguments, and their defaults. """
parser = argparse.ArgumentParser(description='Run an INDX server.')
parser.add_argument('user', type=str, help="PostgreSQL server username, e.g. indx - This user must have CREATEDB and CREATEROLE privileges")
parser.add_argument('hostname', type=str, help="Hostname of the INDX server, e.g. indx.example.com")
parser.add_argument('--db-host', default="localhost", type=str, help="PostgreSQL host, e.g. localhost")
parser.add_argument('--db-port', default=5432, type=int, help="PostgreSQL port, e.g. 5432")
parser.add_argument('--log', default="/tmp/indx.log", type=str, help="Location of logfile e.g. /tmp/indx.log")
parser.add_argument('--error-log', default=None, type=str, help="Location of errors-only logfile e.g. /tmp/indx_error.log (off by default)")
parser.add_argument('--port', default=8211, type=int, help="Override the server listening port")
parser.add_argument('--log-stdout', default=False, action="store_true", help="Also log to stdout?")
parser.add_argument('--ssl', default=False, action="store_true", help="Turn on SSL")
parser.add_argument('--ssl-cert', default="data/server.crt", type=str, help="Path to SSL certificate")
parser.add_argument('--ssl-key', default="data/server.key", type=str, help="Path to SSL private key")
parser.add_argument('--no-browser', default=False, action="store_true", help="Don't load a web browser after the server has started")
parser.add_argument('--address', default="", type=str, help="Specify IP address to bind to")
parser.add_argument('--password', default=None, type=str, help="Specify password on the command line instead of interactively")
parser.add_argument('--indx-db', default="indx", type=str, help="Specify the name of the INDX configuration database")
parser.add_argument('--runners', default=None, type=str, help="Run multiple servers using a runner JSON configuration, using the other command-line options as common values.")
args = vars(parser.parse_args())

""" Prompt the user for a password. """
password = args['password'] or getpass.getpass()

""" Set up the logging based on the user's options. """
setup_logger(args['log'], args['log_stdout'], args['error_log'])

""" Set up the configuration structure. """
config = {
    "db": {
        "user": args['user'],
        "password": password,
        "host": args['db_host'],
        "port": args['db_port'],
    },
    "server": {
        "hostname": args['hostname'],
        "port": args['port'],
        "ssl": args['ssl'],
        "ssl_cert": args['ssl_cert'],
        "ssl_private_key": args['ssl_key'],
        "address": args['address'],
        "html_dir": os.path.dirname(os.path.realpath(__file__)) + os.sep + ".." + os.sep + "html",
    },
    "indx_db": args['indx_db'],
    "no_browser": args['no_browser'],
}

if args['runners']:
    """ Use 'config' as the base configuration, but run multiple servers using the differences in runners JSON. """

    f = open(args['runners'])
    runners_conf = json.load(f)
    f.close()

    for runner in runners_conf:
        new_config = copy.deepcopy(config)
        new_config = deep_update(new_config, runner, [])

        logging.debug("Running a server with config: {0}".format(new_config))

        server = WebServer(new_config)
        server.run(reactor_start = False)

    reactor.run()

else:
    """ Run the server using our configuration. """
    server = WebServer(config)
    server.run()

