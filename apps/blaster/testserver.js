var express = require('express'),
	bodyParser = require('body-parser');

var app = express();
// app.use(bodyParser());

app.get('/', function(req, res){
  res.send('hello world');
});

app.put('/put/', function(req,res) {
	var data = '';
  	req.setEncoding('utf8');
  	req.on('data', function(chunk) {
    	data += chunk;
  	});
  	req.on('end', function() {
    	console.log('DONE .. ', data);
    	console.log("---------------------------------------------");
    	console.log(decodeURIComponent(data.slice(5)));
	    res.send('{"status":"ok"}', 200);
	});
	console.log('req body ', req.body);
});

app.listen(8002);
