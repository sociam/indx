import glob, re

# search these python files for the modules they import
search_globs = [
    "libs/*.py",
    "*.py",
]

# cheap regexes - should use ast or parse modules if this causes problems
include_re1 = re.compile("^\s*import\s+(.*)\s*$")
include_re2 = re.compile("^\s*from\s+(.*)\s+import\s+(.*)\s*$")

# manipulation regexes
comma_re = re.compile("\s*,\s*")
comment_re = re.compile("#.*$")

# find modules
modules = {'pkg_resources': True} # defaults are from chameleon

# find any imports in each file
for search_glob in search_globs:
    for filename in glob.glob(search_glob):
        file = open(filename)
        for line in file.readlines():
            line_bits = comment_re.split(line)
            line = line_bits[0]

            match1 = include_re1.findall(line)
            if len(match1) > 0:
                # could be comma separated
                match1_data = match1[0]
                for include in comma_re.split(match1_data):
                    modules[include] = True

            match2 = include_re2.findall(line)
            if len(match2) > 0:
                match2_data = match2[0]
#                for include in comma_re.split(match2_data[1]):
#                    modules[match2_data[0] + "." + include] = True
                modules[match2_data[0]] = True
            
print str(modules.keys())
