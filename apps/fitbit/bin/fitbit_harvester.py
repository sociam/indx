import logging, json, argparse, sys, os, requests, urllib, uuid
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

        # init fitbit
        consumer_key = "9cc7928d03fa4e1a92eda0d01ede2297"
        consumer_secret = "340ea36a974e47738a335c0cccfe1fcf"
        self.fitbit = Fitbit(consumer_key, consumer_secret)

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
            exit(1)
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
                exit(1)
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
                            exit(1)
                    else :
                        logging.debug("Could not find pin or req_token in keyring. Cannot attempt authorization to Fitbit.com.")
                        exit(1)
                else: 
                    token = stored_config_fitbit['token']
            if token is not None :
                self.fitbit.set_token(token)
        return stored_config_harvester['start'], stored_config_harvester['frequency'], stored_config_harvester['box'], stored_config_harvester['user']

    def run(self):
        args = vars(self.parser.parse_args())
        if args['config']:
            self.set_config(args)
        elif args['get_config']:
            print self.get_config(args)
        else:
            logging.debug("Starting the harvester. ")
            start, freq, box, user = self.check_configuration()
            self.harvest(start)

    def yesterday(self):
        return datetime.combine((datetime.now()+timedelta(days=-1)).date(), time(00,00,00))

    def harvest(self, start):
        logging.debug("Starting download from date: {0}".format(start))
        day = datetime.strptime(start, "%Y-%m-%d")
        logging.debug("day as {0}: {1}".format(type(day), day))

        fitbit_intraday = FitbitIntraDay(self.fitbit)
        while day <= self.yesterday():
            steps, calories, distance, floors, elevation = self.download(day, fitbit_intraday)
            #   write data
            day = day + timedelta(days=+1)

    def create_data_points(self, day, data):
        data_points = []
        for key in data.keys():
            if (key.endswith('-intraday')):
                for point in data[key]["dataset"]:
                    interval_start = datetime.combine(day, datetime.strptime(point["time"], "%H:%M:%S").time()) 
                    interval_end = interval_start+timedelta(minutes=1) 
                    value = point["value"]
                    data_point = {  "@id": "fitbit_dp_{0}".format(uuid.uuid4()), 
                                    # add rdf:type .. creator, prov data
                                    "start": [ { "@type": "http://www.w3.org/2001/XMLSchema#dateTime", "@value": interval_start.isoformat() } ],
                                    "end": [ { "@type": "http://www.w3.org/2001/XMLSchema#dateTime", "@value": interval_end.isoformat() } ],
                                    "value": [ { "@type": "http://www.w3.org/2001/XMLSchema#int", "@value": value } ] }
                    data_points.append(data_point)
                    # logging.debug("Created and appended data point: {0}".format(data_point))
        return data_points


    def download(self, day, fitbit_intraday):
#         end = datetime.combine((datetime.now()+timedelta(days=-1)).date(), time(23,59,59))
        response = {}
        if (day == None):
            logging.error("No date given for download.")
            return response

        steps = fitbit_intraday.get_steps(day)[0]
        logging.debug("Retrieved steps data for {0}.".format(day.date()))
        steps_points = self.create_data_points(day, steps)
        logging.debug("Generated steps data points.")

        calories = fitbit_intraday.get_calories(day)[0]
        logging.debug("Retrieved calories data for {0}.".format(day.date()))
        calories_points = self.create_data_points(day, calories)
        logging.debug("Generated calories data points.")

        distance = fitbit_intraday.get_distance(day)[0]
        logging.debug("Retrieved distance data for {0}.".format(day.date()))
        distance_points = self.create_data_points(day, distance)
        logging.debug("Generated distance data points.")

        floors = fitbit_intraday.get_floors(day)[0]
        logging.debug("Retrieved floors data for {0}.".format(day.date()))
        floors_points = self.create_data_points(day, floors)
        logging.debug("Generated floors data points.")

        elevation = fitbit_intraday.get_elevation(day)[0]
        logging.debug("Retrieved elevation data for {0}.".format(day.date()))
        elevation_points = self.create_data_points(day, elevation)
        logging.debug("Generated elevation data points.")

        return steps_points, calories_points, distance_points, floors_points, elevation_points

        
if __name__ == '__main__':
    harvester = FitbitHarvester()
    harvester.run();

#     def render(self, request):
#         logging.info("Fitbit App, request args: {0}".format(request.args))
#         # if "init" in request.args:
#         #     self.indx = IndxClient("http://{0}".format(request.args['host'][0]), request.args['box'], request.args['username'], request.args["password"], "FitbitConnector")
#         #     print self.indx
#         #     logging.info("Fitbit App, connected to the box {0}".format(box))
#         #     self.return_ok(request, data = {"init": "ok"})
#         if "gotourl" in request.args:
#             gotourl = self.fitbit.get_token_url()
#             logging.info("Fitbit App, the gotourl is {0}".format(gotourl))
#             self.return_ok(request, data = {"url": gotourl})
#         elif "pin" in request.args:
#             pin = request.args['pin'][0]
#             logging.info("Fitbit App, the pin is {0}".format(pin))
#             token = self.fitbit.get_token_with_pin(pin)
#             self.return_ok(request, data = {"token": json.dumps({"token_key": "{0}".format(token.key), "token_secret": "{0}".format(token.secret)})})
#         elif "token" in request.args:
#             token = json.loads(request.args["token"][0])
#             self.fitbit = Fitbit(self.consumer_key, self.consumer_secret, token['token_key'], token['token_secret'])
#             self.return_ok(request, data={})
#         elif "download" in request.args:
#             self.fitbit_min = FitbitIntraDay(self.fitbit)
#             start = None
#             if ("start" in request.args):
#                 start = datetime.fromtimestamp(int(request.args["start"][0])/1000)
#             response = self.download_data(start)
#             self.return_ok(request, data = response)
#         else:
#             logging.info("Fitbit App, returning 404")
#             self.return_not_found(request)
#         return NOT_DONE_YET
