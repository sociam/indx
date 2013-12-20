import logging, json, argparse, sys, os, uuid, urllib2
import keyring, keyring.util.platform_
from keyring.backends.pyfs import PlaintextKeyring
from fitbit import Fitbit, FitbitIntraDay
from indxclient import IndxClient, IndxClientAuth
import oauth2 as oauth
from time import sleep
from datetime import date, datetime, timedelta, time
from twisted.internet.defer import Deferred
from twisted.internet import reactor, threads

class FitbitHarvester:

    def __init__(self):
        log_handler = logging.FileHandler("fitbit_harvester.log", "a")
        log_handler.setLevel(logging.DEBUG)
        formatter = logging.Formatter('%(name)s\t%(levelname)s\t%(asctime)s\t%(message)s')
        log_handler.setFormatter(formatter)
        self.logger = logging.getLogger() 
        self.logger.setLevel(logging.DEBUG)
        for handler in self.logger.handlers: # remove default handler
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

        # init fitbit
        consumer_key = "9cc7928d03fa4e1a92eda0d01ede2297"
        consumer_secret = "340ea36a974e47738a335c0cccfe1fcf"
        self.fitbit = Fitbit(consumer_key, consumer_secret)
        self.fitbit_intraday = None

        self.box_version = 0

        self.config_overwrite = False;
        self.config_start = self.today()
        self.config_box = None
        self.config_indx_user = None
        self.config_indx_pass = None
        self.config_fetched_days = []
        self.config_zeros_from = self.today()

        self.harvester_id = "fitbit_harvester"
        self.steps_ts_id = "fitbit_steps_ts"
        self.calories_ts_id = "fitbit_calories_ts"
        self.distance_ts_id = "fitbit_distance_ts"
        self.floors_ts_id = "fitbit_floors_ts"
        self.elevation_ts_id = "fitbit_elevation_ts"

        self.ts_count = 0
        self.ts_error = None
        
    def set_config(self, args):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Fitbit_Harvester")
        if stored_config_harvester is not None:
            stored_config_harvester = json.loads(stored_config_harvester)
        stored_config_fitbit = keyring.get_password("Fitbit.com", "Fitbit")
        if stored_config_fitbit is not None:
            stored_config_fitbit = json.loads(stored_config_fitbit)

        received_config = json.loads(args['config'])
        if (type(received_config) != dict):
            received_config = json.loads(received_config)
        self.logger.debug("Received config ({0}): {1}".format(type(received_config), received_config))
        config = {}
        if 'fitbit' in received_config:
            fitbit_config = received_config['fitbit']
            if fitbit_config and ('pin' in fitbit_config) and ('req_token' in fitbit_config): # this should check for the req_token in the stored config!
                self.logger.debug("Received pin: {0}".format(fitbit_config['pin']))
                try:
                    token = self.fitbit.get_token_with_pin(fitbit_config['pin'], fitbit_config['req_token'])
                    self.logger.debug("Got auth token {0}, of type {1}".format(token, type(token)))
                    if token:
                        config['token']=token
                        keyring.set_password("Fitbit.com", "Fitbit", json.dumps(config))
                except Exception as exc:
                    self.logger.error("Could not authorise to fitbit, with pin {0}, error: {1}".format(fitbit_config['pin'], exc))
        if 'harvester' in received_config:
            harvester_config = received_config['harvester']
            if harvester_config != stored_config_harvester:
                keyring.set_password("INDX", "INDX_Fitbit_Harvester", json.dumps(harvester_config)) 

    def get_config(self, args):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Fitbit_Harvester")
        stored_config_fitbit = keyring.get_password("Fitbit.com", "Fitbit")

        self.logger.debug("Loaded harvester config from keyring: {0}".format(stored_config_harvester))
        self.logger.debug("Loaded fitbit config from keyring: {0}".format(stored_config_fitbit))

        if stored_config_fitbit is None :
            token_url = self.fitbit.get_token_url()
            config_fitbit = {}
            config_fitbit["url"] = token_url['url']
            config_fitbit["req_token"] = token_url['req_token']
        else :
            if (type(stored_config_fitbit) != dict):
                config_fitbit = json.loads(stored_config_fitbit)
            # if (type(config_fitbit) != dict):
            #     config_fitbit = json.loads(config_fitbit)
            if 'token' not in config_fitbit :
                token_url = self.fitbit.get_token_url()
                config_fitbit["url"] = token_url['url']
                config_fitbit["req_token"] = token_url['req_token']
                keyring.set_password("Fitbit.com", "Fitbit", json.dumps(config_fitbit))
        if stored_config_harvester is None:
            return json.dumps({"fitbit":config_fitbit}) # don't send the req_token
        return json.dumps({"fitbit":config_fitbit, "harvester":json.loads(stored_config_harvester)}) # don't send the req_token

    def load_configuration(self):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Fitbit_Harvester")
        self.logger.debug("Loaded harvester config from keyring: {0}".format(stored_config_harvester))
        if stored_config_harvester is None :
            self.logger.error("Harvester not configured. Please configure before use.")
            return
        if (type(stored_config_harvester) != dict):
            stored_config_harvester = json.loads(stored_config_harvester)

        if self.fitbit.get_token() is None:
            stored_config_fitbit = keyring.get_password("Fitbit.com", "Fitbit")
            self.logger.debug("Loaded fitbit config from keyring: {0}".format(stored_config_fitbit))

            token = None
            if stored_config_fitbit is None :
                self.logger.error("Not authenticated to Fitbit.com. Please configure before use.")
                return
            else :
                if (type(stored_config_fitbit) != dict):
                    stored_config_fitbit = json.loads(stored_config_fitbit)
                if 'token' not in stored_config_fitbit :
                    self.logger.debug("Could not find Fitbit auth token in keyring");
                    if ('pin' in stored_config_fitbit) and ('req_token' in stored_config_fitbit):
                        self.logger.debug("Found pin {0} and req_token in keyring, attempting authorization to Fitbit.com".format(stored_config_fitbit['pin']))
                        try:
                            fitbit_token_config = {}
                            token = self.fitbit.get_token_with_pin(stored_fitbit_config['pin'], stored_fitbit_config['req_token'])
                            if token:
                                self.logger.debug("Got auth token {0}".format(token))
                                # self.logger.debug("Got auth token of type {0}".format(type(token)))
                                fitbit_token_config['token']=token
                            keyring.set_password("Fitbit.com", "Fitbit", json.dumps(fitbit_token_config))
                        except Exception as exc:
                            self.logger.error("Could not authorise to fitbit, error: {1}".format(exc))
                            return
                    else :
                        self.logger.debug("Could not find pin or req_token in keyring. Cannot attempt authorization to Fitbit.com.")
                        return
                else: 
                    token = stored_config_fitbit['token']
            if token is not None :
                self.fitbit.set_token(token)
        self.config_start = datetime.strptime(stored_config_harvester['start'], "%Y-%m-%d")
        self.config_box = stored_config_harvester['box']
        self.config_indx_user = stored_config_harvester['user']
        self.config_indx_pass = stored_config_harvester['password']
        self.config_overwrite = stored_config_harvester['overwrite']

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
                indx = IndxClient(server_url, self.config_box, "INDX_Fitbit_Harvester", token = token, client = authclient.client)
                indx_d.callback(indx)

            authclient.get_token(self.config_box).addCallbacks(token_cb, indx_d.errback)
            
        authclient = IndxClientAuth(server_url, "INDX_Fitbit_Harvester")
        authclient.auth_plain(self.config_indx_user, self.config_indx_pass).addCallbacks(lambda response: authed_cb(), indx_d.errback)
        return indx_d
         
    def work(self, server_url):
        self.load_configuration()
        self.logger.debug("Loaded configuration: box: {0}, user: {1}, pass: {2}, overwrite: {3}, start: {4}".format(self.config_box, self.config_indx_user, self.config_indx_pass, self.config_overwrite, self.config_start.isoformat()))

        self.fitbit_intraday = FitbitIntraDay(self.fitbit)
        self.logger.debug("Created FitbitIntraDay.")

        def indx_cb(indx):
            self.logger.debug("Created INDXClient.")
            prep_d = Deferred()

            def objects_cb(harvester, indx=indx):
                # self.logger.debug("Results for object creation: {0}".format(objs))

                self.logger.debug("Found or created all 5 time series.")
                self.logger.debug("Found or created harvester. {0}".format(harvester))
                
                def wait(x):
                    self.logger.debug("Harvested! Suspending execution for 6 hours at {0}.".format(datetime.now().isoformat()))
                    sleep(21600)
                    prep_d.callback(None)
                
                # harvester = objs[5]
                if harvester:
                    if "zeros_from" in harvester :
                        self.config_zeros_from = datetime.strptime(harvester["zeros_from"][0]["@value"], "%Y-%m-%dT%H:%M:%S")
                        if self.config_start < self.config_zeros_from :
                            if self.config_overwrite :
                                self.config_zeros_from = self.today()
                                self.config_overwrite = False; # will only overwrite the first time if the flag is set
                            else:
                                self.config_start = stored_zeros_from+timedelta(days=-1) 
                    if "fetched_days" in harvester :
                        self.config_fetched_days = self.parse_list(harvester["fetched_days"])

                    self.harvest(indx, harvester).addCallbacks(wait, prep_d.errback)                    

            self.find_create(indx, self.steps_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Steps Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"}).addCallbacks(
                lambda x: self.find_create(indx, self.calories_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Calories Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"}), prep_d.errback).addCallbacks(
                lambda x: self.find_create(indx, self.distance_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Distance Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"}), prep_d.errback).addCallbacks(
                lambda x: self.find_create(indx, self.floors_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Floors Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"}), prep_d.errback).addCallbacks(
                lambda x: self.find_create(indx, self.elevation_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Elevation Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"}), prep_d.errback).addCallbacks(
                lambda x: self.find_create(indx, self.harvester_id, {"http://www.w3.org/2000/01/rdf-schema#label":"INDX Fitbit Harvester extra info"}), prep_d.errback).addCallbacks(objects_cb, prep_d.errback)   
            
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

        def process_cb(day_points, day):
            self.logger.debug("Process day {0}".format(day.isoformat()))
            process_d = Deferred()

            # processing steps
            steps = self.download_steps(day)

            zeros = False
            zeros = self.check_all_zero(steps)
            if zeros :
                self.logger.debug("Step data points are all 0. ")
                if self.config_zeros_from > day:
                    self.config_zeros_from = day
            else :
                self.config_zeros_from = self.today()

            steps_points = self.prepare_points(steps, day_points, day, self.steps_ts_id, "http://sociam.org/ontology/health/StepCount")

            # processing calories
            calories = self.download_calories(day)
            calories_points = self.prepare_points(calories, day_points, day, self.calories_ts_id, "http://sociam.org/ontology/health/CaloriesBurned")
 
            # processing distance
            distance = self.download_distance(day)
            distance_points = self.prepare_points(distance, day_points, day, self.distance_ts_id, "http://sociam.org/ontology/health/Distance")

            # processing floors
            floors = self.download_floors(day)
            floors_points = self.prepare_points(floors, day_points, day, self.floors_ts_id, "http://sociam.org/ontology/health/FloorsClimbed")

            # processing elevation
            elevation = self.download_elevation(day)
            elevation_points = self.prepare_points(elevation, day_points, day, self.elevation_ts_id, "http://sociam.org/ontology/health/Elevation")
                
            self.safe_update(indx, steps_points).addCallbacks(
                lambda x: self.safe_update(indx, calories_points), process_d.errback).addCallbacks(
                lambda x: self.safe_update(indx, distance_points), process_d.errback).addCallbacks(
                lambda x: self.safe_update(indx, floors_points), process_d.errback).addCallbacks(
                lambda x: self.safe_update(indx, elevation_points), process_d.errback).addCallbacks(process_d.callback, process_d.errback)

            return process_d

        def step_day(x, day, indx=indx, harvester=harvester):
            self.logger.debug("Current day: {0}".format(day))
            if day < self.today():
                next_day = day + timedelta(days=+1)
                self.get_day_points(indx, day).addCallbacks(process_cb, harvest_d.errback, callbackArgs=[day]).addCallbacks(step_day, harvest_d.errback, callbackArgs=[next_day, indx])
            else:
                self.logger.debug("Finished harvesting round. Saving harvester data .. ")
                harvester["fetched_days"] = self.config_fetched_days
                harvester["zeros_from"] = self.config_zeros_from.isoformat()
                self.safe_update(indx, harvester).addCallbacks(harvest_d.callback, harvest_d.errback)

        self.logger.debug("Fetched days : {0}, Start from : {1}, Zeros from : {2}".format(self.config_fetched_days, self.config_start.isoformat(), self.config_zeros_from.isoformat()))
        step_day(None, self.config_start, indx)

        return harvest_d

    def prepare_points(self, raw_points, day_points, day, ts_id, rdf_type=None):
        points = []
        if day_points and ts_id in day_points and day_points[ts_id] :
            points = self.replace_data_points(day, raw_points, day_points[ts_id], ts_id, rdf_type)
        else:
            points = self.create_data_points(day, raw_points, ts_id, rdf_type) 
        return points

    def create_data_points(self, day, data, ts_id, rdf_type=None):
        self.logger.debug("Started creating data points.")
        data_points = []
        for key in data.keys():
            if key.endswith('-intraday'):
                for point in data[key]["dataset"]:
                    interval_start = datetime.combine(day, datetime.strptime(point["time"], "%H:%M:%S").time()) 
                    interval_end = interval_start+timedelta(minutes=1) 
                    value = point["value"]
                    data_point = {  "@id": "fitbit_dp_{0}".format(uuid.uuid4()), 
                                    "start": interval_start.isoformat(),
                                    "end": interval_end.isoformat(),
                                    "value": value,
                                    "timeseries": { "@id": ts_id } }
                    if rdf_type:
                        data_point["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"] = [ { "@id": rdf_type } ]
                    data_points.append(data_point)
        self.logger.debug("Finished creating data points.")
        return data_points

    def replace_data_points(self, day, new_data, old_data, ts_id, rdf_type=None):
        self.logger.debug("Started replacing values in data points.")
        data_points = []
        replaced = 0
        kept = 0
        created = 0
        for key in new_data.keys():
            if key.endswith('-intraday'):
                for point in new_data[key]["dataset"]:
                    data_point = None
                    interval_start = datetime.combine(day, datetime.strptime(point["time"], "%H:%M:%S").time()) 
                    interval_end = interval_start+timedelta(minutes=1) 
                    value = point["value"]
                    if interval_start in old_data:
                        if len(old_data[interval_start]) > 1 :
                            self.logger.error("There are {0} points for the same start time {1} in the same dataset {2}!!".format(len(old_data[interval_start]), interval_start, ts_id))
                        old_point = old_data[interval_start][0] # there shouldn't be more than 1 point here!!!
                        if old_point['value'][0]['@value'] == str(value):
                            kept = kept+1
                        else:
                            replaced = replaced+1
                            # if all_other_fields_match:
                            data_point = {  "@id": old_point['@id'] }
                    else:
                        created = created+1
                        data_point = {  "@id": "fitbit_dp_{0}".format(uuid.uuid4()) }
                    if data_point :
                        self.logger.debug("Making a data point for {0}".format(interval_start.isoformat()))
                        data_point["start"] = interval_start.isoformat()
                        data_point["end"] = interval_end.isoformat()
                        data_point["value"] = value
                        data_point["timeseries"] = { "@id": ts_id } 
                        if rdf_type:
                            data_point["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"] = [ { "@id": rdf_type } ]
                        data_points.append(data_point)
        self.logger.debug("Finished replacing values in data points - replaced: {0}, kept: {1}, created: {2}".format(replaced, kept, created))
        return data_points

    def download_steps(self, day):
        if (day == None):
            self.logger.error("No date given for download.")
            return []
        steps = self.fitbit_intraday.get_steps(day)[0]
        self.logger.debug("Retrieved steps data for {0}.".format(day.date()))
        return steps

    def download_calories(self, day):
        if (day == None):
            self.logger.error("No date given for download.")
            return []
        calories = self.fitbit_intraday.get_calories(day)[0]
        self.logger.debug("Retrieved calories data for {0}.".format(day.date()))
        return calories

    def download_distance(self, day):
        if (day == None):
            self.logger.error("No date given for download.")
            return []
        distance = self.fitbit_intraday.get_distance(day)[0]
        self.logger.debug("Retrieved distance data for {0}.".format(day.date()))
        return distance

    def download_floors(self, day):
        if (day == None):
            self.logger.error("No date given for download.")
            return []
        floors = self.fitbit_intraday.get_floors(day)[0]
        self.logger.debug("Retrieved floors data for {0}.".format(day.date()))
        return floors

    def download_elevation(self, day):
        if (day == None):
            self.logger.error("No date given for download.")
            return []
        elevation = self.fitbit_intraday.get_elevation(day)[0]
        self.logger.debug("Retrieved elevation data for {0}.".format(day.date()))
        return elevation

    def get_day_points(self, indx, day):
        self.logger.debug("getting day points for {0}".format(day.isoformat()))
        points_d = Deferred()
        d = day.date()

        def points_cb(pts):
            points_d.callback(pts)

        if d.isoformat() in self.config_fetched_days :
            self.logger.debug("Data for {0} was already fetched, rechecking!".format(d.isoformat()))
            self.find_day_points(indx, day).addCallbacks(points_cb, points_d.errback)
        else:
            self.logger.debug("Data for {0} was not yet fetched. Getting it now.".format(d.isoformat()))
            self.config_fetched_days.append(d.isoformat())
            points_d.callback(None)

        return points_d

    def find_day_points(self, indx, day) :
        self.logger.debug("Find day data points from {0}".format(day.date().isoformat()))
        points_d = Deferred()

        def found_cb(results):
            out = {self.steps_ts_id:{}, self.calories_ts_id:{}, self.distance_ts_id:{}, self.floors_ts_id:{}, self.elevation_ts_id:{}}
            for resp in results:
                if resp and 'code' in resp and resp['code']==200 and 'data' in resp:
                    for pt in resp['data'] :
                        obj = resp['data'][pt]
                        if 'timeseries' in obj and obj['timeseries'][0]['@id'] in [self.steps_ts_id, self.calories_ts_id, self.distance_ts_id, self.floors_ts_id, self.elevation_ts_id] :
                            objs_date_hash = out[obj['timeseries'][0]['@id']]
                            if find_start in objs_date_hash:
                                objs_list = objs_date_hash[find_start]
                            else:
                                objs_list = []
                            objs_list.append(obj) 
                            objs_date_hash[find_start] = objs_list
                            out[obj['timeseries'][0]['@id']] = objs_date_hash
                        self.logger.debug("Found points with start time {0}: {1}".format(find_start.isoformat(),objs_list))                    
                else:
                    self.logger.error("Didn't find any time points: {0}".format(resp))
            points_d.callback(out)

        deferreds = []
        for h in range(24):
            for m in range(60):
                find_start = datetime.combine(day.date(), time(h,m,0)) 
                self.logger.debug("Searching data points with start time: {0}".format(find_start.isoformat()))
                deferreds.append(indx.query(json.dumps({"start":find_start.isoformat()})))
        dl = defer.gatherResults(deferreds)
        dl.addCallbacks(found_cb, points_d.errback)
        
        return points_d

    def safe_update(self, indx, obj) :
        self.logger.debug("Updating objects at box version {0}".format(self.box_version))
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
            self.logger.error("Exception in safe update: {0}".format(e))
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

    def check_all_zero(self, data):
        for key in data.keys(): 
            if key.endswith('-intraday'):
                for pt in data[key]["dataset"]:
                    if pt["value"] > 0 :
                        return False
        return True

    def parse_list(self, vlist):
        out = [x['@value'] for x in vlist]
        self.logger.debug("Parsed value list: {0}".format(out))
        return out

if __name__ == '__main__':
    harvester = FitbitHarvester()
    harvester.run()

