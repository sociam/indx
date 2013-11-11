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

import os, logging, json, re
from indx.webserver.handlers.base import BaseHandler
from twisted.web.server import NOT_DONE_YET
import requests
from subprocess import check_output
import subprocess
import shutil
import glob



class DevToolsApp(BaseHandler):


    def __init__(self, server):
        BaseHandler.__init__(self, server)
        logging.debug(' hello')
        self.isLeaf = True

    

    def lookup_config(self, name, config_type):
        configs = self.get_config_list(config_type)
        matches = [config for config in configs if config['name'] == name]
        if not matches:
            self.return_forbidden(request) # todo: more useful return
        return matches[0];


    def get_config_list(self, config_type):
        logging.debug('getting list of configs')
        currdir = os.path.dirname(os.path.abspath(__file__))
        # look in apps
        appdir = os.path.sep.join([currdir, '..', '..', 'apps'])
        dirs = [os.path.normpath(appdir + os.path.sep + d) for d in os.listdir(appdir)]
        dirs.append(os.path.normpath(os.path.sep.join([currdir, '..', '..', 'lib', config_type, 'config'])))
        config_files = []
        for d in dirs:
            if os.path.isdir(d):
                logging.debug('checking directory %s' % d)
                files = os.listdir(d)
                for f in files:
                    f = d + os.path.sep + f;
                    logging.debug('checking file %s' % f)
                    config_end = config_type + '-config.js'
                    if os.path.isfile(f) and f.endswith(config_end):
                        logging.debug('found file %s' % f)
                        config_files.append(f);
        configs = [self.config_data(f, config_type) for f in config_files]
        logging.debug("configs: {0}".format(configs))
        return configs;

    def list_manifests_in(self, appdir):
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
                    logging.warn('Failed to load JSON file (might be invalid?): %s', manifest_file)
                manifest_json.close()

        return manifests


    def list_all_manifests (self):
        manifests = []

        currdir = os.path.dirname(os.path.abspath(__file__))

        logging.debug('getting list of core manifests')
        core_dir = os.path.normpath(os.path.sep.join([currdir, '..', '..', 'lib', 'core_manifests']))
        core_manifests = self.list_manifests_in(core_dir)
        for manifest in core_manifests:
            manifest['type'] = 'core'
            manifest['id'] = 'core-' + '.'.join(manifest['manifest_name'].split('.')[:-2])
            manifests.append(manifest)

        logging.debug('getting list of app manifests')
        apps_dir = os.path.sep.join([currdir, '..', '..', 'apps'])
        for d in os.listdir(apps_dir):
            app_dir = os.path.normpath(apps_dir + os.path.sep + d)
            if os.path.isdir(app_dir):
                app_manifests = self.list_manifests_in(app_dir)
                if len(app_manifests) == 0:
                    app_manifests.append({ 'name': d })

                for manifest in app_manifests:
                    url = '/apps/' + d
                    manifest['url'] = url
                    manifest['type'] = 'app'
                    manifest['id'] = 'app-' + d
                    if 'icons' in manifest:
                        for icon_type, icon in manifest['icons'].items():
                            manifest['icons'][icon_type] = url + '/' + icon
                    manifests.append(manifest)

        for manifest in manifests:
            if 'documentation' in manifest:
                config_file = manifest['documentation']
                manifest['documentation'] = self.doc_info(manifest, config_file)

        return manifests

    def doc_info(self, manifest, config_file):
        path = os.path.sep.join(['apps', 'devtools', 'html', 'docs', manifest['type'], manifest['id']])
        return {
            'url': '/apps/devtools/docs/{0}/{1}'.format(manifest['type'], manifest['id']),
            'built': os.path.exists(path),
            'path': path,
            'config_path': manifest['manifest_dir'] + os.path.sep + config_file
        }

    def config_data(self, filename, config_type):
        name = filename.split('/')[-1].split('.')[0]

        app_name_r = re.compile('apps/([^/]+)/%s-config.js' % config_type)
        app_name = app_name_r.findall(filename)
        logging.debug("hmm... %s" % app_name)
        if app_name:
            name = app_name[0]

        path = os.path.sep.join(['apps', 'devtools', 'html', config_type, name])

        return {
            'name': name,
            'config_path': filename,
            'path': path,
            'url': 'apps/devtools/{0}/{1}'.format(config_type, name),
            'built': os.path.exists(path)
            }

    def list_manifests(self, request):
        """ Get a list of core components and apps
        """
        manifests = self.list_all_manifests()
        for manifest in manifests:
            manifest['manifest_dir'] = None
            if 'documentation' in manifest:
                manifest['documentation']['config_path'] = None
        self.return_ok(request, data = { 'response': manifests })

    def list_docs(self, request):
        """ Get a list of doc configs.
        """
        configs = self.get_config_list('docs')
        self.return_ok(request, data = { "response": configs })

    def list_tests(self, request):
        """ Get a list of doc configs.
        """
        configs = self.get_config_list('tests')
        self.return_ok(request, data = { "response": configs })

    def get_requested_config(self, request, config_type):
        args = request.args
        logging.debug('args %s', args['name'])
        if not args['name']:
            self.return_forbidden(request)
            return
        config_name = args['name'][0]
        config = self.lookup_config(config_name, config_type)
        if not config:
            self.return_forbidden(request)
            return
        return config


    def build_doc(self, request):
        """ Generate documentation from config file.
        """
        manifests = self.list_all_manifests()
        if not request.args['id']:
            self.return_forbidden(request)
            return
        manifest_id = request.args['id'][0]

        manifest = None
        for _manifest in manifests:
            if (_manifest['id'] == manifest_id):
                manifest = _manifest
                break

        if not manifest:
            self.return_internal_error(request) # 'Manifest not found'
            return

        logging.debug('generating doc %s' % manifest['name'])
        config = manifest['documentation']

        try:
            cmd_str = 'node lib/docs/build.js %s ' % config['config_path']
            cmd_str += '--output-directory=%s ' % config['path']
            cmd_str += '--log-stdout'
            logging.debug('Exec %s' % cmd_str)
            out = check_output(cmd_str, shell=True)
        except subprocess.CalledProcessError, e:
            logging.debug('Failed to run builder', e.output)
            self.return_internal_error(request)
            raise

        logging.debug(out);
        self.return_ok(request, data = { "response": 'ok' })

    def run_test(self, request):
        logging.debug('trying to run tests')
        config = self.get_requested_config(request, 'tests')
        if not config:
            return
        logging.debug('running tests %s' % config['name'])
        cmd_str = 'node lib/tests/run.js %s' % (config['config_path'])
        cmd_str += ' --reporters junit'
        cmd_str += ' --output-directory=%s' % (config['path'])
        logging.debug(cmd_str)
        cmd = subprocess.Popen([cmd_str], stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
        out, err = cmd.communicate()
        logging.debug(out);
        if cmd.returncode != 0:
            logging.debug('Non-zero exit status')
            self.return_internal_error(request)
            return
        results_file = os.path.dirname(config['config_path']) + os.path.sep + 'test-results.xml'
        logging.debug(results_file)
        if os.path.exists(results_file):
            if not os.path.isdir(config['path']):
                os.makedirs(config['path'])
            newpath = config['path'] + os.path.sep + 'test-results.xml'
            if os.path.exists(newpath):
                os.remove(newpath)
            # move test-results.xml to where we want
            shutil.move(results_file, config['path'] + os.path.sep)
        config['build_output'] = out;
        config['built'] = os.path.exists(config['path']);
        self.return_ok(request, data = { "response": config })


DevToolsApp.base_path = "devtools/api"

DevToolsApp.subhandlers = [
    {
        "prefix": "devtools/api/manifests",
        'methods': ['GET'],
        'require_auth': False,
        'require_token': False,
        'handler': DevToolsApp.list_manifests,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "devtools/api/build_doc",
        'methods': ['POST'],
        'require_auth': False,
        'require_token': False,
        'handler': DevToolsApp.build_doc,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "devtools/api/run_test",
        'methods': ['POST'],
        'require_auth': False,
        'require_token': False,
        'handler': DevToolsApp.run_test,
        'accept':['application/json'],
        'content-type':'application/json'
        }
]


APP = DevToolsApp