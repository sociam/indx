import re, json

f = open("categs.xml", "r")
categories = {}
for line in f.readlines():
    line = line.rstrip()
    if "t_fullname=" in line:
        m = re.search("t_fullname=\"(.*?)\"", line)
        if m is None:
            continue

        name = m.group(1)
        name = name.replace("&amp;", "&")

        if " > " in name:
            levels = name.split(" > ")
            if len(levels) != 2:
                continue

            level1, level2 = levels
            if level1 not in categories:
                categories[level1] = []
            categories[level1].append(level2)
        else:
            if name not in categories:
                categories[name] = []
f.close
print json.dumps(categories, indent=2)
