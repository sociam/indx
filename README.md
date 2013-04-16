## WebBox

WebBox is a personal file store being developed by @danielsmith-eu and @electronicmax at the University of Southampton, for the SOCIAM project.

Installation and API documentation can be found on the WebBox wiki:
https://github.com/danielsmith-eu/webbox/wiki

WebBox is licensed under the GPLv3. See COPYING for more details.


### Installation

Run `./setup-env.sh` to create a new `virtualenv` and install the webbox dependencies:

    ./setup-env.sh

Next run the following to add the library directories to your virtualenv path:

    echo 'export PYTHONPATH="$VIRTUAL_ENV/../libs:$VIRTUAL_ENV/../pywebbox:$PYTHONPATH"' >> env/bin/activate

Now, source the virtualenv:

    source env/bin/activate

Now, run webbox with your PostgreSQL authentication username and hostname:

    python app.py <username> <hostname>

(It will prompt for your postgresql password).



