import logging, json, argparse, sys, os, uuid, urllib2
import logging.config
import keyring, keyring.util.platform_
from keyring.backends.pyfs import PlaintextKeyring
from indxclient import IndxClient, IndxClientAuth
from twisted.internet.defer import Deferred
from twisted.internet import reactor, threads
import oauth2 as oauth
from time import sleep
from datetime import date, datetime, timedelta, time
from nikeplus import NikePlus

class NikeHarvester:

    def __init__(self):
        log_handler = logging.FileHandler("nikeplus_harvester.log", "a")
        log_handler.setLevel(logging.DEBUG)
        formatter = logging.Formatter('%(name)s\t%(levelname)s\t%(asctime)s\t%(message)s')
        log_handler.setFormatter(formatter)
        self.logger = logging.getLogger() 
        self.logger.setLevel(logging.DEBUG)
        for handler in self.logger.handlers: 
            self.logger.removeHandler(handler)
        self.logger.addHandler(log_handler)
    
        data_root = keyring.util.platform_.data_root()
        if not os.path.exists(data_root):
            os.mkdir(data_root)
        keyring.set_keyring(PlaintextKeyring())

        self.parser = argparse.ArgumentParser(prog="run")
        self.parser.add_argument('--config', help="Set config (input requires JSON) and exit.")
        self.parser.add_argument('--get-config', action="store_true", help="Output current config as JSON and exit.")
        self.parser.add_argument('--server', help="The server URL to connect to.")

        self.nike = NikePlus()

        self.box_version = 0

        self.harvester_id = "nikeplus_harvester"
        self.fuel_ts_id = "nikeplus_fuel_ts"
        self.calories_ts_id = "nikeplus_calories_ts"
        self.steps_ts_id = "nikeplus_steps_ts"
        self.stars_ts_id = "nikeplus_stars_ts"
        self.ts_ids_by_type = {'FUEL':self.fuel_ts_id, 'CALORIES':self.calories_ts_id, 'STEPS':self.steps_ts_id, 'STARS':self.stars_ts_id }
        self.ts_count = 0
        self.ts_error = None

        self.rdf_types = {
            'FUEL':'http://sociam.org/ontology/health/NikeFuel',
            'CALORIES':'http://sociam.org/ontology/health/CaloriesBurned',
            'STEPS':'http://sociam.org/ontology/health/StepCount',
            'STARS':'http://sociam.org/ontology/health/Intensity'
        }

        self.zeros = self.today()
        self.new_zeros = self.today()
        self.retrieved = self.today()
        self.config_box = None
        self.config_indx_user = None
        self.config_indx_pass = None
        self.config_max_date = datetime(2013, 10, 1)

    def set_config(self, args):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Nike_Harvester")
        if stored_config_harvester is not None:
            stored_config_harvester = json.loads(stored_config_harvester)
        stored_config_nike = keyring.get_password("Nike.com", "Nike+")
        if stored_config_nike is not None:
            stored_config_nike = json.loads(stored_config_nike)

        received_config = json.loads(args['config'])
        if (type(received_config) != dict):
            received_config = json.loads(received_config)
        self.logger.debug("Received config: {0}".format(received_config))
        if 'nike' in received_config:
            nike_config = received_config['nike']
            if nike_config and ('user' in nike_config) and ('password' in nike_config): 
                self.logger.debug("Received user: {0} and password: {1}".format(nike_config['user'], nike_config['password']))
                try:
                    self.nike.login(nike_config['user'], nike_config['password'])
                    self.logger.debug("Logged in with username {0} and password {1}".format(nike_config['user'], nike_config['password']))
                    token = self.nike.get_token()
                    self.logger.debug("Got token {0}".format(token))
                    if token:
                        nike_config['token'] = token
                        if 'error' in nike_config:
                            del nike_config['error']
                except Exception as exc:
                    self.logger.error("Could not authorise to Nike, with username {0} and password {1},  error: {2}".format(nike_config['user'], nike_config['password'], exc))
                    nike_config['error'] = str(exc)
                    del nike_config['password']
                keyring.set_password("Nike.com", "Nike+", json.dumps(nike_config))
        if 'harvester' in received_config:
            harvester_config = received_config['harvester']
            if harvester_config != stored_config_harvester:
                keyring.set_password("INDX", "INDX_Nike_Harvester", json.dumps(harvester_config)) 

    def get_config(self, args):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Nike_Harvester")
        stored_config_nike = keyring.get_password("Nike.com", "Nike+")

        self.logger.debug("Loaded harvester config from keyring: {0}".format(stored_config_harvester))
        self.logger.debug("Loaded nike config from keyring: {0}".format(stored_config_nike))

        if stored_config_nike is not None :
            if stored_config_harvester is None :
                return json.dumps({"nike":json.loads(stored_config_nike)}) 
            return json.dumps({"nike":json.loads(stored_config_nike), "harvester":json.loads(stored_config_harvester)}) 
        if stored_config_harvester is not None :
            return json.dumps({"harvester":json.loads(stored_config_harvester)}) 
        return json.dumps({})

    def load_configuration(self):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Nike_Harvester")
        self.logger.debug("Loaded harvester config from keyring: {0}".format(stored_config_harvester))
        if stored_config_harvester is None :
            self.logger.error("Harvester not configured. Please configure before use.")
            return
        if (type(stored_config_harvester) != dict):
            stored_config_harvester = json.loads(stored_config_harvester)

        stored_config_nike = keyring.get_password("Nike.com", "Nike+")
        self.logger.debug("Loaded nike config from keyring: {0}".format(stored_config_nike))

        if stored_config_nike is None :
            self.logger.error("No credentials for Nike.com. Please configure before use.")
            return
        else :
            if (type(stored_config_nike) != dict):
                stored_config_nike = json.loads(stored_config_nike)
            if ('password' in stored_config_nike) and ('user' in stored_config_nike):
                self.config_nike_user = stored_config_nike['user']
                self.config_nike_pass = stored_config_nike['password']    
                if not self.try_nike_login():
                    return
        self.config_box = stored_config_harvester['box']
        self.config_indx_user = stored_config_harvester['user']
        self.config_indx_pass = stored_config_harvester['password']

    def try_nike_login(self):        
        try:
            self.nike.login(self.config_nike_user, self.config_nike_pass)
            self.logger.debug("Logged in with username {0} and password {1}".format(self.config_nike_user, self.config_nike_pass))
            token = self.nike.get_token()
            if token :
                self.logger.debug("Got token {0}".format(token))
                return True
            else :
                return False
        except Exception as exc: 
            self.logger.error("Could not authorise to nike, error: {0}".format(exc))
            return False

    def run(self):
        args = vars(self.parser.parse_args())
        self.logger.debug("Received arguments: {0}".format(args))
        if args['config']:
            self.set_config(args)
        elif args['get_config']:
            print self.get_config(args)
        else:
            self.logger.debug("Starting the harvester. ")
            self.work(args['server'])
            reactor.run()

    def yesterday(self):
        return datetime.combine((datetime.now()+timedelta(days=-1)).date(), time(00,00,00))

    def today(self):
        return datetime.combine(datetime.now().date(), time(00,00,00))

    def get_indx(self, server_url):
        indx_d = Deferred()

        def authed_cb(): 
            def token_cb(token):
                indx = IndxClient(server_url, self.config_box, "INDX_Nike_Harvester", token = token, client = authclient.client)
                indx_d.callback(indx)

            authclient.get_token(self.config_box).addCallbacks(token_cb, indx_d.errback)
            
        authclient = IndxClientAuth(server_url, "INDX_Nike_Harvester")
        authclient.auth_plain(self.config_indx_user, self.config_indx_pass).addCallbacks(lambda response: authed_cb(), indx_d.errback)
        return indx_d

    def work(self, server_url):
        self.load_configuration()

        def indx_cb(indx):
            self.logger.debug("Created INDXClient.")
            prep_d = Deferred()

            if self.try_nike_login():
                self.logger.debug("Successfully logged in to Nike.com.")
            else:
                self.logger.error("Failed to log in to Nike.com.")
                prep_d.errback("Failed to log in to Nike.com.")
                
            def objects_cb(harvester, indx=indx):
                self.logger.debug("Found or created all 4 time series.")
                self.logger.debug("Found or created harvester. {0}".format(harvester))

                def wait(x):
                    self.logger.debug("Harvested! Suspending execution for 6 hours at {0}.".format(datetime.now().isoformat()))
                    sleep(21600)
                    prep_d.callback(None)

                if harvester:
                    if "zeros_from" in harvester :
                        self.zeros = datetime.strptime(harvester["zeros_from"][0]["@value"], "%Y-%m-%dT%H:%M:%S")
                    if "retrieved_to" in harvester :
                        self.retrieved = datetime.strptime(harvester["retrieved_to"][0]["@value"], "%Y-%m-%dT%H:%M:%S")
                    self.harvest(indx, harvester).addCallbacks(wait, prep_d.errback)                    

            self.find_create(indx, self.steps_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Nike+ Steps Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"}).addCallbacks(
                lambda x: self.find_create(indx, self.calories_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Nike+ Calories Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"}), prep_d.errback).addCallbacks(
                lambda x: self.find_create(indx, self.stars_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Nike+ Stars Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"}), prep_d.errback).addCallbacks(
                lambda x: self.find_create(indx, self.fuel_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Nike+ Fuel Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"}), prep_d.errback).addCallbacks(
                lambda x: self.find_create(indx, self.harvester_id, {"http://www.w3.org/2000/01/rdf-schema#label":"INDX Nike+ Harvester extra info"}), prep_d.errback).addCallbacks(objects_cb, prep_d.errback)   
            return prep_d

        def indx_fail_cb(f):
            self.logger.error("Error getting indx! Exiting... {0}".format(f))
            sys.exit(1)

        def loop_fail_cb(f):
            self.logger.error("Error in indx_cb! Exiting... {0}".format(f))
            sys.exit(1)

        def loop(x=None):
            self.get_indx(server_url).addCallbacks(indx_cb, indx_fail_cb).addCallbacks(loop, loop_fail_cb)

        threads.deferToThread(loop)

    def harvest(self, indx, harvester):
        self.logger.debug("Starting to harvest!")
        harvest_d = Deferred()

        def step_day(x, day, indx=indx, harvester=harvester):
            self.logger.debug("Current day: {0}".format(day))

            if day < self.config_max_date :
                self.logger.debug("Finished harvesting round. Saving harvester data .. ")
                harvester["retrieved_to"] = self.retrieved.isoformat()
                harvester["zeros_from"] = self.new_zeros.isoformat()
                self.safe_update(indx, harvester).addCallbacks(harvest_d.callback, harvest_d.errback)
            else:
                prev_day = day + timedelta(days=-1)
                next_day = day + timedelta(days=+1)
                if self.retrieved <= day and next_day < self.zeros :
                    self.step_day(None, prev_day, indx, harvester)
                else: 
                    self.get_day_points(indx, day).addCallbacks(step_day, harvest_d.errback, callbackArgs=[prev_day, indx])

        self.logger.debug("Retrieved to : {0}, Zeros from : {1}".format(self.retrieved.isoformat(), self.zeros.isoformat()))
        step_day(None, self.yesterday(), indx)

        return harvest_d

    def get_day_points(self, indx, day):
            self.logger.debug("Getting data for {0}".format(day.isoformat()))
            process_d = Deferred()

            activities = self.nike.get_day_activities(day.strftime("%Y-%m-%d"))
            next_day = day + timedelta(days=+1)
            points = []
            if len(activities) == 0 :
                self.logger.debug("No data for activities, nothing saved to indx.")
                if next_day == self.new_zeros :
                    self.new_zeros = day
            else :
                # best case, just take the start date and count from there .. 
                self.logger.debug("Single activity. Getting details.")
                activity_id = activities[0]['activityId']
                self.logger.debug("Got activity id: {0}".format(activity_id))
                activity = self.nike.get_activity_detail(activity_id)
                self.logger.debug("Got activity details: {0}".format(activity))
                points = self.prepare_points(activity)

            if next_day == self.retrieved :
                self.retrieved = day

            if len(points) > 0 :
                self.safe_update(indx, points).addCallbacks(process_d.callback, process_d.errback)
            else :
                process_d.callback(0)

            return process_d

    def prepare_points(self, activity):
        self.logger.debug("Started creating data points.")
        data_points = []
        metrics = activity['metrics']
        start = datetime.strptime(activity['startTime'],"%Y-%m-%dT%H:%M:%SZ")
        for metric in metrics :
            values = metric['values']
            mtype = metric['metricType']
            minute = 0
            for value in values :
                interval_start = start + timedelta(minutes=minute) 
                interval_end = interval_start+timedelta(minutes=1) 
                data_point = {  "@id": "nikeplus_dp_{0}".format(uuid.uuid4()), 
                                    "start": interval_start.isoformat(),
                                    "end": interval_end.isoformat(),
                                    "value": value,
                                    "timeseries": { "@id": self.ts_ids_by_type[mtype] }, 
                                    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": { "@id": self.rdf_types[mtype] } }
                data_points.append(data_point)
                # self.logger.debug("Created data point ({0}): {1}".format(minute, data_point))
                minute = minute+1
        self.logger.debug("Finished creating data points.")
        return data_points

    def safe_update(self, indx, obj) :
        self.logger.debug("Updating object {0} at box version {1}".format(obj, self.box_version))
        update_d = Deferred()

        def update_cb(resp):
            self.logger.debug("safe_update: received response: {0}".format(resp))
            if resp and "code" in resp and "data" in resp:
                if resp["code"] == 201 or resp["code"] == 200:
                    self.box_version = resp["data"]["@version"]
                    self.logger.debug("Updated objects! new box version: {0}".format(self.box_version))
                    update_d.callback(self.box_version)
                else:
                    self.logger.debug("Received unknown response code {0}".format(resp))
                    update_d.errback(resp)
            else:
                self.logger.debug("Received unknown or no response {0}".format(resp))
                update_d.errback(resp)

        def exception_cb(e, obj=obj, indx=indx):
            self.logger.error("EXCEPTION ? {0}".format(e))
            if isinstance(e.value, urllib2.HTTPError): # handle a version incorrect error, and update the version
                if e.value.code == 409: # 409 Obsolete
                    response = e.value.read()
                    json_response = json.loads(response)
                    self.box_version = json_response['@version']
                    # self.safe_update(indx, obj).addCallbacks(reupdate_cb, update_d.errback) # try updating again now the version is correct
                    indx.update(self.box_version, obj).addCallbacks(update_cb, exception_cb)
                else:
                    self.logger.error("HTTPError updating INDX: {0}".format(e.value))
                    update_d.errback(e.value)
            else:
                self.logger.error("Error updating INDX: {0}".format(e.value))
                update_d.errback(e.value)

        indx.update(self.box_version, obj).addCallbacks(update_cb, exception_cb)
        return update_d

    def find_by_id(self, indx, oid) :
        self.logger.debug("Searching object by id {0}".format(oid))
        find_d = Deferred()

        def find_cb(resp):
            self.logger.debug("find_by_id: received response: {0}".format(resp))
            if resp and "code" in resp and resp["code"] == 200 and "data" in resp:
                resp_data = resp["data"]
                if oid in resp_data:
                    self.logger.debug("Object {0} found!".format(oid))
                    find_d.callback(resp_data[oid])
                else:
                    self.logger.debug("Object {0} not found!".format(oid))
                    find_d.callback(None)
            else:
                self.logger.debug("Response code is not 200! respose: {0}".format(resp))
                find_d.errback(resp) # put a useful error here!
        
        indx.query(json.dumps({"@id": oid})).addCallbacks(find_cb, find_d.errback)
        return find_d

    def find_create(self, indx, oid, attrs={}):
        self.logger.debug("Searching for id: {0} and attrs: {1}".format(oid, attrs))
        create_d = Deferred()

        def find_cb(obj):

            if obj is None:
                self.logger.debug("Object {0} not found! Creating it.".format(oid))
                attrs.update({"@id":oid})
                self.safe_update(indx, attrs).addCallbacks(lambda x: create_d.callback(attrs), create_d.errback) 
            else:
                create_d.callback(obj)
        
        self.find_by_id(indx, oid).addCallbacks(find_cb, create_d.errback)
        return create_d

if __name__ == '__main__':
    harvester = NikeHarvester()
    harvester.run();
