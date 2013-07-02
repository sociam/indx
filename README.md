## INDX

INDX is a personal file store being developed by @danielsmith-eu and @electronicmax at the University of Southampton, for the SOCIAM project.

Installation and API documentation can be found on the INDX wiki:
https://github.com/sociam/indx/wiki

INDX is licensed under the GPLv3. See COPYING for more details.


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

If you wish to specify additional configuration, you can get the list using `--help`:

    python app.py --help

Usage will be printed:

    usage: app.py [-h] [--db-host DB_HOST] [--db-port DB_PORT] [--log LOG]
                  [--port PORT] [--log-stdout] [--ssl] [--ssl-cert SSL_CERT]
                  [--ssl-key SSL_KEY] [--no-browser] [--address ADDRESS]
                  user hostname

    Run an INDX server.

    positional arguments:
      user                 PostgreSQL server username, e.g. indx
      hostname             Hostname of the webbox server, e.g. indx.example.com

    optional arguments:
      -h, --help           show this help message and exit
      --db-host DB_HOST    PostgreSQL host, e.g. localhost
      --db-port DB_PORT    PostgreSQL port, e.g. 5432
      --log LOG            Location of logfile e.g. /tmp/webbox.log
      --port PORT          Override the server listening port
      --log-stdout         Also log to stdout?
      --ssl                Turn on SSL
      --ssl-cert SSL_CERT  Path to SSL certificate
      --ssl-key SSL_KEY    Path to SSL private key
      --no-browser         Don't load a web browser after the server has started
      --address ADDRESS    Specify IP address to bind to



