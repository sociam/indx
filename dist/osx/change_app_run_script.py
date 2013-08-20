import sys

# Modify a py2app created Info.plist to change it to run our app

if len(sys.argv) != 2:
    # do nothing if file not specified
    sys.exit("Usage: %s <Info.plist>" % sys.argv[0])

nextline = False
output = ""

f = open(sys.argv[1])
for line in f.readlines():
    if nextline:
        nextline = False
        output += "\t<string>run_app.sh</string>\n"
    else:
        output += line

    if "<key>CFBundleExecutable</key>" in line:
        nextline = True

f.close()

f_out = open(sys.argv[1], "w")
f_out.write(output)
f_out.close()

