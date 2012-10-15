#    This file is part of WebBox.
#
#    Copyright 2012 Daniel Alexander Smith
#    Copyright 2012 University of Southampton
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

import os, shutil, re, json

class WebBoxSetup:
    """ Class to set up webbox directories/configurations. """

    def __init__(self):
        pass

    def setup(self, webbox_dir, webbox_default_config_file, kbname, fs_port=8212, ws_port=8214):
        """ Setup a webbox directory from defaults if it doesn't exist. """

        if not os.path.exists(webbox_dir): # no config for this user, set them up
            os.makedirs(webbox_dir)

        sub_dirs = ["files"] # subdirectories in webbox dir to make
        for sub_dir in sub_dirs:
            sub_dir_path = webbox_dir + os.sep + sub_dir
            if not os.path.exists(sub_dir_path):
                os.makedirs(sub_dir_path)

        webbox_config = webbox_dir + os.sep + "webbox.json"

        init_config = False # initialise config from defaults?
        if not os.path.exists(webbox_config):
            init_config = True
        else:
            # config exists, but is it non-versioned?
            conf_fh = open(webbox_config, "r")
            config = json.load(conf_fh)
            conf_fh.close()

            if "version" not in config:
                init_config = True


        # copy default config
        if init_config:
            shutil.copyfile(webbox_default_config_file, webbox_config)

            # set up per user options in config
            conf_fh = open(webbox_config, "r")
            # load the json
            config = json.load(conf_fh)
            conf_fh.close()

            # set webbox db based on username
            config['webbox']['db']['name'] = kbname

            # add 4store kb based on username
            config['webbox']['4store']['kbname'] = kbname

            # set ports
            config['webbox']['4store']['port'] = fs_port
            config['webbox']['ws_port'] = ws_port

        # add additions (defaults) to config here, so configs are automatically upgraded when new additions are made
        change_config = False
        version = config['version']
        if version == 1:
            # set change_config to True to save the changes
            pass

        # write updated config
        if init_config or change_config:
            conf_fh = open(webbox_config, "w")
            json.dump(config, conf_fh, indent=4)
            conf_fh.close()

    

