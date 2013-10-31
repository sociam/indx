# from http://stackoverflow.com/questions/12524994/encrypt-decrypt-using-pycrypto-aes-256
 
from Crypto import Random
from Crypto.Cipher import AES
from Crypto.Hash import SHA256
import base64
import logging

BS = 16
pad = lambda s: s + (BS - len(s) % BS) * chr(BS - len(s) % BS) 
unpad = lambda s : s[0:-ord(s[-1])]

## Symmetric Key Classes/Functions

class AESCipher:
    def __init__( self, key ):
        # TODO check that a SHA256 hash of the key is a good way to use AES
        h = SHA256.new()
        h.update(key)
        self.key = h.digest()

    def encrypt( self, raw ):
        raw = pad(raw)
        iv = Random.new().read( AES.block_size )
        cipher = AES.new( self.key, AES.MODE_CBC, iv )
        return base64.b64encode( iv + cipher.encrypt( raw ) ) 

    def decrypt( self, enc ):
        enc = base64.b64decode(enc)
        iv = enc[:16]
        cipher = AES.new(self.key, AES.MODE_CBC, iv )
        return unpad(cipher.decrypt( enc[16:] ))


def encrypt(plaintext, password):
    """ Encrypt a plaintext using a password. """
    aes = AESCipher(password)
    return aes.encrypt(plaintext)


def decrypt(cyphertext, password):
    """ Decrypt some cyphertext using a password. """
    aes = AESCipher(password)
    return aes.decrypt(cyphertext)


## PKI Classes/Functions

import Crypto.Random.OSRNG.posix
import Crypto.PublicKey.RSA

# Use a key size of 3072, recommended from http://en.wikipedia.org/wiki/Key_size / http://www.emc.com/emc-plus/rsa-labs/standards-initiatives/key-size.htm
def generate_rsa_keypair(size):
    """ Generate a new public and private key pair (strings) of specified size. """
    logging.debug("Generating a new {0}-bit RSA key, this might take a second...".format(size))

    PRNG = Crypto.Random.OSRNG.posix.new().read
    key = Crypto.PublicKey.RSA.generate(size, PRNG)

    public_key = key.publickey().exportKey()
    private_key = key.exportKey()
    return {"public": public_key, "private": private_key}

def load_key(key):
    """ Load a key from a string into a RSA key object. """
    return Crypto.PublicKey.RSA.importKey(key)

def rsa_encrypt(key, message):
    """ Use a public key (RSA object loaded using the load_key function above) to encrypt a message into a string. """
    return base64.encodestring(key.encrypt(message, None)[0])

def rsa_decrypt(key, ciphertext):
    """ Use a private key (RSA object loaded using the load_key function above) to decrypt a message into the original string. """
    return key.decrypt(base64.decodestring(ciphertext))



