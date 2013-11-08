#!/bin/sh
mkdir html-doc-tmp
sphinx-apidoc -F -o html-doc-tmp lib/indx
cd html-doc-tmp
make html
cd _build/html
python -mSimpleHTTPServer 2345
