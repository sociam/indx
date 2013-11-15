from fitbit import Fitbit
from datetime import date, datetime, time, timedelta
import json

# '''merges two response dicts based on the keys'''
# def combine(a, b):
#     c = {}
#     for key in a.keys():
#         if (key.endswith('-intraday')):
#             c[key] = a[key]
#             c[key]['dataset'].extend(b[key]['dataset'])
#         else:
#             c[key] = a[key]
#             c[key].extend(b[key])
#     return c

class FitbitIntraDay():

    def __init__(self, fitbit):
        self.fitbit = fitbit;
        if (self.fitbit.token == None):
            self.fitbit.get_token()

    def get_intraday_time_series(self, resource_path, from_datetime, to_datetime, format='json'):
        # from_date and to_date of type datetime
        # use fitbit_timeseries helper functions for a list of possible resource paths
        if (to_datetime.date() == from_datetime.date()):
            return [self.get_time_interval_time_series(resource_path, to_datetime.date(), from_datetime.time(), to_datetime.time(), format)]
        else:
            out = [self.get_time_interval_time_series(resource_path, from_datetime.date(), from_datetime.time(), time(23, 59), format)]
            delta = timedelta(days=1)
            next = from_datetime.date() + delta
            while (next < to_datetime.date()):
                out.append(self.get_day_time_series(resource_path, next, format))
                next = next + delta
            out.append(self.get_time_interval_time_series(resource_path, to_datetime.date(), time(0, 0), to_datetime.time(), format))
            return out

    def get_day_time_series(self, resource_path, date=date.today(), format='json'):
        url = "/1/user/-/{0}/date/{1}/1d/1min.{2}".format(resource_path, date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_time_interval_time_series(self, resource_path, date=date.today(), from_time=time(0, 0), to_time=time(23,59), format='json'):
        url = "/1/user/-/{0}/date/{1}/1d/1min/time/{2}/{3}.{4}".format(resource_path, date.isoformat(), from_time.strftime("%H:%M"), to_time.strftime("%H:%M"), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_calories(self, from_datetime, to_datetime, format='json'):
        return self.get_intraday_time_series("activities/calories", from_datetime, to_datetime, format)

    def get_steps(self, from_datetime, to_datetime, format='json'):
        return self.get_intraday_time_series("activities/steps", from_datetime, to_datetime, format)
    
    def get_distance(self, from_datetime, to_datetime, format='json'):
        return self.get_intraday_time_series("activities/distance", from_datetime, to_datetime, format)
    
    def get_floors(self, from_datetime, to_datetime, format='json'):
        return self.get_intraday_time_series("activities/floors", from_datetime, to_datetime, format)    

    def get_elevation(self, from_datetime, to_datetime, format='json'):
        return self.get_intraday_time_series("activities/elevation", from_datetime, to_datetime, format)
    