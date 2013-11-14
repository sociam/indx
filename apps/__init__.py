## module loader, goes to see which submodules have 'html' directories
## and declares them at the toplevel

import os,importlib,logging

def find_module_dirs():
    curdir = os.path.dirname(os.path.abspath(__file__))
    subdirs = [o for o in os.listdir(curdir) if os.path.exists(os.path.sep.join([curdir,o,'__init__.py']))]
    logging.debug("module dirs: {0}".format(subdirs))
    return subdirs

def find_html_dirs():
    curdir = os.path.dirname(os.path.abspath(__file__))
    subdirs = [(o,os.path.sep.join([curdir,o,'html'])) for o in os.listdir(curdir) if os.path.exists(os.path.sep.join([curdir,o,'html']))]
    return dict(subdirs)

def import_app(app):
    try:
        logging.debug("importing app: {0}".format(app))
        return importlib.import_module(app)
    except Exception as e:
        logging.error("Couldn't load app: {0}, error: {1}".format(app, e))

BASEDIR = os.path.dirname(os.path.abspath(__file__))
MODULES = {}
_html_dirs = find_html_dirs()
[ MODULES.update({m_name:{'module': import_app('.'.join(['apps',m_name])), 'html':_html_dirs.get(m_name)}}) for m_name in find_module_dirs() ]

