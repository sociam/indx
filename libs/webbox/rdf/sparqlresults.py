#    This file is part of INDX.
#
#    Copyright 2011-2012 Daniel Alexander Smith
#    Copyright 2011-2012 University of Southampton
#
#    INDX is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    INDX is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with INDX.  If not, see <http://www.gnu.org/licenses/>.


import logging
import cElementTree
import json

from cStringIO import StringIO
from lxml.builder import E
from lxml import etree

class SparqlResults:
    """ Parse SPARQL results, and output SPARQL results in different formats."""

    def __init__(self):
        pass

    def parse_sparql_xml(self, data):
        """ New cElementTree SPARQL Results format parser, Copyright (c) 2011 Daniel A. Smith (written 2011-02-23) """
        current_type = None
        current_name = ""
        current_chars = ""
        results = []
        current = {}

        logging.debug(data)

        for event, elem in cElementTree.iterparse(StringIO(data), events=("start","end")):
            if event == "start":
                if elem.tag == '{http://www.w3.org/2005/sparql-results#}uri':
                    current_type = 'uri'
                elif elem.tag == '{http://www.w3.org/2005/sparql-results#}literal':
                    current_type = 'literal'
                elif elem.tag == '{http://www.w3.org/2005/sparql-results#}binding':
                    current_name = elem.attrib['name']
                elif elem.tag == '{http://www.w3.org/2005/sparql-results#}bnode':
                    current_type = 'bnode'

            elif event == "end":
                if elem.tag == '{http://www.w3.org/2005/sparql-results#}uri':
                    current_chars = elem.text
                elif elem.tag == '{http://www.w3.org/2005/sparql-results#}literal':
                    current_chars = elem.text
                elif elem.tag == '{http://www.w3.org/2005/sparql-results#}bnode':
                    current_chars = elem.text
                elif elem.tag == '{http://www.w3.org/2005/sparql-results#}binding':
                    current[current_name] = {'value': current_chars, 'type': current_type}
                    if elem.attrib.has_key('xml:lang'):
                        current[current_name]['xml:lang'] = elem.attrib['xml:lang']
                    current_chars = ""
                elif elem.tag == '{http://www.w3.org/2005/sparql-results#}result':
                    results.append(current)
                    current = {}

                elem.clear()

        return results

    def sparql_results_to_xml(self, results):
        """ Convert sparql results dict to XML, using lxml E-factory builder. """
        variables = {}
        results_xml = E.results()

        for result in results:
            result_xml = E.result()
            for var in result:
                variables[var] = True

                value = result[var]
                typ = value['type']
                val = unicode(value['value'])
                
                # <binding><$typ name="var">val</$typ></binding>
                binding = E.binding(getattr(E, typ)(val), {'name': var})
                result_xml.append(binding)

            results_xml.append(result_xml)

        head = E.head()

        for var in variables:
            head.append( E.variable("", {"name": var}))

        sparql = E.sparql(
            head,
            results_xml,
            {"xmlns": "http://www.w3.org/2005/sparql-results#"})

        return etree.tostring(sparql, pretty_print=True)

    def sparql_results_to_json(self, results):
        """ Convert sparql results dict to JSON, using json module. """

        vars_dict = {}
        results_out = []

        for result in results:
            result_json = {}
            for var in result:
                vars_dict[var] = True

                value = result[var]
                typ = value['type']
                val = unicode(value['value'])
                
                result_json[ var ] = { "type": typ, "value": val }

            results_out.append(result_json)

        vars_out = []
        for var in vars_dict:
            vars_out.append(var)

        out = {
            "head": {
                "vars": vars_out,
            },
            "results": {
                "bindings": results_out,
            },
        }
        return json.dumps(out, indent=2)

