#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    Foobar is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.


#    This file is part of WebBox.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
#
#    WebBox is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    Foobar is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.


from M2Crypto import RSA, X509, EVP, m2, Rand, Err, util
from diskstore import DiskStore
import pickle

class WebboxX509:
    """Generate X509 certificates, and encrypt/decrypt messages using them. Also keeps a store of known certificates for decrypting messages etc."""

    def __init__(self, certstore_file):
        if certstore_file is not None:
            self.store = DiskStore(certstore_file)
        else:
            self.store = None

    def _serialise(self, obj):
        return pickle.dumps(obj)

    def _unserialise(self, ser):
        return pickle.loads(ser)

    def add(self, hashes):
        """ Add to the certificate store."""
        if self.store is not None:
            for key in hashes:
                self.store.set(key, [ self._serialise(hashes[key]) ])

    def get(self, hashed):
        """ Get from the certificate store."""
        if self.store is None:
            return None

        results = self.store.get(hashed)
        if len(results) == 0:
            return None

        result = results[0]
        return self._unserialise(result)


    def generate_cert(self, pkey, subject, webid):
        """Generate a new certificate."""

        cert = X509.X509()

        # Serial defaults to 0.
        cert.set_serial_number(1)
        cert.set_version(2)
        cert.set_subject(subject)
        issuer = X509.X509_Name()
        issuer.CN = 'Local WebBox'
        issuer.O = 'Issued by a local WebBox user.'
        cert.set_issuer(issuer)
        cert.set_pubkey(pkey)
        notBefore = m2.x509_get_not_before(cert.x509)
        notAfter  = m2.x509_get_not_after(cert.x509)
        m2.x509_gmtime_adj(notBefore, 0)
        days = 365*10 # 10 year validity
        m2.x509_gmtime_adj(notAfter, 60*60*24*days)

        cert.add_ext(
            X509.new_extension('subjectAltName', 'URI:'+webid))
        ext = X509.new_extension('nsComment', 'WebBox generated certificate')
        ext.set_critical(0)# Defaults to non-critical, but we can also set it
        cert.add_ext(ext)

        # not signed by anybody
#        cert.sign(caPkey, 'sha1')

        assert(cert.get_ext('subjectAltName').get_name() == 'subjectAltName')
        assert(cert.get_ext_at(0).get_name() == 'subjectAltName')
        assert(cert.get_ext_at(0).get_value() == 'URI:'+webid)
        
        return cert

    def generateRSAKey(self):
        """ Make an RSA key """
        # RSA_F4 is the exponent, which is 65537
        return RSA.gen_key(2048, m2.RSA_F4, callback=util.no_passphrase_callback)

    def makePKey(self, key):
        """ Make a public key """
        pkey = EVP.PKey()
        pkey.assign_rsa(key)
        return pkey

    def generate_all(self, name, webid):
        """ Generate new keys and a certificate for a person with full name as "name" and webid URI as "webid". """
        output = {}

        rsa = self.generateRSAKey()
        pkey = self.makePKey(rsa)

        subject = X509.X509_Name()
        subject.CN = name
        subject.O = "LocalWebBox"
        subject.OU = "WebBox"

        cert = self.generate_cert(pkey, subject, webid)

        output['certificate_text'] = cert.as_text()
        output['certificate'] = cert.as_pem()
        output['public_key'] = pkey.as_pem(None, callback=util.no_passphrase_callback)
        output['public_key_modulus'] = pkey.get_modulus()
        output['private_key'] = rsa.as_pem(None, callback=util.no_passphrase_callback)

        if self.store is not None:
            self.add({webid: output}) # store certificate in the certificate store

        return output

    def encrypt(self, public_key_receiver, data):
        """ Encrypt a message using the public key of the receiver."""

        pass

    def decrypt(self, private_key_receiver, data):
        """ Decrypt a message using the private key of the receiver."""

        pass


if __name__ == "__main__":
#    print "Generating a certificate:"
    x509 = WebboxX509(None) # none means no store
    details = x509.generate_all("Dr Daniel Alexander Smith", "http://danielsmith.eu/me#dan")
    print str(details)

#    details2 = x509.generate_all("Dr Max Van Kleek", "http://hip.cat/foaf#i")
#    print str(details2)

    plaintext = "This is a text message string."

    print str("plaintext: " + plaintext)
    encrypted = x509.encrypt(details.public_key_modulus, plaintext)

    print str("encrypted: " + encrypted)
    decrypted = x590.decrypted(details.private_key, encrypted)

    print str("decrypted: " + decrypted)



