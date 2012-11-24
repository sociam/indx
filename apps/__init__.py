## module loader, goes to see which submodules have 'html' directories
## and declares them at the toplevel

import os

def find_module_dirs():
    curdir = os.path.dirname(os.path.abspath(__file__))
    subdirs = [o for o in os.listdir(curdir) if os.path.exists(os.path.sep.join([curdir,o,'__init__.py']))]
    return subdirs

def find_html_dirs():
    curdir = os.path.dirname(os.path.abspath(__file__))
    subdirs = [(o,os.path.sep.join([curdir,o,'html'])) for o in os.listdir(curdir) if os.path.exists(os.path.sep.join([curdir,o,'html']))]
    return dict(subdirs)

MODULES = {}
_html_dirs = find_html_dirs()
[ MODULES.update({m_name:{'app':__import__('.'.join(['apps',m_name])), 'html':html_dirs.get(m_name)}}) for m_name in find_module_dirs() ]

