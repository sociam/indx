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


import hashlib, base64, re, rdflib, logging

from rdflib.graph import Graph
from Crypto.Cipher import AES
from cStringIO import StringIO

from sparqlparse import SparqlParse

class RDFCrypto:
    def __init__(self, key, hashstore):
        self.set_key(key)
        self.hashstore = hashstore
        self.rdf_formats = {
            "application/rdf+xml": "xml",
            "application/n3": "n3",
            "text/turtle": "n3", # no turtle-specific parser in rdflib ATM, using N3 one because N3 is a superset of turtle
        }

    def set_key(self, key):
        if key is None:
            self.secret = None
        else:
            self.secret = hashlib.sha256(key).digest()

    def add_hashed_data(self, hashes_dict):
        """ Add hashed data to a local store. """
        logging.debug("adding to hashstore")
        self.hashstore.add(hashes_dict)

    def hash_entity(self, entity):
        if self.secret is None:
            return entity

        # SHA256
        hsh = "sha256:" + hashlib.sha256(entity).hexdigest()
        if type(entity) is rdflib.Literal:
            return rdflib.Literal(hsh)
        elif type(entity) is rdflib.URIRef:
            return rdflib.URIRef(hsh)
        elif type(entity) is rdflib.BNode:
            return entity # YES WE IGNORE THE ABOVE CHECK THIS IS CORRECT
        else:
            return hsh # this happens when we send in part of a query to hash

    def lookup_and_decrypt_entity(self, hashed):
        """ Look up a hashed entity (e.g. u'sha256:239857235h239058gh...')
            in the hash to encrypted entity store, and then decrypt with the secret key.
        """

        if self.secret is None:
            return hashed

        if type(hashed) is rdflib.BNode:
            return hashed

        try:
            entity = self.hashstore.get(hashed)
            return self.decrypt_entity(entity)
        except Exception as e:
            """ Can't find entity in the hashstore? Return as-is, it is probably just not encrypted. """
            return hashed

    
    def decrypt_entity(self, entity):
        if self.secret is None:
            return entity

        # the block size for the cipher object; must be 16, 24, or 32 for AES
        BLOCK_SIZE = 32

        # the character used for padding--with a block cipher such as AES, the value
        # you encrypt must be a multiple of BLOCK_SIZE in length.  This character is
        # used to ensure that your value is always a multiple of BLOCK_SIZE
        PADDING = '\0'

        # one-liner to sufficiently pad the text to be encrypted
        pad = lambda s: s + (BLOCK_SIZE - len(s) % BLOCK_SIZE) * PADDING

        # one-liners to encrypt/encode and decrypt/decode a string
        # encrypt with AES, encode with base64
        EncodeAES = lambda c, s: base64.b64encode(c.encrypt(pad(s)))
        DecodeAES = lambda c, e: c.decrypt(base64.b64decode(e)).rstrip(PADDING)

        # create a cipher object using the random secret
        cipher = AES.new(self.secret)

        # decode a string
        decoded = DecodeAES(cipher, entity)
        decoded = unicode(decoded)

        if type(entity) is rdflib.Literal:
            return rdflib.Literal(decoded)
        elif type(entity) is rdflib.URIRef:
            return rdflib.URIRef(decoded)
        elif type(entity) is rdflib.BNode:
            return entity # YES WE IGNORE THE ABOVE CHECK THIS IS CORRECT
        else:
            return decoded # this happens when we decrypt sparql results


    def encrypt_entity(self, entity):
        """ entity can be any uri or literal, etc from rdflib, and we must return the same type of object! """

        if self.secret is None:
            return entity

        # the block size for the cipher object; must be 16, 24, or 32 for AES
        BLOCK_SIZE = 32

        # the character used for padding--with a block cipher such as AES, the value
        # you encrypt must be a multiple of BLOCK_SIZE in length.  This character is
        # used to ensure that your value is always a multiple of BLOCK_SIZE
        PADDING = '\0'

        # one-liner to sufficiently pad the text to be encrypted
        pad = lambda s: s + (BLOCK_SIZE - len(s) % BLOCK_SIZE) * PADDING

        # one-liners to encrypt/encode and decrypt/decode a string
        # encrypt with AES, encode with base64
        EncodeAES = lambda c, s: base64.b64encode(c.encrypt(pad(s)))
        DecodeAES = lambda c, e: c.decrypt(base64.b64decode(e)).rstrip(PADDING)

        # create a cipher object using the random secret
        cipher = AES.new(self.secret)

        # encode a string
        encoded = EncodeAES(cipher, entity)
        encoded = unicode(encoded)

        if type(entity) is rdflib.Literal:
            return rdflib.Literal(encoded)
        elif type(entity) is rdflib.URIRef:
            return rdflib.URIRef(encoded)
        elif type(entity) is rdflib.BNode:
            return entity # YES WE IGNORE THE ABOVE CHECK THIS IS CORRECT
        else:
            return encoded # this never happens... ?


    def decrypt_rdf(self, rdf):
        #lookup_and_decrypt_entity

        decrypted = None

        # deserialise rdf into triples
        encrypted_graph = Graph()
        encrypted_graph.parse(StringIO(rdf)) # format = xml, n3 etc

        graph = Graph()

        # encrypt each triple
        for s, p, o in encrypted_graph:
            if self.secret is None:
                dec_s = s
                dec_p = p
                dec_o = o
            else:
                dec_s = self.lookup_and_decrypt_entity(s)
                dec_p = self.lookup_and_decrypt_entity(p)
                dec_o = self.lookup_and_decrypt_entity(o)

            graph.add(( dec_s, dec_p, dec_o ))

        # reserialise into rdf
        decrypted = graph.serialize(format="xml") # format = xml, n3, nt, turtle etc

        return decrypted


    def encrypt_rdf(self, rdf, content_type):
        """ Encrypts RDF of any format and returns it encrypted in RDF/XML """

        rdf_format = "xml"
        if content_type in self.rdf_formats:
            rdf_format = self.rdf_formats[content_type]

        encrypted = None

        logging.debug("encrypting rdf: parsing graph of type [%s] from content_type: [%s]" % (rdf_format, content_type))
        logging.debug("rdf is: %s" % rdf)

        # deserialise rdf into triples
        graph = Graph()
        logging.debug("graph made")
        graph.parse(StringIO(rdf), format=rdf_format) # format = xml, n3 etc
        logging.debug("graph parsed")

        encrypted_graph = Graph()

        # encrypt each triple
        for s, p, o in graph:
            logging.debug("looping through graph")
            enc_s = self.encrypt_entity(s)
            enc_p = self.encrypt_entity(p)
            enc_o = self.encrypt_entity(o)

            # hash each triple and store in a hash table
            hash_s = self.hash_entity(s)
            hash_p = self.hash_entity(p)
            hash_o = self.hash_entity(o)

            if self.secret is not None:
                self.add_hashed_data({
                    hash_s: enc_s,
                    hash_p: enc_p,
                    hash_o: enc_o,
                });

            encrypted_graph.add(( hash_s, hash_p, hash_o ))

        # reserialise into rdf
        encrypted = encrypted_graph.serialize(format="xml") # format = xml, n3, nt, turtle etc

        logging.debug("graph has been encrypted, rdf is: %s" % encrypted)

        return encrypted

    def hash_sparql_query(self, query):
        """ take a sparql query, and replace each URI and literal with their hashed equivalents, according to the specified key """
        if self.secret is None:
            return query


        def uri_repl(match):
            uri = match.group()
            orig = uri[1:len(uri)-1]
            hashed = self.hash_entity(orig)
            return "<%s>" % hashed

        def literal_repl(match):
            literal = match.group()
            orig = literal[1:len(literal)-1]
            hashed = self.hash_entity(orig)
            return "\"%s\"" % hashed

        logging.debug("query: " + str(query))

        s = SparqlParse(query)
        query = s.expand_qnames()

        logging.debug("query expanded qnames: " + str(query))

        # just regex <> and "" ...
        p_uri = re.compile(r'[<][^>]*?[>]')
        query = p_uri.sub(uri_repl, query)

        logging.debug("query, uris replaced: " + str(query))

        p_literal = re.compile(r'["][^"]*?["]')
        query = p_literal.sub(literal_repl, query)

        logging.debug("query, uris and literals replaced: " + str(query))

        return query
        
    def decrypt_sparql_results(self, results):
        dec_res = []

        for result in results:
            dec_result = {}
            for var in result:
                value = result[var]
                typ = value['type']
                val = value['value']

                if typ != "bnode":
                    dec_val = self.lookup_and_decrypt_entity(val)
                else:
                    dec_val = val

                dec_result[var] = {'type': typ, 'value': dec_val}

            dec_res.append(dec_result)

        return dec_res

