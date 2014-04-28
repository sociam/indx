/* jshint undef: true, strict:false, trailing:false, unused:false */
/* global require, exports, console, process, module */

/**
 *  Moves Service for INDX ---
 *   (c) 2014 - Max Van Kleek, University of Southampton 
 * 
 *  This is an INDX service that grabs data from moves app: https://dev.moves-app.com/
 *  Complies with INDX Entity Semantics 1.0 for People, Places, and Activities
 */

var nodeindx = require('../lib/services/nodejs/nodeindx'),
    u = nodeindx.utils,
    _ = require('underscore'),
    jQuery = require('jquery'),
    path = require('path'),
    https = require('https'),
    angular = require('angular'),
    injector = nodeindx.injector;

module.exports = {
    connect: function(host, user, pass) {
        if (!host) { 
            var args = this.get_args();
                host = args.host;
                user = args.user;
                pass = args.pass;
        }   
        console.log('connecting to ', host , ' as ', user , ' password: ', pass);
        return nodeindx.login(host,user,pass);
    },
    get_args : function() {
        var env = process.env,
            host = env.host,
            user = env.user,
            pass = env.pass;
        if (!host || !user || !pass) {
            console.error('ERROR please supply host, username and password');
            console.error('--config host http://url-to-indx --config user <username> --config pass <password>');
            return;
        }
        console.log('host ', host, '- user ', user, ' - pass', pass);
        return env;
    }
};

if (require.main === module) {
    console.log('npm install -g jasmine-node and ');
    console.log('jasmine-node spec/');
}


