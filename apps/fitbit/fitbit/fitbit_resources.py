from fitbit import Fitbit
from datetime import date
import json

class FitbitResources():

    def __init__(self, fitbit):
        self.fitbit = fitbit;
        if (self.fitbit.token == None):
            self.fitbit.get_token()

    # user profile data 

    def get_user_info(self, format='json'):
        url = "/1/user/-/profile.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # user collection resources

    # * body collection 

    def get_body_measurements(self, on_date=date.today(), format='json'):
        # no validation of the date parameter! maybe should add some? 
        url = "/1/user/-/body/date/{0}.{1}".format(on_date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)
    
    def get_body_weight(self, to_date=date.today(), from_date=None, period=None, format='json'):
        # period can be one of {1d, 7d, 30d, 1w, 1m}
        # from_date takes precedence over period, if both are given
        # the number of days in the range given should not be longer than 31 days
        if (from_date == None):
            if (period == None):
                url = "/1/user/-/body/log/weight/date/{0}.{1}".format(to_date.isoformat(), format)
            else:
                url = "/1/user/-/body/log/weight/date/{0}/{1}.{2}".format(to_date.isoformat(), period, format)
        else:
            url = "/1/user/-/body/log/weight/date/{0}/{1}.{2}".format(from_date.isoformat(), to_date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)
    
    def get_body_fat(self, to_date=date.today(), from_date=None, period=None, format='json'):
        # period can be one of {1d, 7d, 30d, 1w, 1m}
        # to_date takes precedence over period, if both are given
        # the number of days in the range given should not be longer than 31 days
        if (from_date == None):
            if (period == None):
                url = "/1/user/-/body/log/fat/date/{0}.{1}".format(to_date.isoformat(), format)
            else:
                url = "/1/user/-/body/log/fat/date/{0}/{1}.{2}".format(to_date.isoformat(), period, format)
        else:
            url = "/1/user/-/body/log/fat/date/{0}/{1}.{2}".format(from_date.isoformat(), to_date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_body_weight_goal(self, format='json'):
        url = "/1/user/-/body/log/weight/goal.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_body_fat_goal(self, format='json'):
        url = "/1/user/-/body/log/fat/goal.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # * activities collection

    def get_activities(self, on_date=date.today(), format='json'):
        # date in the format yyyy-MM-dd
        url = "/1/user/-/activities/date/{0}.{1}".format(on_date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_activity_daily_goals(self, format='json'):
        url = "/1/user/-/activities/goals/daily.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_activity_weekly_goals(self, format='json'):
        url = "/1/user/-/activities/goals/weekly.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # * foods collection

    def get_foods(self, on_date=date.today(), format='json'):
        # date in the format yyyy-MM-dd
        url = "/1/user/-/foods/log/date/{0}.{1}".format(on_date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_water(self, on_date=date.today(), format='json'):
        # date in the format yyyy-MM-dd
        url = "/1/user/-/foods/log/water/date/{0}.{1}".format(on_date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_food_goals(self, format='json'):
        url = "/1/user/-/foods/log/goal.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # * sleep collection

    def get_sleep(self, on_date=date.today(), format='json'):
        # date in the format yyyy-MM-dd
        url = "/1/user/-/sleep/date/{0}.{1}".format(on_date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # * heart collection

    def get_heart_rate(self, on_date=date.today(), format='json'):
        # date in the format yyyy-MM-dd
        url = "/1/user/-/heart/date/{0}.{1}".format(on_date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # * blood pressure collection

    def get_blood_pressure(self, on_date=date.today(), format='json'):
        # date in the format yyyy-MM-dd
        url = "/1/user/-/bp/date/{0}.{1}".format(on_date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # * glucose collection 

    def get_glucose(self, on_date=date.today(), format='json'):
        # date in the format yyyy-MM-dd
        url = "/1/user/-/glucose/date/{0}.{1}".format(on_date.isoformat(), format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # * statistical data collection - daily detail
    
    def get_activity_stats(self, format='json'):
        url = "/1/user/-/activities.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # * collection metadata

    def get_recent_activities(self, format='json'):
        url = "/1/user/-/activities/recent.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_frequent_activities(self, format='json'):
        url = "/1/user/-/activities/frequent.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_favorite_activities(self, format='json'):
        url = "/1/user/-/activities/favorite.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_recent_foods(self, format='json'):
        url = "/1/user/-/foods/log/recent.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_frequent_foods(self, format='json'):
        url = "/1/user/-/foods/log/frequent.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_favorite_foods(self, format='json'):
        url = "/1/user/-/foods/log/favorite.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_meals(self, format='json'):
        url = "/1/user/-/meals.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # user social resources

    def get_friends(self, format='json'):
        url = "/1/user/-/friends.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)
    
    def get_friends_leaderboard(self, format='json'):
        url = "/1/user/-/friends/leaderboard.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)
    
    def get_invites(self, format='json'):
        url = "/1/user/-/friends/invitations.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_badges(self, format='json'):
        url = "/1/user/-/badges.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # user device data 

    def get_devices(self, format='json'):
        url = "/1/user/-/devices.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_alarms(self, device_id, format='json'):
        url = "/1/user/-/devices/tracker/{0}/alarms.{1}".format(device_id, format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    # general reference data

    def browse_activities(self, format='json'):
        url = "/1/activities.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_activity(self, activity_id, format='json'):
        url = "/1/activities/{0}.{1}".format(activity_id, format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def search_foods(self, query, format='json'):
        url = "/1/foods/search.{0}?{1}".format(format, urllib.urlencode({'query':query}))
        print url
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_food(self, food_id, format='json'):
        url = "/1/foods/{0}.{1}".format(food_id, format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)

    def get_food_units(self, format='json'):
        url = "/1/foods/units.{0}".format(format)
        data = self.fitbit.call_get_api(url)
        return json.loads(data)
