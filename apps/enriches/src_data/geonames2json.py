import json
f = open("/Users/das05r/Downloads/GB/GB.txt", "r")
places = []
for line in f.readlines():
    line = line.rstrip()
    fields = line.split("\t")
    if fields[6][0] == "P":
        if fields[1] not in places:
            places.append(fields[1])

print json.dumps(places)
