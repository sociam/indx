# How to compile and install 4store from the latest GIT HEAD under OS X

## Requires:

homebrew (see webbox wiki for instructions on how to install)

gcc (from Apple XCode, see webbox wiki for instructions on how to get)

git

## Versions tested:

4store from GIT 06/07/2012

raptor 2.0.7

rasqal-0.9.29

### raptor

    ./configure
    make
    sudo make install

Output:

    Raptor build summary:
      RDF parsers available     : rdfxml ntriples turtle trig guess rss-tag-soup rdfa nquads grddl
      RDF parsers enabled       : rdfxml ntriples turtle trig guess rss-tag-soup rdfa nquads grddl
      RDF serializers available : rdfxml rdfxml-abbrev turtle ntriples rss-1.0 dot html json atom nquads
      RDF serializers enabled   : rdfxml rdfxml-abbrev turtle ntriples rss-1.0 dot html json atom nquads
      XML parser                : libxml 2.7.3
      WWW library               : libcurl 7.19.7
      NFC check library         : none

### rasqal

    ./configure --enable-query-languages='sparql rdql laqrs'
    make
    sudo make install

Output:

    Rasqal build summary:
      RDF query languages available : rdql sparql laqrs
      RDF query languages enabled   : sparql rdql laqrs
      Raptor version                : 2.0.7
      Decimal library               : none
      Regex library                 : posix
      Message digest library        : internal
      UUID library                  : internal
      Random approach               : Internal Mersenne Twister

### dependencies

    brew install glib

Get new 4store from github.com/garlik git:

    cd /Users/das05r/code/4store
    git pull upstream master
    ./autogen.sh      # to make configure 
    ./configure --prefix=/Users/das05r/code/4store-prefix/
    make LDFLAGS=-all-static
    sudo make install

Output:

    Configuration status:
      Cluster support available through mDNS or 4s-boss
      Using Raptor version 2.0.7
      Using Rasqal version 0.9.29

### Bonus:

If you look in 4store/app-aux you can run build-static.pl to compile static versions of 4store (as shipped with the webbox DMG.)
