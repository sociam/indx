#    Copyright (C) 2011-2014 University of Southampton
#    Copyright (C) 2011-2014 Daniel Alexander Smith
#    Copyright (C) 2011-2014 Max Van Kleek
#    Copyright (C) 2011-2014 Nigel R. Shadbolt
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License, version 3,
#    as published by the Free Software Foundation.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.


# some from http://stackoverflow.com/questions/12524994/encrypt-decrypt-using-pycrypto-aes-256
 
from Crypto import Random
from Crypto.Cipher import AES
from Crypto.Hash import SHA256
import base64
import logging
from twisted.internet.defer import Deferred


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
import Crypto.Hash.SHA512

def sha512_hash(src):
    h = Crypto.Hash.SHA512.new()
    h.update(src)
    return h.hexdigest()


# Use a key size of 3072, recommended from http://en.wikipedia.org/wiki/Key_size / http://www.emc.com/emc-plus/rsa-labs/standards-initiatives/key-size.htm
def generate_rsa_keypair(size):
    """ Generate a new public and private key pair (strings) of specified size. """
    logging.debug("Generating a new {0}-bit RSA key, this might take a second...".format(size))

    PRNG = Crypto.Random.OSRNG.posix.new().read
    key = Crypto.PublicKey.RSA.generate(size, PRNG)

    public_key = key.publickey().exportKey()
    private_key = key.exportKey()

    # generate a SHA512 hash of the public key to identify it
    public_hash = sha512_hash(public_key)

    return {"public": public_key, "private": private_key, "public-hash": public_hash}

def load_key(key):
    """ Load a key from a string into a RSA key object. """
    return Crypto.PublicKey.RSA.importKey(key)

def rsa_encrypt(key, message):
    """ Use a public key (RSA object loaded using the load_key function above) to encrypt a message into a string. """
    return base64.encodestring(key.encrypt(message, None)[0])

def rsa_decrypt(key, ciphertext):
    """ Use a private key (RSA object loaded using the load_key function above) to decrypt a message into the original string. """
    return key.decrypt(base64.decodestring(ciphertext))

def rsa_sign(private_key, plaintext):
    """ Hash and sign a plaintext using a private key. Verify using rsa_verify with the public key. """
    hsh = sha512_hash(plaintext)
    PRNG = Crypto.Random.OSRNG.posix.new().read
    signature = private_key.sign(hsh, PRNG)
    return signature[0]

def rsa_verify(public_key, plaintext, signature):
    """ Hash and and verify a plain text using a public key. """
    hsh = sha512_hash(plaintext)
    signature_tuple = (signature, )
    return public_key.verify(hsh, signature_tuple) == True # convert from 0/1 to False/True

### Auth functions

def auth_keys(keystore, signature, key_hash, algo, method, sessionid):
    return_d = Deferred()

    SSH_MSG_USERAUTH_REQUEST = "50"

    def keystore_cb(keystore_results):

        key = keystore_results['key'] # used to verify, below
        user = keystore_results['username']
        box = keystore_results['box']

        ordered_signature_text = '{0}\t{1}\t"{2}"\t{3}\t{4}'.format(SSH_MSG_USERAUTH_REQUEST, sessionid, method, algo, key_hash)
        verified = rsa_verify(key['public'], ordered_signature_text, signature)
        
        if not verified:
            logging.error("auth_keys error, signature does not verify, returning unauthorized")
            return_d.errback(None)
        else:
            return_d.callback((user, box))

    keystore.get(key_hash).addCallbacks(keystore_cb, return_d.errback)
    return return_d


def auth_client(self, private_key, key_hash, sessionid):
    """ Key based authentication, similar to RFC4252.
    
        This is a client-side helper to sign the text block used by the server to verify.
    """
    SSH_MSG_USERAUTH_REQUEST = "50"
    method = "publickey"
    algo = "SHA512"

    self.is_authed = False

    ordered_signature_text = '{0}\t{1}\t"{2}"\t{3}\t{4}'.format(SSH_MSG_USERAUTH_REQUEST, sessionid, method, algo, key_hash)
    signature = self.rsa_sign(private_key, ordered_signature_text)

    values = {"signature": signature, "key_hash": key_hash, "algo": algo, "method": method}

    return values

