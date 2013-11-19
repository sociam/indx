import logging, json, argparse, sys, os, uuid, urllib2
import logging.config
import keyring, keyring.util.platform_
from keyring.backends.pyfs import PlaintextKeyring
from fitbit import Fitbit, FitbitIntraDay
from indxclient import IndxClient
import oauth2 as oauth
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
        self.parser.add_argument('server', help="The server URL to connect to.")

        # init fitbit
        consumer_key = "9cc7928d03fa4e1a92eda0d01ede2297"
        consumer_secret = "340ea36a974e47738a335c0cccfe1fcf"
        self.fitbit = Fitbit(consumer_key, consumer_secret)

        self.version = 0

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
        return stored_config_harvester['start'], stored_config_harvester['box'], stored_config_harvester['user'], stored_config_harvester['password']

    def run(self):
        args = vars(self.parser.parse_args())
        logging.debug("Received arguments: {0}".format(args))
        if args['config']:
            self.set_config(args)
        elif args['get_config']:
            print self.get_config(args)
        else:
            logging.debug("Starting the harvester. ")
            self.harvest(args['server'])

    def yesterday(self):
        return datetime.combine((datetime.now()+timedelta(days=-1)).date(), time(00,00,00))

    def harvest(self, server_url):
        start, box, user, password = self.check_configuration()
        logging.debug("Starting download from date: {0}".format(start))
        day = datetime.strptime(start, "%Y-%m-%d")
        logging.debug("day as {0}: {1}".format(type(day), day))

        fitbit_intraday = FitbitIntraDay(self.fitbit)
        logging.debug("Created FitbitIntraDay.")

        indx = IndxClient(server_url, box, user, password, "INDX_Fitbit_Harvester")
        logging.debug("Created INDXClient.")

        fetched_days = []
        harvester_id = "fitbit_harvester"
        harvester = self.find_create(indx, harvester_id, {"http://www.w3.org/2000/01/rdf-schema#label":"INDX Fitbit Harvester extra info"})
        if harvester :
            if "fetched_days" in harvester :
                fetched_days = harvester["fetched_days"]
        print harvester
        # else: 
        #     logging.error("Harvester object still not created! Trying again ..")
        #     harvester = self.find_create(indx, harvester_id, {"http://www.w3.org/2000/01/rdf-schema#label":"INDX Fitbit Harvester extra info"})
        #     if harvester :
        #         if "fetched_days" in harvester :
        #             fetched_days = harvester["fetched_days"]
        #         else : 
        #             fetched_days = []
        #     else: 
        #         logging.error("Harvester object still not created! Giving up ..")
        #         sys.exit(1)

        steps_ts_id = "fitbit_steps_ts"
        calories_ts_id = "fitbit_calories_ts"
        distance_ts_id = "fitbit_distance_ts"
        floors_ts_id = "fitbit_floors_ts"
        elevation_ts_id = "fitbit_elevation_ts"
        steps_ts = self.find_create(indx, steps_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Steps Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"})
        calories_ts = self.find_create(indx, calories_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Calories Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"})
        distance_ts = self.find_create(indx, distance_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Distance Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"})
        floors_ts = self.find_create(indx, floors_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Floors Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"})
        elevation_ts = self.find_create(indx, elevation_ts_id, {"http://www.w3.org/2000/01/rdf-schema#label":"Fitbit Elevation Time Series", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://purl.org/linked-data/cube#Dataset"})

        while day <= self.yesterday():
            if day.date().isoformat() in fetched_days:
                logging.debug("Data for {0} was already fetched, overwriting!".format(day.date().isoformat()))
                self.find_and_delete_points(indx, day)
            else:
                logging.debug("Data for {0} was not yet fetched. Getting it now.".format(day.date().isoformat()))
                fetched_days.append(day.date().isoformat())
                harvester["fetched_days"] = fetched_days

            steps, calories, distance, floors, elevation = self.download(day, fitbit_intraday)
            
            # processing steps
            if steps_ts:
                steps_points = self.create_data_points(day, steps, steps_ts_id, "http://sociam.org/ontology/health/StepCount") # a subclass of http://www.qudt.org/qudt/owl/1.0.0/quantity/index.html#Frequency and subclass of http://purl.org/linked-data/cube#Observation
                logging.debug("Fetched {0} step data points.".format(len(steps_points)))
                self.save(indx, steps_points)

            # processing calories
            if calories_ts:
                calories_points = self.create_data_points(day, calories, calories_ts_id, "http://sociam.org/ontology/health/CaloriesBurned") # subclass of http://purl.org/linked-data/cube#Observation
                logging.debug("Fetched {0} calories data points.".format(len(calories_points)))
                self.save(indx, calories_points)

            # processing distance
            if distance_ts:
                distance_points = self.create_data_points(day, distance, distance_ts_id, "http://sociam.org/ontology/health/Distance") # subclass of http://purl.org/linked-data/cube#Observation
                logging.debug("Fetched {0} distance data points.".format(len(distance_points)))
                self.save(indx, distance_points)

            # processing floors
            if floors_ts:
                floors_points = self.create_data_points(day, floors, floors_ts_id, "http://sociam.org/ontology/health/FloorsClimbed") # subclass of http://purl.org/linked-data/cube#Observation
                logging.debug("Fetched {0} floors data points.".format(len(floors_points)))
                self.save(indx, floors_points)

            # processing elevation
            if elevation_ts:
                elevation_points = self.create_data_points(day, elevation, elevation_ts_id, "http://sociam.org/ontology/health/Elevation") # subclass of http://purl.org/linked-data/cube#Observation
                logging.debug("Fetched {0} elevation data points.".format(len(elevation_points)))
                self.save(indx, elevation_points)

            self.safe_update(indx, harvester)
            day = day + timedelta(days=+1)

    def create_data_points(self, day, data, ts_id, rdf_type=None):
        logging.debug("Started creating data points.")
        data_points = []
        for key in data.keys():
            if (key.endswith('-intraday')):
                for point in data[key]["dataset"]:
                    interval_start = datetime.combine(day, datetime.strptime(point["time"], "%H:%M:%S").time()) 
                    interval_end = interval_start+timedelta(minutes=1) 
                    value = point["value"]
                    data_point = {  "@id": "fitbit_dp_{0}".format(uuid.uuid4()), 
                                    # "http://sociam.org/ontology/timeseries/start": [ { "@type": "http://www.w3.org/2001/XMLSchema#dateTime", "@value": interval_start.isoformat() } ],
                                    # "http://sociam.org/ontology/timeseries/end": [ { "@type": "http://www.w3.org/2001/XMLSchema#dateTime", "@value": interval_end.isoformat() } ],
                                    # "http://sociam.org/ontology/timeseries/value": [ { "@type": "http://www.w3.org/2001/XMLSchema#int", "@value": value } ],
                                    # "http://purl.org/linked-data/cube#dataset": [ ts_id ] }
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

    def download(self, day, fitbit_intraday):
        if (day == None):
            logging.error("No date given for download.")
            return []

        steps = fitbit_intraday.get_steps(day)[0]
        logging.debug("Retrieved steps data for {0}.".format(day.date()))

        calories = fitbit_intraday.get_calories(day)[0]
        logging.debug("Retrieved calories data for {0}.".format(day.date()))

        distance = fitbit_intraday.get_distance(day)[0]
        logging.debug("Retrieved distance data for {0}.".format(day.date()))

        floors = fitbit_intraday.get_floors(day)[0]
        logging.debug("Retrieved floors data for {0}.".format(day.date()))

        elevation = fitbit_intraday.get_elevation(day)[0]
        logging.debug("Retrieved elevation data for {0}.".format(day.date()))

        return steps, calories, distance, floors, elevation

    def save(self, indx, points):
        self.safe_update(indx, points)

    def find_and_delete_points(self, indx, day):
        logging.debug("Find and delete data points from {0}".format(day.date().isoformat()))
        for h in range(24):
            for m in range(60):
                find_start = datetime.combine(day.date(), time(h,m,0)) 
                logging.debug("looking for data points with start time: {0}".format(find_start.isoformat()))
                step_points = indx.query(json.dumps({"http://sociam.org/ontology/timeseries/start":find_start.isoformat(), "http://www.w3.org/1999/02/22-rdf-syntax-ns#type":"http://sociam.org/ontology/health/StepCount"}))
                logging.debug("Found step points from {0}: {1}".format(find_start.date().isoformat(), step_points))
                # indx.delete(version, step_points)

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
