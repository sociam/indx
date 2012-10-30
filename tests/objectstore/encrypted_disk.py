import psycopg2, time, sys, logging
import cProfile
from encryption import EncryptedDisk

logger = logging.getLogger() # root logger
logger.setLevel(logging.DEBUG)


filename = "/tmp/enc_disk.dmg"
mountpoint = "/tmp/mounted"

password = "secret"

enc = EncryptedDisk(filename, mountpoint)
success = enc.create(password)

if success:
    enc.mount(password)
    enc.unmount()
else:
    print "Failed to create encrypted disk."


