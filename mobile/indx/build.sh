#!/bin/bash

# these directories aren't checked out by default
mkdir merges plugins platforms
bower install
cordova create .
cordova platforms add ios
cordova plugins add org.apache.cordova.camera
cordova plugins add org.apache.cordova.console
(cd ..; git checkout https://github.com/wildabeast/BarcodeScanner.git)
cordova plugins add ../BarcodeScanner
cordova prepare
echo "done! good luck with provisioning :)"



