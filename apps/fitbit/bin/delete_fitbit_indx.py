import argparse, logging, pprint, json, getpass
from indxclient import IndxClient
from fitbit import Fitbit
from fitbit import FitbitTimeseries
from fitbit import FitbitResources
from fitbit import FitbitIntraDay
from datetime import datetime, date, time, timedelta

parser = argparse.ArgumentParser(description = "Use the Fitbit API to push data into INDX")
# parser.add_argument('address', type=str, help="Address of the INDX server, e.g. http://indx.example.com:8211/")
# parser.add_argument('user', type=str, help="INDX username, e.g. indx")
# parser.add_argument('passwd', type=str, help="INDX password for the given username")
# parser.add_argument('box', type=str, help="Box to assert tweets into")
# parser.add_argument('--appid', type=str, default="Data Pusher", help="Override the appid used for the INDX assertions")
# parser.add_argument('--debug', default = False, action="store_true", help = "Turn on verbose debugging")
args = vars(parser.parse_args())

# if args['debug']:
#     logging.basicConfig(level = logging.DEBUG)
# else:
#     logging.basicConfig(level=logging.INFO)

# set up connection to INDX
# password = getpass.getpass()
# indx = IndxClient(args['address'], args['box'], args['user'], args['passwd'], "Fitbit Connector")

# set up connection to Fitbit
consumer_key = "9cc7928d03fa4e1a92eda0d01ede2297"
consumer_secret = "340ea36a974e47738a335c0cccfe1fcf"

# fitbit = Fitbit(consumer_key, consumer_secret, access_token_key, access_token_secret)
fitbit = Fitbit(consumer_key, consumer_secret)
if (fitbit.token == None):
	gotourl = fitbit.get_token_url()
	pin = raw_input("Please input you PIN: ")
	fitbit.get_token_with_pin(pin)

fitbit_min = FitbitIntraDay(fitbit)

# def get_fitbit_data():
# 	from_date = args['from_date']
# 	to_date = args['to_date']
# 	print '\nget activities tracker steps:\n'
# 	return fitbit_ts.get_activities_tracker_steps(to_date, from_date)

def transform_fitbit_response(response):
	aggr = response['activities-steps']
	if (len(aggr) > 1):
		# add this later
		print 'several days worth of data, only processing the first day'
	day = datetime.strptime(aggr[0]['dateTime'], '%Y-%m-%d').date()
	mins_data = response['activities-steps-intraday']['dataset']
	for min_data in mins_data:
		hms = datetime.strptime(min_data['time'], '%H:%M:%S').time()
		ts = datetime.combine(day,hms)
		count = min_data['value']
		if (count > 0):
			# print '{0} - {1}'.format(ts, count)
			obs = create_observation(ts, count)
			write_observation(obs)

def create_observation(timestamp, count):
	obs = {}
	obs['@id'] = 'fitbit_step_count_{0}'.format(timestamp.strftime('%Y_%m_%d_%H_%M'))
	obs['@type'] = 'http://sociam.org/ontology/health/StepCount' # a subclass of http://www.qudt.org/qudt/owl/1.0.0/quantity/index.html#Frequency
	obs['start'] = [ { '@type': 'http://www.w3.org/2001/XMLSchema#datetime', '@value': '{0}'.format(timestamp.isoformat()) } ]
	obs['end'] = [ { '@type': 'http://www.w3.org/2001/XMLSchema#datetime', '@value': '{0}'.format((timestamp+timedelta(seconds=59)).isoformat()) } ]
	obs['value'] = [ { '@type': 'http://www.w3.org/2001/XMLSchema#integer', '@value': '{0}'.format(count) } ]
	obs['um'] = [ { '@type': 'http://www.w3.org/2001/XMLSchema#anyURI', '@value': 'http://sociam.org/ontology/health/StepsPerMinute' } ] # subclass of http://www.qudt.org/qudt/owl/1.0.0/unit/index.html#CountingUnit
	return obs

def write_observation(obs):
	pprint.pprint(obs)
	# print 'entity(indx:{0}, [prov:type="measurement"])'.format(obs['@id'])
	# print '\n'

if __name__ == '__main__':
	# get_fitbit_data()
	start = datetime(2013, 8, 13, 23, 55)
	end = datetime(2013, 8, 14, 0, 5)
	response = fitbit_min.get_steps(start, end)
	print response
	# transform_fitbit_response(response)



