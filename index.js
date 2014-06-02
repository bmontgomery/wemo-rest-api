// Web app requires
var express = require('express');
var https = require('https');
var fs = require('fs');
var app = express();

// get configurations from config.js file
var config = require ('./config.js');

// Set up basic auth

// Wemo requires
var UpnpControlPoint = require("./lib/upnp-controlpoint").UpnpControlPoint;
var wemo = require("./lib/wemo");

// hold a reference to the Wemo switch
var wemoSwitch;
var wemoSwitches ={};
var currentBinaryState;
var lastCommandDate = null;

// how many milliseconds the server waits to send a signal to the switch (to protect whatever is plugged into it)
var maxInterval = 500;

function validateLastCommandTiming() {
  if (lastCommandDate === null) {
    lastCommandDate = new Date();
    return true;
  }

  if ((new Date()) - lastCommandDate > maxInterval) {
    lastCommandDate = new Date();
    return true;
  }

  return false;
};

function sendWaitValidationResponse(res) {
  res.send(409, 'You must wait ' + maxInterval.toString() + ' ms between requests.');
}

function sendNoWemoResponse(res) {
  res.send(500, 'No Wemo switch detected.');
}

// Set up basic HTTP auth
app.use(express.basicAuth(function(username, password) {
  return username === config.username && password === config.password;
}));

// Set up API URLs
app.get('/on', function(req, res) {
  var selectedSwitch=null;
  if(req.query.device!==null){
	var selectedSwitch = wemoSwitches[req.query.device];
  }
	
  if (selectedSwitch) {
    if (validateLastCommandTiming()) {
      selectedSwitch.setBinaryState(true);
      res.send(200, 'Wemo switch turned on.');
    } else {
      sendWaitValidationResponse(res); 
    }
  } else {
    sendNoWemoResponse(res);
  }
});

app.get('/off', function(req, res) {
  var selectedSwitch=null;
  if(req.query.device!==null){
	var selectedSwitch = wemoSwitches[req.query.device];
  }
  if (selectedSwitch) {
    if (validateLastCommandTiming()) {
      selectedSwitch.setBinaryState(false);
      res.send(200, 'Wemo switch turned off.');
    } else {
      sendWaitValidationResponse(res); 
    }
  } else {
    sendNoWemoResponse(res);
  }
});

app.get('/toggle', function(req, res) {
  var selectedSwitch=null;
  if(req.query.device!==null){
	var selectedSwitch = wemoSwitches[req.query.device];
  }
  if (selectedSwitch) {
    if (validateLastCommandTiming()) {
      selectedSwitch.setBinaryState(!currentBinaryState);
      res.send(200, 'Wemo switch toggled.');
    } else {
      sendWaitValidationResponse(res); 
    }
  } else {
    sendNoWemoResponse(res);
  }
});

// helper function for arrays
var indexOf = function(needle) {
    if(typeof Array.prototype.indexOf === 'function') {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function(needle) {
            var i = -1, index = -1;

            for(i = 0; i < this.length; i++) {
                if(this[i] === needle) {
                    index = i;
                    break;
                }
            }

            return index;
        };
    }

    return indexOf.call(this, needle);
};


// set up URLs to handle API
var handleDevice = function(device) {

  if (indexOf.call( wemo.WemoControllee.deviceType, device.deviceType ) >=0 ) {
    wemoSwitch = new wemo.WemoControllee(device);
	wemoSwitches[wemoSwitch.device.friendlyName]  = wemoSwitch;
    wemoSwitches[wemoSwitch.device.friendlyName].on('BinaryState', function(stateValue) {
      currentBinaryState = stateValue;
    });
    console.log('Wemo Switch ' +wemoSwitch.device.friendlyName+ ' found!');
  }
};

// UPNP control point (used to search for the Wemo switch)
var cp = new UpnpControlPoint();

// When a device is found, call handleDevice callback, which looks for the Wemo switch
cp.on("device", handleDevice);

// Start the search
cp.search();

// Start the web server
var port = process.env.PORT || 3000;

var privateKey = fs.readFileSync(config.privateKey).toString();
var certificate = fs.readFileSync(config.certificate).toString();

var options = {
  key: privateKey,
  cert: certificate
};

https.createServer(options, app).listen(port, function() {
  console.log('Express app listening on port ' + port);
});
