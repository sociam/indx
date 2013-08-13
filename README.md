### welcome + introduction

Welcome to INDX.

INDX is a personal data store (PDS) that is designed for long-term
secure, personal data storage. As data becomes people's most valuable
asset, it has become increasingly important that they are able to keep
their data safely accessible to them over the years and even decades.

We believe that giving users the power to maintain and secure the
future of their data is the best way to grant people this access.
People are the best informationc controllers for their own data,
because they can ultimately decide and determine how and where it is
stored, and to what degree it is protected - whether this data be of
their family photos, their personal medical histories, bitcoin
wallets, financial records, or simply important notes, web bookmarks,
old receipts, and favourite quotes and bookmarks.  

Putting people in control of their own data is the INDX approach.

## license and terms of use

INDX is primarily licensed free for non-commercial use under the AGPL
(see COPYING for full terms of use and details). We offer licenses for
commercial use on individual basis; please see contact details below.

In particular, as is the case with most AGPL programs, THIS PROGRAM IS
PROVIDED "AS IS" WITHOUT A WARRANTY OF ANY KIND, EITHER EXPRESSED OR
IMPLIED. SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL
NECESSARY SERVICING, REPAIR OR CORRECTION, OR CONSEQUENCES INCLUDING,
BUT NOT LIMITED TO, DATA LOSS, OR DAMAGE INCURRED.

That being said, we hope you do not occur any data loss or damage; 
as the whole point of this program is to help people store their data
with minimal risk or worry.

### authors and credits

chief data architect: Daniel A. Smith (@danielsmith-eu)
lead platform design: Max Van Kleek aka eMax (@emax)
engineering lead: Peter G. West

mentor/supervisors: Sir Nigel Shadbolt, Sir Tim Berners-Lee, Dame
Wendy Hall other contributors: Members of the SOCIAM Group, University
of Southampton (see http://sociam.org)

Inspiration for this work derived from several sources; both from
eMax's Ph.D. work in Personal Information Management (PIM) and Dan's
Ph.D. work on linked data platforms and semantic web (SW) interfaces
heavily informed the design.

Sir Tim Berners-Lee has and continues to advise on aspects of the
system and protcol design. The project is managed and closely
supervised by Prof. Sir Nigel Shadbolt and Prof. Dame Wendy Hall.


### installation

Install PostgreSQL, e.g. on a Mac you could use: http://postgresapp.com/

Run `./setup.sh` to create a new `virtualenv` and install the INDX dependencies:

    ./setup.sh

Now, source the virtualenv:

    source env/bin/activate

Now, run the INDX server with your PostgreSQL authentication username and hostname:

    python bin/server.py <username> <hostname>

(It will prompt for your postgresql password).

If you wish to specify additional configuration, you can get the list using `--help`:

    python bin/server.py --help

Usage will be printed:

    usage: server.py [-h] [--db-host DB_HOST] [--db-port DB_PORT] [--log LOG]
                  [--port PORT] [--log-stdout] [--ssl] [--ssl-cert SSL_CERT]
                  [--ssl-key SSL_KEY] [--no-browser] [--address ADDRESS]
                  user hostname

    Run an INDX server.

    positional arguments:
      user                 PostgreSQL server username, e.g. indx
      hostname             Hostname of the INDX server, e.g. indx.example.com

    optional arguments:
      -h, --help           show this help message and exit
      --db-host DB_HOST    PostgreSQL host, e.g. localhost
      --db-port DB_PORT    PostgreSQL port, e.g. 5432
      --log LOG            Location of logfile e.g. /tmp/indx.log
      --port PORT          Override the server listening port
      --log-stdout         Also log to stdout?
      --ssl                Turn on SSL
      --ssl-cert SSL_CERT  Path to SSL certificate
      --ssl-key SSL_KEY    Path to SSL private key
      --no-browser         Don't load a web browser after the server has started
      --address ADDRESS    Specify IP address to bind to

More installation and API documentation can be found on the INDX wiki:

https://github.com/sociam/indx/wiki

## contact us

If you have any further questions or comments, contact the INDX team
at team@indx.es. For enquires concerning commercial licensing, please
contact commercial@indx.es.

Follow us on twitter at @indxes ! 

## end
