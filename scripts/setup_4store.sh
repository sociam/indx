#!/bin/bash

export DIR="$( cd -P "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"
osascript setup_4store.osa > /dev/null 2>&1

