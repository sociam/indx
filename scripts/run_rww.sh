#!/bin/bash

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


DIR="$( cd -P "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"


. config.sh

java -jar "$RWW_JAR" "$RWW_PORT" "$RWW_LD" / >> "$LOG_RWW" 2>> "$LOG_RWW" &
export PID_RWW=$!


