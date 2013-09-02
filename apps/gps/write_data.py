#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Kleek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License, version 3,
#    as published by the Free Software Foundation.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.

import argparse, logging, getpass, sys, urllib2, json, uuid, time
from xml.dom import minidom
from pyindx import IndxClient

""" Set up the arguments, and their defaults. """
parser = argparse.ArgumentParser(description='Push data from a JSON file into INDX.')
parser.add_argument('user', type=str, help="INDX username, e.g. indx")
parser.add_argument('address', type=str, help="Address of the INDX server, e.g. http://indx.example.com:8211/")
parser.add_argument('box', type=str, help="Box to assert tweets into")
parser.add_argument('file', type=str, help="The file where the data is, as JSON")
parser.add_argument('--appid', type=str, default="Data Pusher", help="Override the appid used for the INDX assertions")
parser.add_argument('--debug', default=False, action="store_true", help="Enable debugging")
parser.add_argument('--profile', default=False, action="store_true", help="Enable profiling")
args = vars(parser.parse_args())

if args['debug']:
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.INFO)

# Prompt for the INDX password
password = getpass.getpass()
indx = IndxClient(args['address'], args['box'], args['user'], password, args['appid'])
version = 0 # box version
points = [] # data point to be updated

def read_track_file(file):
    dom = minidom.parse(file)
    obj_list = []
    trks = dom.getElementsByTagName("trk")
    for trk in trks:
        obj_list = obj_list + read_track(trk)
    return obj_list

def read_all_points(file):
    dom = minidom.parse(file)
    obj_list = []
    trks = dom.getElementsByTagName("trk")
    for trk in trks:
        obj_list = obj_list + read_track_points(trk)
    return obj_list

def read_track(trk):
    trk_data = {}
    name = trk.getElementsByTagName("name")[0].firstChild.nodeValue.strip()
    name_parts = name.lower().split()
    name = "_".join(name_parts)
    trk_data["@id"] = name
    obj_list = []
    trk_segs = trk.getElementsByTagName("trkseg")
    for trk_seg in trk_segs:
        obj_list = obj_list + read_segment(trk_seg)
    trk_data["locations"] = []
    for pt in obj_list:
        trk_data["locations"].append({"@id": pt["@id"]})
    obj_list.append(trk_data)    
    return obj_list

def read_track_points(trk):
    obj_list = []
    trk_segs = trk.getElementsByTagName("trkseg")
    for trk_seg in trk_segs:
        obj_list = obj_list + read_segment(trk_seg)
    return obj_list

def read_segment(seg):
    if not seg.hasChildNodes(): 
        return []
    pts = []
    for pt in seg.childNodes:
        if not hasattr(pt, "tagName") or pt.tagName != "trkpt":
            continue
        pts.append(read_point(pt))
    return pts

def read_point(pt):
    t = "{0}000".format(int(time.mktime(time.strptime(pt.getElementsByTagName("time")[0].firstChild.nodeValue, "%Y-%m-%dT%H:%M:%SZ"))))
    return {
        "@id": "trkpt_{0}".format(uuid.uuid4()), 
        # "@id": "trkpt_{0}".format(t), # what if different points  with the same timestamp are added?
        # "@type": "http://linkedgeodata.org/ontology/Point",
        "latitude": [ { "@type": "http://www.w3.org/2001/XMLSchema#float", "@value": pt.getAttribute("lat") } ],
        "longitude": [ { "@type": "http://www.w3.org/2001/XMLSchema#float", "@value": pt.getAttribute("lon") } ],
        "elevation": [ { "@type": "http://www.w3.org/2001/XMLSchema#float", "@value": pt.getElementsByTagName("ele")[0].firstChild.nodeValue } ],
        "start": [ { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": t } ],
        "end": [ { "@type": "http://www.w3.org/2001/XMLSchema#integer", "@value": t } ]
    }

# u'my_location_diary': { u'@id': u'my_location_diary',
#                                      u'locations': [ { u'@id': u'my-location-1374226915159',
#                                                        u'@language': u'',
#                                                        u'@type': u''},
#                                                      { u'@id': u'my-location-1374226912494',
#                                                        u'@language': u'',
#                                                        u'@type': u''},
#                                                      { u'@id': u'my-location-1374226854520',
#                                                        u'@language': u'',
#                                                        u'@type': u''},
# u'my-location-1374226912494': { 
#     u'@id': u'my-location-1374226912494',
#     u'latitude': [ { u'@language': u'',
#                     u'@type': u'http://www.w3.org/2001/XMLSchema#float',
#                     u'@value': u'50.93852375695255'}],
#     u'longitude': [ { u'@language': u'',
#                     u'@type': u'http://www.w3.org/2001/XMLSchema#float',
#                     u'@value': u'-1.397087574005127'}],
#     u'start': [ { u'@language': u'',
#                 u'@type': u'http://www.w3.org/2001/XMLSchema#integer',
#                 u'@value': u'1374226912494'}],
#     u'end': [ { u'@language': u'',
#                 u'@type': u'http://www.w3.org/2001/XMLSchema#integer',
#                 u'@value': u'1374226912494'}]
# },


# update function uses prepare_data + _put
# or directly _put function 

def write_track_to_box(objects):
    global version
    try:
        logging.info("trying to write version {0} of the objects: {1}".format(version, objects))
        response = indx.update_raw(version, objects)
        version = response['data']['@version'] # update the version
        print response
    except Exception as e:
        if isinstance(e, urllib2.HTTPError): # handle a version incorrect error, and update the version
            if e.code == 409: # 409 Obsolete
                response = e.read()
                json_response = json.loads(response)
                version = json_response['@version']
                write_track_to_box(objects) # try updating again now the version is correct
                pass
        else:
            logging.error("Error updating INDX: {0}".format(e))
            return False                   
    return True

def find_object_by_id(the_id):
    return indx.get_by_ids([the_id])["data"][the_id]

if __name__ == '__main__':
    if args['file']:
        points = read_all_points(args['file'])

        print write_track_to_box(points)
        
        diary = find_object_by_id("my_location_diary")
        print "\ndiary:\n"+str(diary)

        for point in points:
            diary["locations"].append({"@id": point["@id"]})
        # print "\ndiary:\n"+str(diary)
        
        print write_track_to_box([diary])
        
        diary_updated = find_object_by_id("my_location_diary")
        print "\ndiary updated:\n"+str(diary_updated)

        # objects = read_track_file(args['file'])
        # print write_track_to_box(objects)
        # print find_object_by_id("running1")
