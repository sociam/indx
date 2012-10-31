#!/bin/bash

curl -v --header "Content-type: text/json" --upload-file multi.json 'http://localhost:8211/webbox/?graph=http://example.com/graph3&version=0'

