# pyindx

A python client library for accessing an INDX.

# indx_client.py

A comment-line client for accessing an INDX (uses pyindx).

## Usage

Run the command-line client with the `-h` option to get a list of options:

    python indx_client.py -h

You can append `--debug` to the client to add verbosity (e.g., show the URLs, http requests, responses and tokens that are being used.)

## Examples

The examples below assume the following settings. Please customise them to your own settings.

    Host: http://localhost:8211/
    Username: indx
    Password: password

### Example JSON and files

There are example JSON objects and files in the `data/` subdirectory that you can use to test the INDX client.


### Listing boxes

To list the boxes in INDX, run the following:

    python client.py http://localhost:8211/ indx password list_boxes

### Creating a Box

To create a box called `newbox` run the following:

    python client.py http://localhost:8211/ indx password create_box --box newbox

### Adding data to a Box

To add data from the file `data/multi.json` to the box `newbox`, which has current version of `0`, run the following:

    python client.py http://localhost:8211/ indx password update --box newbox --data data/multi.json --version 0

### List objects by ID

To list the objects with the IDs `facebook` and `twitter` from the box `newbox`, run the following:

    python client.py http://localhost:8211/ indx password get_by_ids --box newbox --id 'facebook' 'twitter'

### Get all objects from latest version

To get the latest version of all objects from the box `newbox`, run the following:

    python client.py http://localhost:8211/ indx password get_latest --box newbox

### Deleting an object

Remove an object by ID:

    python client.py http://localhost:8211/ indx password delete --box newbox --version 1 --id facebook

### To query the box

Returns objects that match the template query:

    python client.py http://localhost:8211/ indx password query --box newbox '{"name": "Daniel A Smith"}'

### To diff a box

To find out the differences between versions, there are three different options, to return the full objects that have changes, to return the IDs of objects that have changes or to return a full diff (i.e., what has been added, removed and changed:

Specify `to` to have the "to" version, or don't specify to get the diff up to the latest version.

Return full objects, from version 2 to version 3:

    python client.py http://localhost:8211/ indx password diff --box newbox --from 2 --to 3 --return_objs objects

Return IDs of objects from version 2 to the latest version (--to is omitted):

    python client.py http://localhost:8211/ indx password diff --box newbox --from 2 --return_objs ids

Return full diff (in JSON) of obejcts from version 2 to version 3:

    python client.py http://localhost:8211/ indx password diff --box newbox --from 2 --to 3 --return_objs diff


### Files

Adding a file: 

    python client.py http://localhost:8211 indx password --box <box_name> add_file --data <path_to_file> --id <file_id> --contenttype 'image/png' --version <current_box_version> --debug

Getting it back:

    python client.py http://localhost:8211 indx password --box <box_name> get_file --id <file_id>

Deleting it:

    python client.py http://localhost:8211 indx password --box <box_name>  delete_file --id <file_id>  --version <current_box_version>  --debug


