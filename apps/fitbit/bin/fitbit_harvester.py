import logging, json, argparse, sys, os, uuid, urllib2
import logging.config
import keyring, keyring.util.platform_
from keyring.backends.pyfs import PlaintextKeyring
from fitbit import Fitbit, FitbitIntraDay
from indxclient import IndxClient
import oauth2 as oauth
from time import sleep
from datetime import date, datetime, timedelta, time

class FitbitHarvester:

    def __init__(self):
        logging.basicConfig(filename="fitbit_harvester.log", level=logging.DEBUG)
    
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

        self.version = 0

        self.harvester_id = "fitbit_harvester"
        self.steps_ts_id = "fitbit_steps_ts"
        self.calories_ts_id = "fitbit_calories_ts"
        self.distance_ts_id = "fitbit_distance_ts"
        self.floors_ts_id = "fitbit_floors_ts"
        self.elevation_ts_id = "fitbit_elevation_ts"

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
        logging.debug("Received config: {0}".format(received_config))
        config = {}
        if 'fitbit' in received_config:
            fitbit_config = received_config['fitbit']
            if fitbit_config and ('pin' in fitbit_config) and ('req_token' in fitbit_config): # this should check for the req_token in the stored config!
                logging.debug("Received pin: {0}".format(fitbit_config['pin']))
                try:
                    token = self.fitbit.get_token_with_pin(fitbit_config['pin'], fitbit_config['req_token'])
                    logging.debug("Got auth token {0}".format(token))
                    logging.debug("Got auth token of type {0}".format(type(token)))
                    if token:
                        config['token']=token
                        keyring.set_password("Fitbit.com", "Fitbit", json.dumps(config))
                except Exception as exc:
                    logging.error("Could not authorise to fitbit, with pin {0}, error: {1}".format(fitbit_config['pin'], exc))
        if 'harvester' in received_config:
            harvester_config = received_config['harvester']
            if harvester_config != stored_config_harvester:
                keyring.set_password("INDX", "INDX_Fitbit_Harvester", json.dumps(harvester_config)) 

    def get_config(self, args):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Fitbit_Harvester")
        stored_config_fitbit = keyring.get_password("Fitbit.com", "Fitbit")

        logging.debug("Loaded harvester config from keyring: {0}".format(stored_config_harvester))
        logging.debug("Loaded fitbit config from keyring: {0}".format(stored_config_fitbit))

        if stored_config_fitbit is None :
            token_url = self.fitbit.get_token_url()
            config_fitbit = {}
            config_fitbit["url"] = token_url['url']
            config_fitbit["req_token"] = token_url['req_token']
        else :
            if (type(stored_config_fitbit) != dict):
                config_fitbit = json.loads(stored_config_fitbit)
            if (type(config_fitbit) != dict):
                config_fitbit = json.loads(config_fitbit)
            if 'token' not in config_fitbit :
                token_url = self.fitbit.get_token_url()
                config_fitbit["url"] = token_url['url']
                config_fitbit["req_token"] = token_url['req_token']
                keyring.set_password("Fitbit.com", "Fitbit", json.dumps(config_fitbit))
        if stored_config_harvester is None:
            return json.dumps({"fitbit":config_fitbit}) # don't send the req_token
        return json.dumps({"fitbit":config_fitbit, "harvester":json.loads(stored_config_harvester)}) # don't send the req_token


    def check_configuration(self):
        stored_config_harvester = keyring.get_password("INDX", "INDX_Fitbit_Harvester")
        logging.debug("stored_config_harvester type: {0}".format(type(stored_config_harvester)))
        logging.debug("Loaded harvester config from keyring: {0}".format(stored_config_harvester))
        if stored_config_harvester is None :
            logging.error("Harvester not configured. Please configure before use.")
            sys.exit(1)
        if (type(stored_config_harvester) != dict):
            stored_config_harvester = json.loads(stored_config_harvester)
            logging.debug("stored_config_harvester type (after 1 loads): {0}".format(type(stored_config_harvester)))

        if self.fitbit.get_token() is None:
            stored_config_fitbit = keyring.get_password("Fitbit.com", "Fitbit")
            logging.debug("stored_config_fitbit type: {0}".format(type(stored_config_fitbit)))
            logging.debug("Loaded fitbit config from keyring: {0}".format(stored_config_fitbit))

            token = None
            if stored_config_fitbit is None :
                logging.error("Not authenticated to Fitbit.com. Please configure before use.")
                sys.exit(1)
            else :
                if (type(stored_config_fitbit) != dict):
                    stored_config_fitbit = json.loads(stored_config_fitbit)
                    logging.debug("stored_config_fitbit type (after 1 loads): {0}".format(type(stored_config_fitbit)))
                if 'token' not in stored_config_fitbit :
                    logging.debug("Could not find Fitbit auth token in keyring");
                    if ('pin' in stored_config_fitbit) and ('req_token' in stored_config_fitbit):
                        logging.debug("Found pin {0} and req_token in keyring, attempting authorization to Fitbit.com".format(stored_config_fitbit['pin']))
                        try:
                            fitbit_token_config = {}
                            token = self.fitbit.get_token_with_pin(stored_fitbit_config['pin'], stored_fitbit_config['req_token'])
                            if token:
                                logging.debug("Got auth token {0}".format(token))
                                # logging.debug("Got auth token of type {0}".format(type(token)))
                                fitbit_token_config['token']=token
                            keyring.set_password("Fitbit.com", "Fitbit", json.dumps(fitbit_token_config))
                        except Exception as exc:
                            logging.error("Could not authorise to fitbit, error: {1}".format(exc))
                            sys.exit(1)
                    else :
                        logging.debug("Could not find pin or req_token in keyring. Cannot attempt authorization to Fitbit.com.")
                        sys.exit(1)
                else: 
                    token = stored_config_fitbit['token']
            if token is not None :
                self.fitbit.set_token(token)
        return stored_config_harvester['start'], stored_config_harvester['box'], stored_config_harvester['user'], stored_config_harvester['password'], stored_config_harvester['overwrite']

    def run(self):
        args = vars(self.parser.parse_args())
        logging.debug("Received arguments: {0}".format(args))
        if args['config']:
            self.set_config(args)
        elif args['get_config']:
            print self.get_config(args)
        else:
            logging.debug("Starting the harvester. ")
            self.work(args['server'])

    def yesterday(self):
        return datetime.combine((datetime.now()+timedelta(days=-1)).date(), time(00,00,00))

    def today(self):
        return datetime.combine(datetime.now().date(), time(00,00,00))

    def work(self, server_url):
        start, box, user, password, overwrite = self.check_configuration()
        logging.debug("Starting download from date: {0}".format(start))
        day = datetime.strptime(start, "%Y-%m-%d")
        day = day+timedelta(days=+1)
        logging.debug("day as {0}: {1}".format(type(day), day))

        fitbit_intraday = FitbitIntraDay(self.fitbit)
        logging.debug("Created FitbitIntraDay.")

        indx = IndxClient(server_url, box, user, password, "INDX_Fitbit_Harvester")
        logging.debug("Created INDXClient.")

        harvester = self.find_create(indx, self.harvester_id, {"http://www.w3.org/2000/01/rdf-schema#label":"INDX Fitbit Harvester extra info"})
        if harvester :
            if "zeros_from" in harvester :
                all_zeros_from = datetime.strptime(harvester["zeros_from"][0]["@value"], "%Y-%m-%dT%H:%M:%S")
                if day < all_zeros_from :
                    if overwrite :
                        harvester["zeros_from"] = day.isoformat()
            else :
                harvester["zeros_from"] = day.isoformat()
        self.safe_update(indx, harvester)    
        
        while 1: 
            indx = IndxClient(server_url, box, user, password, "INDX_Fitbit_Harvester")
            logging.debug("Recreated INDXClient.")
            self.harvest(indx, fitbit_intraday)
            logging.debug("Harvested! Suspending execution for 1 hour at {0}.".format(datetime.now().isoformat()))
            sleep(3600)


    def harvest(self, indx, fitbit_intraday):
        fetched_days = []
        day = self.today()
        harvester = self.find_create(indx, self.harvester_id, {"http://www.w3.org/2000/01/rdf-schema#label":"INDX Fitbit Harvester extra info"})
        if harvester :
            if "fetched_days" in harvester :
                fetched_days = self.parse_list(harvester["fetched_days"])
            if "zeros_from" in harvester :
                day = datetime.strptime(harvester["zeros_from"][0]["@value"], "%Y-%m-%dT%H:%M:%S")
        logging.debug("Fetched days : {0}, Start from : {1}".format(fetched_days, day.isoformat()))

        steps_ts = self.find_create(indx, self.steps_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Steps Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"})
        calories_ts = self.find_create(indx, self.calories_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Calories Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"})
        distance_ts = self.find_create(indx, self.distance_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Distance Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"})
        floors_ts = self.find_create(indx, self.floors_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Floors Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"})
        elevation_ts = self.find_create(indx, self.elevation_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Elevation Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"})

        got_all_zeros = self.today()
        day = day + timedelta(days=-1) # recheck the last day that was not all zeros, in case only a part of it was synced, this also ensures that at least 1 day of data is fetched

        while day < self.today():
            # skip = False
            day_points = None
            if day.date().isoformat() in fetched_days:
                logging.debug("Data for {0} was already fetched, rechecking!".format(day.date().isoformat()))
                # self.find_and_delete_points(indx, day)
                day_points = self.find_day_points(indx, day) # {"dataset_id":{hash based on start time}, "dataset_id":{hash based on start time}, ...}
                # else :
                #     logging.debug("Data for {0} was already fetched, skipping day!".format(day.date().isoformat()))
                #     skip = True
            else:
                logging.debug("Data for {0} was not yet fetched. Getting it now.".format(day.date().isoformat()))
                fetched_days.append(day.date().isoformat())
                harvester["fetched_days"] = fetched_days
                self.safe_update(indx, harvester)

            # processing steps
            steps = self.download_steps(day, fitbit_intraday)

            zeros = False
            zeros = self.check_all_zero(steps)
            if zeros :
                logging.debug("Step data points are all 0. ")
                if got_all_zeros > day:
                    got_all_zeros = day
            else :
                got_all_zeros = self.today()
            harvester["zeros_from"] = got_all_zeros.isoformat()
            self.safe_update(indx, harvester)

            steps_points = []
            if day_points and self.steps_ts_id in day_points and day_points[self.steps_ts_id] :
                steps_points = self.replace_data_points(day, steps, day_points[self.steps_ts_id], self.steps_ts_id, "http://sociam.org/ontology/health/StepCount")
            else:
                steps_points = self.create_data_points(day, steps, self.steps_ts_id, "http://sociam.org/ontology/health/StepCount") # a subclass of http://www.qudt.org/qudt/owl/1.0.0/quantity/index.html#Frequency and subclass of http://purl.org/linked-data/cube#Observation
            logging.debug("Saving {0} step data points.".format(len(steps_points)))
            self.save(indx, steps_points)

            # logging.debug("Suspending execution for 1 minute at {0}.".format(datetime.now().isoformat()))
            # sleep(60)

            # processing calories
            calories = self.download_calories(day, fitbit_intraday)
            calories_points = []
            if day_points and self.calories_ts_id in day_points and day_points[self.calories_ts_id] :
                calories_points = self.replace_data_points(day, calories, day_points[self.calories_ts_id], self.calories_ts_id, "http://sociam.org/ontology/health/CaloriesBurned")
            else:
                calories_points = self.create_data_points(day, calories, self.calories_ts_id, "http://sociam.org/ontology/health/CaloriesBurned") # subclass of http://purl.org/linked-data/cube#Observation
            logging.debug("Saving {0} calories data points.".format(len(calories_points)))
            self.save(indx, calories_points)

            # logging.debug("Suspending execution for 1 minute at {0}.".format(datetime.now().isoformat()))
            # sleep(60)

            # processing distance
            distance = self.download_distance(day, fitbit_intraday)
            distance_points = []
            if day_points and self.distance_ts_id in day_points and day_points[self.distance_ts_id] :
                distance_points = self.replace_data_points(day, distance, day_points[self.distance_ts_id], self.distance_ts_id, "http://sociam.org/ontology/health/Distance") # subclass of http://purl.org/linked-data/cube#Observation
            else:
                distance_points = self.create_data_points(day, distance, self.distance_ts_id, "http://sociam.org/ontology/health/Distance") # subclass of http://purl.org/linked-data/cube#Observation
            logging.debug("Saving {0} distance data points.".format(len(distance_points)))
            self.save(indx, distance_points)

            # logging.debug("Suspending execution for 1 minute at {0}.".format(datetime.now().isoformat()))
            # sleep(60)

            # processing floors
            floors = self.download_floors(day, fitbit_intraday)
            floors_points = []
            if day_points and self.floors_ts_id in day_points and day_points[self.floors_ts_id] :
                floors_points = self.replace_data_points(day, floors, day_points[self.floors_ts_id], self.floors_ts_id, "http://sociam.org/ontology/health/FloorsClimbed") # subclass of http://purl.org/linked-data/cube#Observation
            else:
                floors_points = self.create_data_points(day, floors, self.floors_ts_id, "http://sociam.org/ontology/health/FloorsClimbed") # subclass of http://purl.org/linked-data/cube#Observation
            logging.debug("Saving {0} floors data points.".format(len(floors_points)))
            self.save(indx, floors_points)

            # logging.debug("Suspending execution for 1 minute at {0}.".format(datetime.now().isoformat()))
            # sleep(60)

            # processing elevation
            elevation = self.download_elevation(day, fitbit_intraday)
            elevation_points = []
            if day_points and self.elevation_ts_id in day_points and day_points[self.elevation_ts_id]:
                elevation_points = self.replace_data_points(day, elevation, day_points[self.elevation_ts_id], self.elevation_ts_id, "http://sociam.org/ontology/health/Elevation") # subclass of http://purl.org/linked-data/cube#Observation
            else:
                elevation_points = self.create_data_points(day, elevation, self.elevation_ts_id, "http://sociam.org/ontology/health/Elevation") # subclass of http://purl.org/linked-data/cube#Observation
            logging.debug("Saving {0} elevation data points.".format(len(elevation_points)))
            self.save(indx, elevation_points)

            # logging.debug("Suspending execution for 1 minute at {0}.".format(datetime.now().isoformat()))
            # sleep(60)

            day = day + timedelta(days=+1)

        logging.debug("Finished harvesting round! Exiting harvest() .. ")

    def parse_list(self, vlist):
        out = [x['@value'] for x in vlist]
        logging.debug("Parsed value list: {0}".format(out))
        return out

    def check_all_zero(self, data):
        for key in data.keys(): 
            if key.endswith('-intraday'):
                for pt in data[key]["dataset"]:
                    if pt["value"] > 0 :
                        return False
        return True

    def create_data_points(self, day, data, ts_id, rdf_type=None):
        logging.debug("Started creating data points.")
        data_points = []
        for key in data.keys():
            if key.endswith('-intraday'):
                for point in data[key]["dataset"]:
                    interval_start = datetime.combine(day, datetime.strptime(point["time"], "%H:%M:%S").time()) 
                    interval_end = interval_start+timedelta(minutes=1) 
                    value = point["value"]
                    data_point = {  "@id": "fitbit_dp_{0}".format(uuid.uuid4()), 
                                    "http://sociam.org/ontology/timeseries/start": interval_start.isoformat(),
                                    "http://sociam.org/ontology/timeseries/end": interval_end.isoformat(),
                                    "http://sociam.org/ontology/timeseries/value": value,
                                    "http://purl.org/linked-data/cube#dataset": ts_id }
                    if rdf_type:
                        data_point["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"] = [ rdf_type ]
                    data_points.append(data_point)
                    # logging.debug("Created and appended data point: {0}".format(data_point))
        logging.debug("Finished creating data points.")
        return data_points

    def replace_data_points(self, day, new_data, old_data, ts_id, rdf_type=None):
        logging.debug("Started replacing values in data points.")
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
                            logging.error("There are {0} points for the same start time {1} in the same dataset {2}!!".format(len(old_data[interval_start]), interval_start, ts_id))
                        old_point = old_data[interval_start][0] # there shouldn't be more than 1 point here!!!
                        if old_point['http://sociam.org/ontology/timeseries/value'][0]['@value'] == str(value):
                            kept = kept+1
                        else:
                            replaced = replaced+1
                            # if all_other_fields_match:
                            data_point = {  "@id": old_point['@id'] }
                    else:
                        created = created+1
                        data_point = {  "@id": "fitbit_dp_{0}".format(uuid.uuid4()) }
                    if data_point :
                        logging.debug("Making a data point for {0}".format(interval_start.isoformat()))
                        data_point["http://sociam.org/ontology/timeseries/start"] = interval_start.isoformat()
                        data_point["http://sociam.org/ontology/timeseries/end"] = interval_end.isoformat()
                        data_point["http://sociam.org/ontology/timeseries/value"] = value
                        data_point["http://purl.org/linked-data/cube#dataset"] = ts_id 
                        if rdf_type:
                            data_point["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"] = [ rdf_type ]
                        data_points.append(data_point)
        logging.debug("Finished replacing values in data points - replaced: {0}, kept: {1}, created: {2}".format(replaced, kept, created))
        return data_points

    def download_steps(self, day, fitbit_intraday):
        if (day == None):
            logging.error("No date given for download.")
            return []
        steps = fitbit_intraday.get_steps(day)[0]
        logging.debug("Retrieved steps data for {0}.".format(day.date()))
        return steps

    def download_calories(self, day, fitbit_intraday):
        if (day == None):
            logging.error("No date given for download.")
            return []
        calories = fitbit_intraday.get_calories(day)[0]
        logging.debug("Retrieved calories data for {0}.".format(day.date()))
        return calories

    def download_distance(self, day, fitbit_intraday):
        if (day == None):
            logging.error("No date given for download.")
            return []
        distance = fitbit_intraday.get_distance(day)[0]
        logging.debug("Retrieved distance data for {0}.".format(day.date()))
        return distance

    def download_floors(self, day, fitbit_intraday):
        if (day == None):
            logging.error("No date given for download.")
            return []
        floors = fitbit_intraday.get_floors(day)[0]
        logging.debug("Retrieved floors data for {0}.".format(day.date()))
        return floors

    def download_elevation(self, day, fitbit_intraday):
        if (day == None):
            logging.error("No date given for download.")
            return []
        elevation = fitbit_intraday.get_elevation(day)[0]
        logging.debug("Retrieved elevation data for {0}.".format(day.date()))
        return elevation

    def save(self, indx, points):
        self.safe_update(indx, points)

    def find_and_delete_points(self, indx, day):
        logging.debug("Find and delete data points from {0}".format(day.date().isoformat()))
        for h in range(24):
            for m in range(60):
                point_ids = []
                find_start = datetime.combine(day.date(), time(h,m,0)) 
                logging.debug("Looking for data points with start time: {0}".format(find_start.isoformat()))
                resp = indx.query(json.dumps({"http://sociam.org/ontology/timeseries/start":find_start.isoformat()}))
                if resp and 'code' in resp and resp['code']==200 and 'data' in resp:
                    for pt in resp['data'] :
                        obj = resp['data'][pt]
                        if 'http://purl.org/linked-data/cube#dataset' in obj and obj['http://purl.org/linked-data/cube#dataset'][0]['@value'] in [self.steps_ts_id, self.calories_ts_id, self.distance_ts_id, self.floors_ts_id, self.elevation_ts_id] :
                            point_ids.append(pt) 
                logging.debug("Found points with start time {0}: {1}".format(find_start.isoformat(), point_ids))
                self.safe_delete(indx, point_ids)

    def find_by_id(self, indx, oid) :
        logging.debug("Searchin object by id {0}".format(oid))
        resp = indx.query(json.dumps({"@id": oid}))
        logging.debug("find_by_id: received response: {0}".format(resp))
        if resp and "code" in resp and resp["code"] == 200 and "data" in resp:
            resp_data = resp["data"]
            if oid in resp_data:
                logging.debug("Object {0} found!".format(oid))
                return resp_data[oid]
            else:
                logging.debug("Object {0} not found!".format(oid))
        return None

    def find_day_points(self, indx, day) :
        logging.debug("Find day data points from {0}".format(day.date().isoformat()))
        out = {self.steps_ts_id:{}, self.calories_ts_id:{}, self.distance_ts_id:{}, self.floors_ts_id:{}, self.elevation_ts_id:{}}
        for h in range(24):
            for m in range(60):
                find_start = datetime.combine(day.date(), time(h,m,0)) 
                logging.debug("Looking for data points with start time: {0}".format(find_start.isoformat()))
                resp = indx.query(json.dumps({"http://sociam.org/ontology/timeseries/start":find_start.isoformat()}))
                if resp and 'code' in resp and resp['code']==200 and 'data' in resp:
                    for pt in resp['data'] :
                        obj = resp['data'][pt]
                        if 'http://purl.org/linked-data/cube#dataset' in obj and obj['http://purl.org/linked-data/cube#dataset'][0]['@value'] in [self.steps_ts_id, self.calories_ts_id, self.distance_ts_id, self.floors_ts_id, self.elevation_ts_id] :
                            objs_date_hash = out[obj['http://purl.org/linked-data/cube#dataset'][0]['@value']]
                            if find_start in objs_date_hash:
                                objs_list = objs_date_hash[find_start]
                            else:
                                objs_list = []
                            objs_list.append(obj) 
                            objs_date_hash[find_start] = objs_list
                            out[obj['http://purl.org/linked-data/cube#dataset'][0]['@value']] = objs_date_hash
                        logging.debug("Found points with start time {0}: {1}".format(find_start.isoformat(),objs_list))
        logging.debug("The points found for the day: {0}".format(out))
        return out


    def safe_update(self, indx, obj) :
        try:
            logging.debug("Updating object {0} at box version {1}".format(obj, self.version))
            resp = indx.update(self.version, obj)
            logging.debug("safe_update: received response: {0}".format(resp))
            if resp and "code" in resp and "data" in resp:
                if resp["code"] == 201 or resp["code"] == 200:
                    self.version = resp["data"]["@version"]
                    logging.debug("Updated objects! new box version: {0}".format(self.version))
                    return self.version
        except Exception as e:
            if isinstance(e, urllib2.HTTPError): # handle a version incorrect error, and update the version
                if e.code == 409: # 409 Obsolete
                    response = e.read()
                    json_response = json.loads(response)
                    self.version = json_response['@version']
                    return self.safe_update(indx, obj) # try updating again now the version is correct
                pass
            else:
                logging.error("Error updating INDX: {0}".format(e))
                sys.exit(1)   

    def safe_delete(self, indx, objs):
        try:
            logging.debug("Deleting objects {0} at box version {1}".format(objs, self.version))
            resp = indx.delete(self.version, objs)
            logging.debug("safe_delete: received response: {0}".format(resp))
            if resp and "code" in resp and "data" in resp:
                if resp["code"] == 201: # why is it 201 that is returned??
                    self.version = resp["data"]["@version"]
                    logging.debug("Deleted objects! new box version: {0}".format(self.version))
                    return self.version
        except Exception as e:
            if isinstance(e, urllib2.HTTPError): # handle a version incorrect error, and update the version
                if e.code == 409: # 409 Obsolete
                    response = e.read()
                    json_response = json.loads(response)
                    self.version = json_response['@version']
                    return self.safe_delete(indx, objs) # try updating again now the version is correct
                pass
            else:
                logging.error("Error deleting from INDX: {0}".format(e))
                sys.exit(1)             

    def find_create(self, indx, oid, attrs={}):
        obj = self.find_by_id(indx, oid)
        if obj is None:
            logging.debug("Object {0} not found! Creating it.".format(oid))
            attrs.update({"@id":oid})
            self.safe_update(indx, attrs)
            obj = attrs
        return obj

if __name__ == '__main__':
    harvester = FitbitHarvester()
    harvester.run();
