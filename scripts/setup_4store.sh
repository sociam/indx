#!/bin/bash

osascript << EOB
tell application "Finder"
    set root to path to startup disk as string
    set vl4 to root & "var:lib:4store"
    if not (folder vl4 exists) then
    set vl to root & "var:lib"
    tell me
        do shell script "mkdir -p /var/lib/4store ; chmod 777 /var/lib/4store" with administrator privileges
    end tell
    end if
end tell
EOB

