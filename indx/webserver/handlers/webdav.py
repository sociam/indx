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

import time, os, logging, shutil, uuid
from exception import ResponseOverride
from lxml import objectify

class WebDAVHandler:
    """ WebDAV module. """
    
    def __init__(self):
        """ Create a new WebDAV handler, created per request. """
        pass

    def get_prop_xml(self, url, path, directory=False, displayname=None):
        """ Get the property XML (for WebDAV) for this file. """

        stat = os.stat(path)
        creation = time.strftime("%Y-%m-%dT%H:%M:%S%z", time.gmtime(stat.st_ctime) )
        length = str(stat.st_size)
        modified = time.strftime("%A, %d-%b-%y %H:%M:%S GMT", time.gmtime(stat.st_mtime) )

        if directory or os.path.isdir(path):
            resourcetype = "<D:resourcetype><D:collection/></D:resourcetype>"
        else:
            resourcetype = "<D:resourcetype/>"

        if displayname is not None:
            displayname = "<D:displayname>%s</D:displayname>" % displayname
        else:
            displayname = ""

        return """
<D:response>
 <D:href>%s</D:href>
 <D:propstat>
  <D:prop>
   <D:quota-available-bytes/>
   <D:quota-used-bytes/>
   <D:quota/>
   <D:quotaused/>
   <D:creationdate>
    %s
   </D:creationdate>
   <D:getcontentlength>
    %s
   </D:getcontentlength>
   <D:getlastmodified>
    %s
   </D:getlastmodified>
   %s
   %s
   <D:supportedlock>
    <D:lockentry>
     <D:lockscope><D:exclusive/></D:lockscope>
     <D:locktype><D:write/></D:locktype>
    </D:lockentry>
    <D:lockentry>
     <D:lockscope><D:shared/></D:lockscope>
     <D:locktype><D:write/></D:locktype>
    </D:lockentry>
   </D:supportedlock>
  </D:prop>
 </D:propstat>
</D:response>
""" % (url, creation, length, modified, displayname, resourcetype)

    def do_DELETE(self, request):
        """ Delete a file / dir, used by WebDAV. """

        file_path = self.get_file_path(request.path)
        logging.debug("Deleting %s" % file_path)

        if not os.path.exists(file_path):
            return{"status": 404, "reason": "Not Found", "data": ""}

        if os.path.isdir(file_path):
            os.rmdir(file_path) # only works on empty dirs
        else:
            os.remove(file_path)

        return {"status": 204, "reason": "No Content", "data": ""}

    def do_MKCOL(self, request):
        """ WebDAV command to make a collection (i.e., a directory). """

        file_path = self.get_file_path(request.path)
        logging.debug("Making new folder %s" % file_path)
        if os.path.exists(file_path):
            raise ResponseOverride(409, "Conflict")

        try:
            os.mkdir(file_path)
        except Exception as e:
            logging.error("Couldn't make directory ({0}): {1}".format(str(e),str(file_path)))
            raise ResponseOverride(500, "Internal Server Error")

        return {"status": 204, "reason": "No Content", "data": ""}

    
    def do_MOVE(self, request):
        """ WebDAV command to move (rename) a file. """

        file_path = self.get_file_path(request.path)
        logging.debug("Moving from file %s" % file_path)
        if not os.path.exists(file_path):
            raise ResponseOverride(404, "Not Found")

        destination = request.getHeader("Destination")

        dest_file_path = self.get_file_path(destination)
        logging.debug("Moving to file %s" % dest_file_path)

        os.rename(file_path, dest_file_path)

        return {"status": 204, "reason": "No Content", "data": ""}

    def do_COPY(self, request):
        """ WebDAV command to copy a file. """

        file_path = self.get_file_path(request.path)
        logging.debug("Copying from file %s" % file_path)
        if not os.path.exists(file_path):
            raise ResponseOverride(404, "Not Found")

        destination = request.getHeader("Destination")

        dest_file_path = self.get_file_path(destination)
        logging.debug("Copying to file %s" % dest_file_path)

        if os.path.isdir(file_path):
            shutil.copytree(file_path, dest_file_path)
        else:
            shutil.copyfile(file_path, dest_file_path)

        return {"status": 204, "reason": "No Content", "data": ""}


    def do_PROPFIND(self, request):
        logging.debug("WebDAV PROPFIND")

        size = 0
        if request.getHeader("Content-length") is not None:
            size = int(request.getHeader("Content-length"))

        rfile = ""
        if size > 0:
            # read into rfile
            rfile = request.content.read(size)

        if rfile != "":
            logging.debug("got request: " + rfile)

        # FIXME we ignore the specifics of the request and just give what Finder wants: getlastmodified, getcontentlength, creationdate and resourcetype
        xmlout = ""

        file_path = self.get_file_path(request.path)
        logging.debug("For PROPFIND rfile is: "+file_path)

        if os.path.exists(file_path):
            if os.path.isdir(file_path):
                # do an LS
                displayname = None
                if request.path == "/":
                    displayname = "INDX"
                xmlout += self.get_prop_xml(self.server_url + request.path, file_path, directory=True, displayname=displayname)
                for filename in os.listdir(file_path):
                    fname = filename
                    if request.path[-1:] != "/":
                        fname = "/" + filename

                    xmlout += self.get_prop_xml(self.server_url + request.path + fname, file_path + os.sep + filename)
            else:
                # return the properties for a single rfile
                xmlout += self.get_prop_xml(self.server_url + request.path, file_path)
        else:
            logging.debug("Not found for PROPFIND")
            return {"status": 404, "reason": "Not Found", "data": ""}

        # surround in xml
        xmlout = "<?xml version=\"1.0\" encoding=\"utf-8\" ?>\n<D:multistatus xmlns:D=\"DAV:\">" + xmlout + "\n</D:multistatus>"

        xmlout = xmlout.encode("utf8")

        logging.debug("Sending propfind: " + xmlout)

        return {"status": 207, "reason": "Multi-Status", "data": xmlout, "type": "text/xml; charset=\"utf-8\""}

        
    def do_LOCK(self, request):
        logging.debug("WebDAV Lock on file: "+request.path)

        try:
            fileroot = self.server_url + request.path

            x = objectify.fromstring(file)

            owner = x.owner.href.text
            lockscope = str([ el.tag for el in x.lockscope.iterchildren() ][0])[6:] # 6: gets rid of {DAV:}
            locktype = str([ el.tag for el in x.locktype.iterchildren() ][0])[6:]
            

            token = "urn:uuid:%s" % (str(uuid.uuid1()))

            lock = """
           <D:locktype><D:%s/></D:locktype>
           <D:lockscope><D:%s/></D:lockscope>
           <D:depth>infinity</D:depth>
           <D:owner>
             <D:href>%s</D:href>
           </D:owner>
           <D:timeout>Second-604800</D:timeout>
           <D:locktoken>
             <D:href
             >%s</D:href>
           </D:locktoken>
           <D:lockroot>
             <D:href
             >%s</D:href>
           </D:lockroot>
""" % (locktype, lockscope, owner, token, fileroot)

            lock = """
<?xml version="1.0" encoding="utf-8" ?> 
  <D:prop xmlns:D="DAV:"> 
    <D:lockdiscovery> 
      <D:activelock>
""" + lock + """
      </D:activelock>
    </D:lockdiscovery>
  </D:prop>
"""
            return {"status": 200, "reason": "OK", "data": lock, type: "application/xml; charset=\"utf-8\"", "headers": [("Lock-Token", "<"+token+">")]}

        except Exception as e:
            logging.debug("Error in LOCK, {0}".format(str(e)))
            return {"status": 400, "reason": "Bad Request", "data": ""}



    def do_UNLOCK(self, request):
        logging.debug("WebDAV Unlock on file: "+request.path)
        # FIXME always succeeds
        return {"status": 204, "reason": "No Content", "data": ""}

    
