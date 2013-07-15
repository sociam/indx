
import tweetstream, urllib2, json, pywebbox

webbox = pywebbox.WebBox("http://webbox.ecs.soton.ac.uk", "tweets", "user", "password", "twitter-crawler")
version = 0 # box version

def update(tweet):
    global version
    try:
        response = webbox.update(version, tweet)
        version = response['data']['@version'] # update the version
    except Exception as e:
        if isinstance(e, urllib2.HTTPError): # handle a version incorrect error, and update the version
            if e.code == 409: # 409 Obsolete
                version = json.loads(e.read())['@version']
                update(tweet) # try updating again now the version is correct

while True:
    with tweetstream.FilterStream("twitter-user", "twitter-password", track = "search-term") as stream:
        for tweet in stream:
            tweet["@id"] = unicode(tweet['id'])
            update(tweet)



