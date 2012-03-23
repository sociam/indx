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


# sets up configuration for the current user

import os, shutil, json, getpass, re

webbox_dir = os.path.expanduser('~'+os.sep+".webbox")

if not os.path.exists(webbox_dir):
    # no config for this user, set them up
    os.makedirs(webbox_dir)

    data_dir = webbox_dir + os.sep + "data" # default data directory
    os.makedirs(data_dir)

    sub_dirs = ["logs", "rww", "files", "journals"] # subdirectories to data to make
    for sub_dir in sub_dirs:
        sub_dir_path = data_dir + os.sep + sub_dir
        os.makedirs(sub_dir_path)

    # copy default config
    webbox_config = webbox_dir + os.sep + "webbox.json"
    shutil.copyfile('webbox.json.default', webbox_config)

    # copy default localhost certificates
    shutil.copyfile('data'+os.sep+'server.crt', data_dir+os.sep+'server.crt')
    shutil.copyfile('data'+os.sep+'server.key', data_dir+os.sep+'server.key')

    # set up per user options in config
    conf_fh = open(webbox_config, "r")

    # load the json, parsing out comments manually
    comment_re = re.compile(r'#.*$')
    config_lines = ""
    for line in conf_fh.readlines():
        line = re.sub(comment_re, '', line)
        config_lines += line
    conf_fh.close()

    config = json.loads(config_lines)

    # 4store kb based on username
    config['4store']['kbname'] = "webbox_" + getpass.getuser() # per user knowledge base

    # write updated config
    conf_fh = open(webbox_config, "w")
    json.dump(config, conf_fh)
    conf_fh.close()


