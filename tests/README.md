# WebBox testing client

The tests client can be used to interact with WebBox over HTTP.

## Usage

To run the test, first ensure you have activated your virtualenv (if necessary) and that the webbox/libs directory is in your pythonpath. (e.g. `export PYTHONPATH="/User/your_username/webbox/libs:$PYTHONPATH`).

Then run the tests client like to get a list of options like so:

    python tests/tests.py -h

You can append `--debug` to the client to add verbosity (e.g., show the URLs and tokens that are being used.)

## Examples

The examples below assume the following settings. Please customise them to your own settings.

    WebBox Host: http://localhost:8211/
    WebBox Username: webbox
    WebBox Password: foobar

### Listing boxes

To list the boxes in a webbox, run the following:

    python tests/tests.py http://localhost:8211/ webbox foobar list_boxes

### Creating a Box

To create a box called `newbox` run the following:

    python tests/tests.py http://localhost:8211/ webbox foobar create_box --box newbox

### Adding data to a Box

To add data from the file `tests/testdata/multi.json` to the box `newbox`, which has current version of `0`, run the following:

    python tests/tests.py http://localhost:8211/ webbox foobar update --box newbox --data test/testdata/multi.json --version 0

### List objects by ID

To list the objects with the IDs `facebook` and `twitter` from the box `newbox`, run the following:

    python tests/tests.py http://localhost:8211/ webbox foobar get_by_ids --box newbox --id 'facebook' 'twitter'

### Get all objects from latest version

To get the latest version of all objects from the box `newbox`, run the following:

    python tests/tests.py http://localhost:8211/ webbox foobar get_latest --box newbox


### Todo

Describe Delete, Query, Diff and their options.



