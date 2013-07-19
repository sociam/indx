#    Copyright (C) 2011-2013 University of Southampton
#    Copyright (C) 2011-2013 Daniel Alexander Smith
#    Copyright (C) 2011-2013 Max Van Klek
#    Copyright (C) 2011-2013 Nigel R. Shadbolt
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

# import core module
import logging

class SparqlParse:
    """ Parse SPARQL queries, tokenise them, resolve qNames to full URIs, and recreate them. """

    def __init__(self, query):
        logging.debug("SparqlParse init with query:")
        logging.debug(query)
        self.query = query
        self.query_types = [
            "DESCRIBE",
            "SELECT",
            "ASK",
            "CONSTRUCT",
        ]
        self.verb = None # e.g. SELECT, DESCRIBE etc. populated on parse

    def get_verb(self):
        """ Return the query_type, e.g. DESCRIBE, ASK, SELECT, or CONSTRUCT."""
        logging.debug("getting query verb")
        if self.verb is None:
            logging.debug("tokenising query")
            tokens = self.tokenize()
            self._get_prefixes(tokens)

        logging.debug("returning verb as \"%s\"" % str(self.verb))

        return self.verb

    def tokenize(self):
        tokens = []
        state = "token"
        curr_token = ""

        for char in self.query:
            if state is None:
                if char == " " or char == '\n' or char == '\r':
                    pass
                elif char == '"':
                    state = "quoted"
                    curr_token += char
                elif char == "<":
                    state = "uri"
                    curr_token = char
                elif char == "{":
                    tokens.append(char)
                    curr_token = ""
                    state = None
                elif char == "}":
                    tokens.append(char)
                    curr_token = ""
                    state = None
                else:
                    state = "token"
                    curr_token += char
            elif state == "token":
                if char == '"':
                    if len(curr_token) > 0: tokens.append(curr_token)
                    curr_token = char
                    state = "quoted"
                elif char == "<":
                    if len(curr_token) > 0: tokens.append(curr_token)
                    curr_token = char
                    state = "uri"
                elif char == "{":
                    if len(curr_token) > 0: tokens.append(curr_token)
                    tokens.append(char)
                    curr_token = ""
                    state = None
                elif char == "}":
                    if len(curr_token) > 0: tokens.append(curr_token)
                    tokens.append(char)
                    curr_token = ""
                    state = None
                elif char == " " or char == '\n' or char == '\r':
                    if len(curr_token) > 0: tokens.append(curr_token)
                    curr_token = ""
                    state = None
                else:
                    curr_token += char
            elif state == "quoted":
                if char == '"':
                    state = None
                    curr_token += char
                    tokens.append(curr_token)
                    curr_token = ""
                elif char == '\\':
                    state = "escape_include_quoted"
                    curr_token += char
                else:
                    curr_token += char
            elif state == "escape_include_quoted":
                curr_token += char
                state = "quoted"
            elif state == "uri":
                if char == '>':
                    state = None
                    curr_token += char
                    tokens.append(curr_token)
                    curr_token = ""
                else:
                    curr_token += char

        if len(curr_token) > 0: tokens.append(curr_token)

        return tokens

    def untokenize(self, tokens):
        return " ".join(tokens)

    def expand_qnames(self):
        tokens = self.tokenize()        

        logging.debug("tokens")
        logging.debug(str(tokens))

        prefixes = self._get_prefixes(tokens)
        tokens_wo_prefixes = prefixes['tokens_wo_prefixes']

        logging.debug("prefixes")
        logging.debug(str(prefixes))

        new_tokens = []
        for token in tokens_wo_prefixes:
            if token[0] != '"' and token[0] != "?" and token[0] != "<":
                if ":" in token:
                    parts = token.split(":")
                    if parts[0] in prefixes['prefixes']:
                        new_tokens.append( "<" + prefixes['prefixes'][ parts[0] ] + parts[1] + ">")
                    else:
                        new_tokens.append(token)
                else:
                    new_tokens.append(token)
            else:
                new_tokens.append(token)


        logging.debug("untokenise")
        logging.debug(str(new_tokens))
        untokenised = self.untokenize(new_tokens)
        logging.debug(untokenised)
        
        return untokenised

    def _get_prefixes(self, tokens):
        """ get the prefixes from the query, and a version of the query without prefixes """
        prefixes = {'prefixes': {}, 'tokens_wo_prefixes': []}
        state = None
        state_data = {}
        for tokval in tokens:
            if state is None:
                """ looking for new prefix """
                if (tokval == "PREFIX"):
                    state = "new_prefix"
                elif (tokval in self.query_types):
                    self.verb = tokval
                    state = "query"
                    prefixes['tokens_wo_prefixes'].append(tokval)
            elif state == "new_prefix":
                """ read ns prefix """
                state = "prefix_ns"
                state_data['prefix'] = tokval[0:len(tokval)-1]
            elif state == "prefix_ns":
                """ read ns """
                prefixes['prefixes'][ state_data['prefix'] ] = tokval[1:len(tokval)-1]
                state_data = {}
                state = None
            elif state == "query":
                """ query """
                prefixes['tokens_wo_prefixes'].append(tokval)

        return prefixes

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG) # print debug msgs

    query = 'PREFIX rdfs: <http://rdfs.com/> PREFIX securestore: <http://securestore.ecs.soton.ac.uk/ns#> SELECT ?x ?label WHERE {?x rdfs:label ?label}'
    s = SparqlParse(query)
    new_q = s.expand_qnames()

    logging.debug("query")
    logging.debug(query)
    logging.debug("expanded")
    logging.debug(new_q)

