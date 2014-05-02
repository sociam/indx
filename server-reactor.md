# Server Reactor Implementation #

Notes to help design and implementation of a reactor-type core for INDX.

## Architecture ##

- server handler types
    - box
        (box ops, e.g. update, get/set acl, get, query, diff, file ops)
    - auth
        (login/logout, openid callback, get token)
    - admin
        (global [non-box] actions, e.g. list/create/del boxes, list/create/del users, list apps)
    - services
        (start/stop, get/set configs, is_running/poll status)
    - subscribe/unsubscribe
        (listen/unlisten to specific callbacks about actions occurring)

- interfaces (translate between handlers and websocket/http calls)
    - websocket server
    - websocket client (outgoing from server)
    - http server
    - http client (outgoing from server)

- callbacks (e.g. to websocket)
    - box operations (only to websocket authed to that box)
    - admin (to all)
    - auth (to superuser ? at all ?)
    - services (only to websocket authed to services, or to box also?)

## Reactor ##

- URL mappings (map from a call to a handler)

- Session manager
    - Allow multiple sessions per websocket, e.g. "request a new session", then auth to it, then request another, auth to it as someone else, etc.

- Handler registration/dereg

- Subscriber registration/dereg

- Event handling
    - callbacks from handlers
    - callbacks to subscribers
    - callbacks from database

- Outgoing connection manager
    - initial connections on launch
    - exponential back off upon connection failure
    - reconnection upon disconnection

- Incoming connection manager
    - Map HTTP to handlers, return results
    - Websockets incoming, map to handlers
    - Outgoing websockets, incoming requests, map to handlers/sessions

## Handlers ##

- Requirements
    - method (GET/PUT/DELETE)
    - path ( /boxname/   -or-  /auth/login )
    - headers ?
    - cookies ?
    - sessionids ?
    - ETags ?
    - tokens ?
    - query string / body parameters


