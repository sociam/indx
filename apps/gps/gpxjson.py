import sys
import json
from xml.dom import minidom

def gpxToJson(gpxFile):
  return json.dumps(parseGpx(gpxFile))

def parseGpx(gpxFile):
  dom = minidom.parse(gpxFile)
  outputTracks = []

  tracks = dom.getElementsByTagName("trk")
  for track in tracks:
    outputTracks.append(readTrack(track))

  return outputTracks

def readTrack(track): 
  trackData = {"name": getTextValue(track, "name")}
  trackData["segments"] = []

  trackSegments = track.getElementsByTagName("trkseg")
  for trackSegment in trackSegments:
    trackData["segments"].append(readTrackSegment(trackSegment));

  return trackData
    

def readTrackSegment(segment):
  if not segment.hasChildNodes(): return []
  points = []

  for point in segment.childNodes:
    if not hasattr(point, "tagName") or point.tagName != "trkpt":
      continue
    points.append(readTrackPoint(point))

  return points

def readTrackPoint(point):
  return {
    "lat": point.getAttribute("lat"),
    "lon": point.getAttribute("lon"),
    "elevation": getTextValue(point, "ele"),
    "time": getTextValue(point, "time")
  }



## Utility

def getTextValue(node, tagName):
  return node.getElementsByTagName(tagName)[0].firstChild.nodeValue

print gpxToJson(sys.argv[1])