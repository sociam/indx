import shelve, sys

vaults = shelve.open(sys.argv[1])

for key in vaults:
    print key
    print str(vaults[key])
