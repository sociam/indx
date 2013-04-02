# -*- test-case-name: twisted.web.test.test_websocket -*-
# Copyright (c) 2009 Twisted Matrix Laboratories.
# See LICENSE for details.

"""
Note: This is from the associated branch for http://twistedmatrix.com/trac/ticket/4173
and includes support for the hixie-76 handshake.

WebSocket server protocol.

See U{http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol} for the
current version of the specification.

@since: 10.1
"""

import base64
from hashlib import md5, sha1
import itertools
import struct

from twisted.internet import interfaces
from twisted.python import log
from twisted.web.http import datetimeToString
from twisted.web.server import Request, Site, version, unquote
from zope.interface import implements


_ascii_numbers = frozenset(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])


(OPCODE_CONT, OPCODE_TEXT, OPCODE_BINARY,
 OPCODE_CLOSE, OPCODE_PING, OPCODE_PONG) = (0x0, 0x1, 0x2, 0x8, 0x9, 0xA)


ALL_OPCODES = (OPCODE_CONT, OPCODE_TEXT, OPCODE_BINARY,
               OPCODE_CLOSE, OPCODE_PING, OPCODE_PONG)


CONTROL_OPCODES = (OPCODE_CLOSE, OPCODE_PING, OPCODE_PONG)
DATA_OPCODES = (OPCODE_TEXT, OPCODE_BINARY)

# backported from twisted 11
# twisted.web.http
class _IdentityTransferDecoder(object):
    """
    Protocol for accumulating bytes up to a specified length.  This handles the
    case where no I{Transfer-Encoding} is specified.

    @ivar contentLength: Counter keeping track of how many more bytes there are
        to receive.

    @ivar dataCallback: A one-argument callable which will be invoked each
        time application data is received.

    @ivar finishCallback: A one-argument callable which will be invoked when
        the terminal chunk is received.  It will be invoked with all bytes
        which were delivered to this protocol which came after the terminal
        chunk.
    """
    def __init__(self, contentLength, dataCallback, finishCallback):
        self.contentLength = contentLength
        self.dataCallback = dataCallback
        self.finishCallback = finishCallback


    def dataReceived(self, data):
        """
        Interpret the next chunk of bytes received.  Either deliver them to the
        data callback or invoke the finish callback if enough bytes have been
        received.

        @raise RuntimeError: If the finish callback has already been invoked
            during a previous call to this methood.
        """
        if self.dataCallback is None:
            raise RuntimeError(
                "_IdentityTransferDecoder cannot decode data after finishing")

        if self.contentLength is None:
            self.dataCallback(data)
        elif len(data) < self.contentLength:
            self.contentLength -= len(data)
            self.dataCallback(data)
        else:
            # Make the state consistent before invoking any code belonging to
            # anyone else in case noMoreData ends up being called beneath this
            # stack frame.
            contentLength = self.contentLength
            dataCallback = self.dataCallback
            finishCallback = self.finishCallback
            self.dataCallback = self.finishCallback = None
            self.contentLength = 0

            dataCallback(data[:contentLength])
            finishCallback(data[contentLength:])


    def noMoreData(self):
        """
        All data which will be delivered to this decoder has been.  Check to
        make sure as much data as was expected has been received.

        @raise PotentialDataLoss: If the content length is unknown.
        @raise _DataLoss: If the content length is known and fewer than that
            many bytes have been delivered.

        @return: C{None}
        """
        finishCallback = self.finishCallback
        self.dataCallback = self.finishCallback = None
        if self.contentLength is None:
            finishCallback('')
            raise PotentialDataLoss()
        elif self.contentLength != 0:
            raise _DataLoss()

# Backported from twisted 11
# twisted.web._newclient
def makeStatefulDispatcher(name, template):
    """
    Given a I{dispatch} name and a function, return a function which can be
    used as a method and which, when called, will call another method defined
    on the instance and return the result.  The other method which is called is
    determined by the value of the C{_state} attribute of the instance.

    @param name: A string which is used to construct the name of the subsidiary
        method to invoke.  The subsidiary method is named like C{'_%s_%s' %
        (name, _state)}.

    @param template: A function object which is used to give the returned
        function a docstring.

    @return: The dispatcher function.
    """
    def dispatcher(self, *args, **kwargs):
        func = getattr(self, '_' + name + '_' + self._state, None)
        if func is None:
            raise RuntimeError(
                "%r has no %s method in state %s" % (self, name, self._state))
        return func(*args, **kwargs)
    dispatcher.__doc__ = template.__doc__
    return dispatcher


class WebSocketRequest(Request):
    """
    A general purpose L{Request} supporting connection upgrade for WebSocket.
    """

    ACCEPT_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    # this is backported from twisted 10.2.0
    content = None

    def connectionLost(self, reason):
        """
        There is no longer a connection for this request to respond over.
        Clean up anything which can't be useful anymore.
        """
        self._disconnected = True
        self.channel = None
        if self.content is not None:
            self.content.close()
        for d in self.notifications:
            d.errback(reason)
        self.notifications = []

    def process(self):
        connection = self.requestHeaders.getRawHeaders("Connection", [None])[0]
        upgrade = self.requestHeaders.getRawHeaders("Upgrade", [None])[0]

        if not connection or "upgrade" not in connection.lower():
            return Request.process(self)

        if not upgrade or upgrade.lower() != "websocket":
            return Request.process(self)

        return self.processWebSocket()

    def processWebSocket(self):
        """
        Process a specific web socket request.
        """
        # get site from channel
        self.site = self.channel.site

        # set various default headers
        self.setHeader("server", version)
        self.setHeader("date", datetimeToString())

        # Resource Identification
        self.prepath = []
        self.postpath = map(unquote, self.path[1:].split("/"))
        self.renderWebSocket()


    def _clientHandshake76(self):
        """
        Complete hixie-76 handshake, which consists of a challenge and response.

        If the request is not identified with a proper WebSocket handshake, the
        connection will be closed. Otherwise, the response to the handshake is
        sent and a C{WebSocketHandler} is created to handle the request.
        """
        def finish():
            self.channel.transport.loseConnection()
        if self.queued:
            return finish()

        secKey1 = self.requestHeaders.getRawHeaders("Sec-WebSocket-Key1", [])
        secKey2 = self.requestHeaders.getRawHeaders("Sec-WebSocket-Key2", [])

        if len(secKey1) != 1 or len(secKey2) != 1:
            return finish()

        # copied
        originHeaders = self.requestHeaders.getRawHeaders("Origin", [])
        if len(originHeaders) != 1:
            return finish()
        hostHeaders = self.requestHeaders.getRawHeaders("Host", [])
        if len(hostHeaders) != 1:
            return finish()
        handlerFactory = self.site.handlers.get(self.uri)
        if not handlerFactory:
            return finish()

        # key1 and key2 exist and are a string of characters
        # filter both keys to get a string with all numbers in order
        key1 = secKey1[0]
        key2 = secKey2[0]
        numBuffer1 = ''.join([x for x in key1 if x in _ascii_numbers])
        numBuffer2 = ''.join([x for x in key2 if x in _ascii_numbers])

        # make sure numbers actually exist
        if not numBuffer1 or not numBuffer2:
            return finish()

        # these should be int-like
        num1 = int(numBuffer1)
        num2 = int(numBuffer2)

        # count the number of spaces in each character string
        numSpaces1 = 0
        for x in key1:
            if x == ' ':
                numSpaces1 += 1
        numSpaces2 = 0
        for x in key2:
            if x == ' ':
                numSpaces2 += 1

        # there should be at least one space in each
        if numSpaces1 == 0 or numSpaces2 == 0:
            return finish()

        # get two resulting numbers, as specified in hixie-76
        num1 = num1 / numSpaces1
        num2 = num2 / numSpaces2

        transport = WebSocketTransport(self)
        handler = handlerFactory(transport)
        transport._attachHandler(handler)

        self.channel.setRawMode()

        def finishHandshake(nonce):
            """ Receive nonce value from request body, and calculate repsonse. """
            protocolHeaders = self.requestHeaders.getRawHeaders(
                "WebSocket-Protocol", [])
            if len(protocolHeaders) not in (0,  1):
                return finish()
            if protocolHeaders:
                if protocolHeaders[0] not in self.site.supportedProtocols:
                    return finish()
                protocolHeader = protocolHeaders[0]
            else:
                protocolHeader = None

            originHeader = originHeaders[0]
            hostHeader = hostHeaders[0]
            self.startedWriting = True
            handshake = [
                "HTTP/1.1 101 Web Socket Protocol Handshake",
                "Upgrade: WebSocket",
                "Connection: Upgrade"]
            handshake.append("Sec-WebSocket-Origin: %s" % (originHeader))
            if self.isSecure():
                scheme = "wss"
            else:
                scheme = "ws"
            handshake.append(
                "Sec-WebSocket-Location: %s://%s%s" % (
                scheme, hostHeader, self.uri))

            if protocolHeader is not None:
                handshake.append("Sec-WebSocket-Protocol: %s" % protocolHeader)

            for header in handshake:
                self.write("%s\r\n" % header)

            self.write("\r\n")

            # concatenate num1 (32 bit in), num2 (32 bit int), nonce, and take md5 of result
            res = struct.pack('>II8s', num1, num2, nonce)
            server_response = md5(res).digest()
            self.write(server_response)

            # XXX we probably don't want to set _transferDecoder
            self.channel._transferDecoder = WebSocketFrameDecoder(
                self, handler)

            transport._connectionMade()

        # we need the nonce from the request body
        self.channel._transferDecoder = _IdentityTransferDecoder(0, lambda _ : None, finishHandshake)


    def _checkClientHandshake(self):
        """
        Verify client handshake, closing the connection in case of problem.

        @return: C{None} if a problem was detected, or a tuple of I{Origin}
            header, I{Host} header, I{WebSocket-Protocol} header, and
            C{WebSocketHandler} instance. The I{WebSocket-Protocol} header will
            be C{None} if not specified by the client.
        """
        def finish():
            self.channel.transport.loseConnection()
        if self.queued:
            return finish()
        originHeaders = self.requestHeaders.getRawHeaders("Origin", [])
        if len(originHeaders) != 1:
            return finish()
        hostHeaders = self.requestHeaders.getRawHeaders("Host", [])
        if len(hostHeaders) != 1:
            return finish()

        handlerFactory = self.site.handlers.get(self.uri)
        if not handlerFactory:
            return finish()
        transport = WebSocketTransport(self)
        handler = handlerFactory(transport)
        transport._attachHandler(handler)

        protocolHeaders = self.requestHeaders.getRawHeaders(
            "WebSocket-Protocol", [])
        if len(protocolHeaders) not in (0,  1):
            return finish()
        if protocolHeaders:
            if protocolHeaders[0] not in self.site.supportedProtocols:
                return finish()
            protocolHeader = protocolHeaders[0]
        else:
            protocolHeader = None
        return originHeaders[0], hostHeaders[0], protocolHeader, handler

    def _getOneHeader(self, name):
        headers = self.requestHeaders.getRawHeaders(name)
        if not headers or len(headers) > 1:
            return None
        return headers[0]

    def _clientHandshakeHybi(self):
        """
        Initial handshake, as defined in hybi-10 and 16 (versions 8 and 13).

        If the client is not following the hybi-10 or 16 protocol or is requesting a
        version that's lower than what hybi-10 describes, the connection will
        be closed.

        Otherwise the appropriate transport and content decoders will be
        plugged in and the connection will be estabilished.
        """
        version = self._getOneHeader("Sec-WebSocket-Version")
        # we only speak version 7, 8 and 13 of the protocol
        if version not in ("7", "8", "13"):
            self.setResponseCode(426, "Upgrade Required")
            self.setHeader("Sec-WebSocket-Version", "7")
            return self.finish()

        key = self._getOneHeader("Sec-WebSocket-Key")
        if not key:
            self.setResponseCode(400, "Bad Request")
            return self.finish()

        handlerFactory = self.site.handlers.get(self.uri)
        if not handlerFactory:
            self.setResponseCode(404, "Not Found")
            return self.finish()

        transport = WebSocketHybiTransport(self)
        handler = handlerFactory(transport)
        transport._attachHandler(handler)

        accept = base64.b64encode(sha1(key + self.ACCEPT_GUID).digest())
        self.startedWriting = True
        handshake = [
            "HTTP/1.1 101 Switching Protocols",
            "Upgrade: websocket",
            "Connection: Upgrade",
            "Sec-WebSocket-Accept: %s" % accept]

        for header in handshake:
            self.write("%s\r\n" % header)

        self.write("\r\n")
        self.channel.setRawMode()
        self.channel._transferDecoder = WebSocketHybiFrameDecoder(
            self, handler)
        handler.transport._connectionMade()

    def renderWebSocket(self):
        """
        Render a WebSocket request.

        If the request is not identified with a proper WebSocket handshake, the
        connection will be closed. Otherwise, the response to the handshake is
        sent and a C{WebSocketHandler} is created to handle the request.
        """
        # check for hybi handshake requests
        if self.requestHeaders.hasHeader("Sec-WebSocket-Version"):
            return self._clientHandshakeHybi()

        # check for post-75 handshake requests
        isSecHandshake = self.requestHeaders.getRawHeaders("Sec-WebSocket-Key1", [])
        if isSecHandshake:
            self._clientHandshake76()
        else:
            check = self._checkClientHandshake()
            if check is None:
                return
            originHeader, hostHeader, protocolHeader, handler = check
            self.startedWriting = True
            handshake = [
                "HTTP/1.1 101 Web Socket Protocol Handshake",
                "Upgrade: WebSocket",
                "Connection: Upgrade"]
            handshake.append("WebSocket-Origin: %s" % (originHeader))
            if self.isSecure():
                scheme = "wss"
            else:
                scheme = "ws"
            handshake.append(
                "WebSocket-Location: %s://%s%s" % (
                scheme, hostHeader, self.uri))

            if protocolHeader is not None:
                handshake.append("WebSocket-Protocol: %s" % protocolHeader)

            for header in handshake:
                self.write("%s\r\n" % header)

            self.write("\r\n")
            self.channel.setRawMode()
            # XXX we probably don't want to set _transferDecoder
            self.channel._transferDecoder = WebSocketFrameDecoder(
                self, handler)
            handler.transport._connectionMade()
            return



class WebSocketSite(Site):
    """
    @ivar handlers: a C{dict} of names to L{WebSocketHandler} factories.
    @type handlers: C{dict}
    @ivar supportedProtocols: a C{list} of supported I{WebSocket-Protocol}
        values. If a value is passed at handshake and doesn't figure in this
        list, the connection is closed.
    @type supportedProtocols: C{list}
    """
    requestFactory = WebSocketRequest

    def __init__(self, resource, logPath=None, timeout=60*60*12,
                 supportedProtocols=None):
        Site.__init__(self, resource, logPath, timeout)
        self.handlers = {}
        self.supportedProtocols = supportedProtocols or []

    def addHandler(self, name, handlerFactory):
        """
        Add or override a handler for the given C{name}.

        @param name: the resource name to be handled.
        @type name: C{str}
        @param handlerFactory: a C{WebSocketHandler} factory.
        @type handlerFactory: C{callable}
        """
        if not name.startswith("/"):
            raise ValueError("Invalid resource name.")
        self.handlers[name] = handlerFactory



class WebSocketTransport(object):
    """
    Transport abstraction over WebSocket, providing classic Twisted methods and
    callbacks.
    """
    implements(interfaces.ITransport)

    _handler = None

    def __init__(self, request):
        self._request = request
        self._connected = 1
        self._request.notifyFinish().addErrback(self._connectionLost)

    def _attachHandler(self, handler):
        """
        Attach the given L{WebSocketHandler} to this transport.
        """
        self._handler = handler

    def _connectionMade(self):
        """
        Called when a connection is made.
        """
        self._handler.connectionMade()

    def _connectionLost(self, reason):
        """
        Forward connection lost event to the L{WebSocketHandler}.
        """
        self._connected = 0
        self._handler.connectionLost(reason)
        del self._request.transport
        del self._request
        del self._handler

    def getPeer(self):
        """
        Return a tuple describing the other side of the connection.

        @rtype: C{tuple}
        """
        return self._request.transport.getPeer()

    def getHost(self):
        """
        Similar to getPeer, but returns an address describing this side of the
        connection.

        @return: An L{IAddress} provider.
        """
        return self._request.transport.getHost()

    def write(self, frame):
        """
        Send the given frame to the connected client.

        @param frame: a I{UTF-8} encoded C{str} to send to the client.
        @type frame: C{str}
        """
        if self._connected:
            self._request.write("\x00%s\xff" % frame)

    def writeSequence(self, frames):
        """
        Send a sequence of frames to the connected client.
        """
        if self._connected:
            self._request.write("".join(["\x00%s\xff" % f for f in frames]))

    def loseConnection(self):
        """
        Close the connection.
        """
        if self._connected:
            self._request.transport.loseConnection()


class WebSocketHybiTransport(WebSocketTransport):
    """
    A WebSocket transport that speaks the hybi-10 protocol. The L{ITransport}
    methods are set up to send Text frames containing the payload. To have
    finer-grained control over the type of frame being sent, the transport
    provides a L{sendFrame} method.
    """
    def write(self, frame):
        """
        Treat the given frame as a text frame and send it to the client.

        @param frame: a I{UTF-8} encoded C{str} to send to the client.
        @type frame: C{str}
        """
        self.sendFrame(OPCODE_TEXT, frame)

    def writeSequence(self, frames):
        """
        Send a sequence of text frames to the connected client.
        """
        for frame in frames:
            self.sendFrame(OPCODE_TEXT, frame)

    def sendFrame(self, opcode, payload, fragmented=False):
        """
        Send a frame with the given opcode and payload to the client. If the
        L{fragmented} parameter is set, the message frame will contain a flag
        saying it's part of a fragmented payload, by default data is sent as a
        self-contained frame. Note that if you use fragmentation support, it is
        up to you to correctly set the first frame's opcode and then use
        L{OPCODE_CONT} on the following continuation frames.

        Payloads sent using this method are never masked.

        @param opcode: the opcode as defined in hybi-10
        @type opcode: C{int}
        @param payload: the frame's payload
        @type payload: C{str}
        @param fragmented: should the frame be marked as part of a fragmented payload
        @type fragmented: C{bool}
        """
        if opcode not in ALL_OPCODES:
            raise ValueError("Invalid opcode 0x%X" % opcode)

        length = len(payload)

        # there's always the header and at least one length field
        spec = ">BB"
        if fragmented:
            header = 0x00
        else:
            header = 0x80
        data = [header | opcode]

        # there's no masking, so the high bit of the first byte of length is
        # always 0
        if 125 < length <= 65535:
            # add a 16-bit int to the spec and append 126 value, which means
            # "interpret the next two bytes"
            spec += "H"
            data.append(126)
        elif length > 65535:
            # same for even longer frames
            spec += "Q"
            data.append(127)

        data.append(length)
        header = struct.pack(spec, *data)
        if self._connected:
            self._request.write(header + payload)


class WebSocketHandler(object):
    """
    Base class for handling WebSocket connections. It mainly provides a
    transport to send frames, and a callback called when frame are received,
    C{frameReceived}.

    @ivar transport: a C{WebSocketTransport} instance.
    @type: L{WebSocketTransport}
    """

    def __init__(self, transport):
        """
        Create the handler, with the given transport
        """
        self.transport = transport


    def frameReceived(self, frame):
        """
        Called when a frame is received.

        @param frame: a I{UTF-8} encoded C{str} sent by the client.
        @type frame: C{str}
        """


    def binaryFrameReceived(self, data):
        """
        Called when a binary is received via the hybi protocol.

        @param data: a binary C{str} sent by the client.
        @type data: C{str}
        """


    def pongReceived(self, data):
        """
        Called when a pong control message is received via the hybi protocol.

        @param data: the payload sent by the client.
        @type data: C{str}
        """


    def closeReceived(self, code, msg):
        """
        Called when a close control message is received via the hybi protocol.

        @param code: the status code of the close message, if present
        @type code: C{int} or C{None}
        @param msg: the I{UTF-8} encoded message sent by the client, if present
        @type msg: C{str} or C{None}
        """


    def frameLengthExceeded(self):
        """
        Called when too big a frame is received. The default behavior is to
        close the connection, but it can be customized to do something else.
        """
        self.transport.loseConnection()


    def connectionMade(self):
        """
        Called when a connection is made.
        """

    def connectionLost(self, reason):
        """
        Callback called when the underlying transport has detected that the
        connection is closed.
        """


class IncompleteFrame(Exception):
    """
    Not enough data to complete a WebSocket frame.
    """


class DecodingError(Exception):
    """
    The incoming data is not valid WebSocket protocol data.
    """


class WebSocketFrameDecoder(object):
    """
    Decode WebSocket frames and pass them to the attached C{WebSocketHandler}
    instance.

    @ivar MAX_LENGTH: maximum len of a text frame allowed, before calling
        C{frameLengthExceeded} on the handler.
    @type MAX_LENGTH: C{int}
    @ivar MAX_BINARY_LENGTH: like C{MAX_LENGTH}, but for 0xff type frames
    @type MAX_BINARY_LENGTH: C{int}
    @ivar closing: a flag set when the closing handshake has been received
    @type closing: C{bool}
    @ivar request: C{Request} instance.
    @type request: L{twisted.web.server.Request}
    @ivar handler: L{WebSocketHandler} instance handling the request.
    @type handler: L{WebSocketHandler}
    @ivar _data: C{list} of C{str} buffering the received data.
    @type _data: C{list} of C{str}
    @ivar _currentFrameLength: length of the current handled frame, plus the
        additional leading byte.
    @type _currentFrameLength: C{int}
    """

    MAX_LENGTH = 16384
    MAX_BINARY_LENGTH = 2147483648
    closing = False

    def __init__(self, request, handler):
        self.request = request
        self.handler = handler
        self.closing = False
        self._data = []
        self._currentFrameLength = 0
        self._state = "FRAME_START"

    def dataReceived(self, data):
        """
        Parse data to read WebSocket frames.

        @param data: data received over the WebSocket connection.
        @type data: C{str}
        """
        if not data or self.closing:
            return
        self._data.append(data)

        while self._data and not self.closing:
            try:
                self.consumeData(self._data[-1])
            except IncompleteFrame:
                break
            except DecodingError:
                log.err()
                self.request.transport.loseConnection()
                break

    def consumeData(self, data):
        """
        Process the last data chunk received.

        After processing is done, L{IncompleteFrame} should be raised or
        L{_addRemainingData} should be called.

        @param data: last chunk of data received.
        @type data: C{str}
        """
    consumeData = makeStatefulDispatcher("consumeData", consumeData)

    def _consumeData_FRAME_START(self, data):
        self._currentFrameLength = 0

        if data[0] == "\x00":
            self._state = "PARSING_TEXT_FRAME"
        elif data[0] == "\xff":
            self._state = "PARSING_LENGTH"
        else:
            raise DecodingError("Invalid frame type 0x%s" %
                                data[0].encode("hex"))

        self._addRemainingData(data[1:])

    def _consumeData_PARSING_TEXT_FRAME(self, data):
        endIndex = data.find("\xff")
        if endIndex == -1:
            self._currentFrameLength += len(data)
        else:
            self._currentFrameLength += endIndex

        self._currentFrameLength += endIndex
        # check length + 1 to account for the initial frame type byte
        if self._currentFrameLength + 1 > self.MAX_LENGTH:
            self.handler.frameLengthExceeded()

        if endIndex == -1:
            raise IncompleteFrame()

        frame = "".join(self._data[:-1]) + data[:endIndex]
        self.handler.frameReceived(frame)

        remainingData = data[endIndex + 1:]
        self._addRemainingData(remainingData)

        self._state = "FRAME_START"

    def _consumeData_PARSING_LENGTH(self, data):
        current = 0
        available = len(data)

        while current < available:
            byte = ord(data[current])
            length, more = byte & 0x7F, bool(byte & 0x80)

            if not length:
                self._closingHandshake()
                raise IncompleteFrame()

            self._currentFrameLength *= 128
            self._currentFrameLength += length

            current += 1

            if not more:
                if self._currentFrameLength > self.MAX_BINARY_LENGTH:
                    self.handler.frameLengthExceeded()

                remainingData = data[current:]
                self._addRemainingData(remainingData)
                self._state = "PARSING_BINARY_FRAME"
                break
        else:
            raise IncompleteFrame()

    def _consumeData_PARSING_BINARY_FRAME(self, data):
        available = len(data)

        if self._currentFrameLength <= available:
            remainingData = data[self._currentFrameLength:]
            self._addRemainingData(remainingData)
            self._state = "FRAME_START"
        else:
            self._currentFrameLength -= available
            self._data[:] = []

    def _addRemainingData(self, remainingData):
        if remainingData:
            self._data[:] = [remainingData]
        else:
            self._data[:] = []

    def _closingHandshake(self):
        self.closing = True
        # send the closing handshake
        self.request.transport.write("\xff\x00")
        # discard all buffered data
        self._data[:] = []


class WebSocketHybiFrameDecoder(WebSocketFrameDecoder):

    def __init__(self, request, handler):
        WebSocketFrameDecoder.__init__(self, request, handler)
        self._opcode = None
        self._fragment_opcode = None
        self._fragments = []
        self._state = "HYBI_FRAME_START"

    def _consumeData_HYBI_FRAME_START(self, data):
        self._opcode = None

        byte = ord(data[0])
        fin, reserved, opcode = byte & 0x80, byte & 0x70, byte & 0x0F

        if reserved:
            raise DecodingError("Reserved bits set: 0x%02X" % byte)

        if opcode not in ALL_OPCODES:
            raise DecodingError("Invalid opcode 0x%X" % opcode)

        if not fin:
            # part of a fragmented frame
            if not self._fragment_opcode:
                # first of the fragmented frames, which determines the opcode
                if opcode not in DATA_OPCODES:
                    raise DecodingError(
                        "Fragmented frame with invalid opcode 0x%X" % opcode)
                # save the opcode for later use
                self._fragment_opcode = opcode
            else:
                # already reading a fragmet, and this is a fragmented frame, so
                # it has to use the continuation opcode
                if opcode != OPCODE_CONT:
                    raise DecodingError(
                        "Continuation frame with invalid opcode 0x%X" % opcode)
        else:
            # self-contained frame or last of the fragmented frames
            if self._fragment_opcode:
                # a fragmented frame is pending, so this can only be the end of
                # it or a control message
                if opcode not in CONTROL_OPCODES and opcode != OPCODE_CONT:
                    raise DecodingError(
                        "Final frame with invalid opcode 0x%X" % opcode)
            else:
                # no fragmented frames pending, so this cannot be a
                # continuation frame
                if opcode == OPCODE_CONT:
                    raise DecodingError(
                        "Final frame with invalid opcode 0x%X" % opcode)
            self._opcode = opcode

        self._state = "HYBI_PARSING_LENGTH"
        self._addRemainingData(data[1:])

    def _consumeData_HYBI_PARSING_LENGTH(self, data):
        byte = ord(data[0])
        masked, length = byte & 0x80, byte & 0x7F

        if not masked:
            raise DecodingError("Unmasked frame received")

        if length < 126:
            self._currentFrameLength = length
            self._state = "HYBI_MASKING_KEY"
        elif length == 126:
            self._state = "HYBI_PARSING_LENGTH_2"
        elif length == 127:
            self._state = "HYBI_PARSING_LENGTH_3"

        self._addRemainingData(data[1:])

    def _consumeData_HYBI_PARSING_LENGTH_2(self, data):
        self._parse_length_spec(2, ">H")

    def _consumeData_HYBI_PARSING_LENGTH_3(self, data):
        self._parse_length_spec(8, ">Q", 0x7fffffffffffffff)

    def _parse_length_spec(self, needed, spec, limit=None):
        # if the accumulated data is not long enough to parse out the length,
        # keep on accumulating
        if sum(map(len, self._data)) < needed:
            raise IncompleteFrame()

        data = "".join(self._data)
        self._currentFrameLength = struct.unpack(spec, data[:needed])[0]
        if limit and self._currentFrameLength > limit:
            raise DecodingError(
                "Frame length exceeded: %r" % self._currentFrameLength)
        self._addRemainingData(data[needed:])

        self._state = "HYBI_MASKING_KEY"

    def _consumeData_HYBI_MASKING_KEY(self, data):
        if sum(map(len, self._data)) < 4:
            raise IncompleteFrame()

        data = "".join(self._data)
        self._maskingKey = struct.unpack(">4B", data[:4])
        self._addRemainingData(data[4:])

        if self._currentFrameLength:
            self._state = "HYBI_PAYLOAD"
        else:
            # there will be no payload, notify the handler of an empty frame
            # and continue
            self._frameCompleted("", data[4:])

    def _consumeData_HYBI_PAYLOAD(self, data):
        available = len(data)

        if self._currentFrameLength > available:
            self._currentFrameLength -= available
            raise IncompleteFrame()

        frame = "".join(self._data[:-1]) + data[:self._currentFrameLength]

        # unmask the frame
        bufferedPayload = itertools.chain(*self._data[:-1])
        restOfPayload = data[:self._currentFrameLength]
        allData = itertools.chain(bufferedPayload, restOfPayload)

        key = itertools.cycle(self._maskingKey)

        def xor(c, k):
            return chr(ord(c) ^ k)
        unmasked = itertools.imap(xor, allData, key)

        frame = "".join(unmasked)
        remainingData = data[self._currentFrameLength:]

        self._frameCompleted(frame, remainingData)

    def _frameCompleted(self, frame, remainingData):
        # if it's part of a fragmented frame, store the payload
        if self._opcode is None:
            self._fragments.append(frame)

        # if it's the last of the fragmented frames, replace the opcode with
        # the original one from the fragment and the frame with the accumulated
        # payload
        if self._opcode == OPCODE_CONT:
            self._opcode = self._fragment_opcode
            self._fragments.append(frame)
            frame = "".join(self._fragments)
            self._fragment_opcode = None
            self._fragments[:] = []

        if self._opcode == OPCODE_TEXT:
            # assume it's valid UTF-8 and let the client handle the rest
            if len(frame) > self.MAX_LENGTH:
                self.handler.frameLengthExceeded()
            self.handler.frameReceived(frame)
        elif self._opcode == OPCODE_BINARY:
            if len(frame) > self.MAX_BINARY_LENGTH:
                self.handler.frameLengthExceeded()
            self.handler.binaryFrameReceived(frame)
        elif self._opcode == OPCODE_PING:
            self.handler.transport.sendFrame(OPCODE_PONG, frame)
        elif self._opcode == OPCODE_PONG:
            self.handler.pongReceived(frame)

        self._state = "HYBI_FRAME_START"
        self._addRemainingData(remainingData)

        # if the opcode was CLOSE, initiate connection closing
        if self._opcode == OPCODE_CLOSE:
            self._hybiClose(frame)

    def _hybiClose(self, frame):
        self.closing = True

        # try to parse out the status code and message
        if len(frame) > 1:
            code = struct.unpack(">H", frame[:2])[0]
            msg = frame[2:]
        else:
            code, msg = None, None
        # let the handler know
        self.handler.closeReceived(code, msg)

        # send the closing handshake
        self.handler.transport.sendFrame(OPCODE_CLOSE, "")

        # discard all buffered data and lose connection
        self._data[:] = []
        self.handler.transport.loseConnection()


__all__ = ["WebSocketHandler", "WebSocketSite"]
