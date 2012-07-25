from fourstoremgmt import FourStoreMgmt
import time

kb = "webbox_das05r"
mgmt = FourStoreMgmt(kb, http_port=8212)

print "About to start 4store.."
mgmt.start()
print "Started 4store... waiting 5s"
time.sleep(5)
print "About to stop 4store"
mgmt.stop()
print "Stopped."

