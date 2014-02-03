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

import os, logging, json, signal
from indx.webserver.handlers.base import BaseHandler
from subprocess import check_output, PIPE, Popen
from threading  import Thread
import subprocess
import glob

class DevToolsApp(BaseHandler):

    def __init__(self, server):
        BaseHandler.__init__(self, server)
        self.started_tests = []
        self.isLeaf = True

    def list_manifests_in(self, appdir):
        """ find all manifests in a directory
        """
        logging.debug('looking for manifests in %s', appdir)
        manifests = []
        manifest_files = glob.glob(appdir + os.path.sep + '*manifest.json')
        for manifest_file in manifest_files:
            if os.path.isfile(manifest_file):
                logging.debug('reading manifest file %s', manifest_file)
                manifest_json = open(manifest_file)
                try:
                    manifest = json.load(manifest_json)
                    manifest['manifest_dir'] = appdir
                    manifest['manifest_name'] = manifest_file[len(appdir) + 1:]
                    manifests.append(manifest)
                except ValueError:
                    logging.warn('Failed to parse JSON (might be invalid?):',
                        manifest_file)
                manifest_json.close()

        return manifests

    def list_all_manifests (self):
        """ get all core and app manifests
        """
        manifests = []
        currdir = os.path.dirname(os.path.abspath(__file__))

        logging.debug('getting list of core manifests')
        core_dir = os.path.normpath(os.path.sep.join([currdir, '..', '..',
            'lib', 'core_manifests']))
        core_manifests = self.list_manifests_in(core_dir)

        for manifest in core_manifests:
            manifest['type'] = 'core'
            manifest_name = manifest['manifest_name']
            manifest['id'] = 'core-' + '.'.join(manifest_name.split('.')[:-2])
            manifests.append(manifest)

        logging.debug('getting list of app manifests')
        apps_dir = os.path.sep.join([currdir, '..', '..', 'apps'])
        for d in os.listdir(apps_dir):
            app_dir = os.path.normpath(apps_dir + os.path.sep + d)
            if not os.path.isdir(app_dir):
                continue
            app_manifests = self.list_manifests_in(app_dir)
            if len(app_manifests) == 0:
                app_manifests.append({ 'name': d })
            else:
                manifest = app_manifests[0]
                url = '/apps/' + d
                manifest['id'] = 'app-' + d
                manifest['url'] = url
                manifest['type'] = 'app'
                if 'icons' in manifest:
                    for icon_type, icon in manifest['icons'].items():
                        logging.debug(icon)
                        manifest['icons'][icon_type] = url + '/' + icon
                manifests.append(manifest)

        return manifests

    def list_manifests(self, request, some_other_param):
        """ Get a list of core components and apps
        """
        manifests = self.list_all_manifests()
        self.return_ok(request, data = { 'response': manifests })



DevToolsApp.base_path = "devtools/api"

DevToolsApp.subhandlers = [
    {
        "prefix": "devtools/api/manifests",
        'methods': ['GET'],
        'require_auth': True,
        'require_token': False,
        'handler': DevToolsApp.list_manifests,
        'accept':['application/json'],
        'content-type':'application/json'
        }
]


APP = DevToolsApp