import shelve

vaults = shelve.open("../data/vaults")

for key in vaults:
    print key
    print str(vaults[key])
