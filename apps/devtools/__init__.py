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

import os, logging, json
from indx.webserver.handlers.base import BaseHandler
from subprocess import check_output, PIPE, Popen
from threading  import Thread
import subprocess
import glob

class DevToolsApp(BaseHandler):


    def __init__(self, server):
        BaseHandler.__init__(self, server)
        logging.debug(' hello')
        self.isLeaf = True

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
                    logging.warn('Failed to parse JSON (might be invalid?):',
                        manifest_file)
                manifest_json.close()

        return manifests

    def list_all_manifests (self):
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
                            if icon_type != 'font-awesome':
                                manifest['icons'][icon_type] = url + '/' + icon
                    manifests.append(manifest)

        for manifest in manifests:
            if 'documentation' in manifest:
                config_file = manifest['documentation']
                manifest['documentation'] = self.doc_info(manifest, config_file)
            if 'tests' in manifest:
                for i, test in enumerate(manifest['tests']):
                    path = os.path.sep.join(['apps', 'devtools', 'html', 'tests',
                        manifest['id'], str(i)])
                    test['url'] = '/apps/devtools/tests/{0}/{1}/test-results.xml'.format(manifest['id'], str(i))
                    test['built'] = os.path.exists(path)
                    test['path'] = path
                    test['config'] = manifest['manifest_dir'] + os.path.sep + test['config']

        return manifests

    def doc_info(self, manifest, config_file):
        path = os.path.sep.join(['apps', 'devtools', 'html', 'docs',
            manifest['type'], manifest['id']])
        return {
            'url': '/apps/devtools/docs/{0}/{1}'.format(manifest['type'],
                manifest['id']),
            'built': os.path.exists(path),
            'path': path,
            'config_path': manifest['manifest_dir'] + os.path.sep + config_file
        }

    def list_manifests(self, request):
        """ Get a list of core components and apps
        """
        manifests = self.list_all_manifests()
        for manifest in manifests:
            manifest['manifest_dir'] = None
            if 'documentation' in manifest:
                del manifest['documentation']['config_path']
                del manifest['documentation']['path']
            #if 'tests' in manifest:
            #    del manifest['tests']['config_path']
            #    del manifest['tests']['path']
        self.return_ok(request, data = { 'response': manifests })

    def get_requested_manifest(self, request):
        manifests = self.list_all_manifests()
        if not 'manifest_id' in request.args:
            self.return_forbidden(request)
            return
        manifest_id = request.args['manifest_id'][0]

        manifest = None
        for _manifest in manifests:
            if (_manifest['id'] == manifest_id):
                manifest = _manifest
                break

        if not manifest:
            self.return_internal_error(request) # 'Manifest not found'
            return

        return manifest

    def build_doc(self, request):
        """ Generate documentation from config file.
        """
        manifest = self.get_requested_manifest(request)

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

        config['built'] = os.path.exists(config['path']);

        self.return_ok(request, data = { "response": config })


    def start_test(self, request):
        manifest = self.get_requested_manifest(request)

        if not 'id' in request.args:
            self.return_forbidden(request)
            return

        test_id = request.args['id'][0]
        test = manifest['tests'][int(test_id)]

        if not test:
            self.return_not_found(request)
            return

        logging.debug('running test %s from %s' % (test_id, manifest['name']))

        cmd_str = 'node lib/tests/run.js %s %s ' % (test['type'], test['config'])
        # cmd_str += '--reporters junit '
        cmd_str += '--output-directory=%s ' % (test['path'])
        cmd_str += '--log-stdout '
        if 'params' in request.args:
            cmd_str += '--params=\'%s\' ' % request.args['params'][0]
        if 'singlerun' in request.args:
            cmd_str += '--single-run'
        logging.debug('Exec %s' % cmd_str)

        def output_cb(strs):
            logging.debug(strs);
            #self.return_ok(request)

        self.execute(cmd_str, output_cb)
        self.return_ok(request)

        # out, err = cmd.communicate()
        # logging.debug(out);
        # if cmd.returncode != 0:
        #     logging.debug('Non-zero exit status %s' % err)
        #     self.return_internal_error(request)
        #     return
        # config['build_output'] = out;
        # config['have_been_run'] = os.path.exists(config['path']);
        # self.return_ok(request, data = { "response": config })


    def execute(self, cmd_str, output_cb):
        def enqueue_output(out):
            for line in iter(out.readline, b''):
                output_cb(line);
            out.close()

        p = Popen([cmd_str], stdout=PIPE, stderr=PIPE, bufsize=1, shell=True)
        t = Thread(target=enqueue_output, args=[p.stdout])
        t.daemon = True # thread dies with program
        t.start()



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
        },
    {
        "prefix": "devtools/api/build_doc",
        'methods': ['POST'],
        'require_auth': True,
        'require_token': False,
        'handler': DevToolsApp.build_doc,
        'accept':['application/json'],
        'content-type':'application/json'
        },
    {
        "prefix": "devtools/api/start_test",
        'methods': ['POST'],
        'require_auth': True,
        'require_token': False,
        'handler': DevToolsApp.start_test,
        'accept':['application/json'],
        'content-type':'application/json'
        }
]


APP = DevToolsApp