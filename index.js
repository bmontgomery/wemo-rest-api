// Web app requires
var express = require('express');
var app = express();

// Wemo requires
var UpnpControlPoint = require("./lib/upnp-controlpoint").UpnpControlPoint;
var wemo = require("./lib/wemo");

// hold a reference to the Wemo switch
var wemoSwitch;
var currentBinaryState;
var lastCommandDate = null;

// how many milliseconds the server waits to send a signal to the switch (to protect whatever is plugged into it)
var maxInterval = 1000; 

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

// Set up API URLs
app.get('/on', function(req, res) {
  if (wemoSwitch) {
    if (validateLastCommandTiming()) {
      wemoSwitch.setBinaryState(true);
      res.send(200, 'Wemo switch turned on.');
    } else {
      res.send(409, 'You must wait some time between requests.');
    }
  } else {
    res.send(500, 'No Wemo switch detected.');
  }
});

app.get('/off', function(req, res) {
  if (wemoSwitch) {
    if (validateLastCommandTiming()) {
      wemoSwitch.setBinaryState(false);
      res.send(200, 'Wemo switch turned off.');
    } else {
      res.send(409, 'You must wait some time between requests.');
    }
  } else {
    res.send(500, 'No Wemo switch detected.');
  }
});

app.get('/toggle', function(req, res) {
  if (wemoSwitch) {
    if (validateLastCommandTiming()) {
      wemoSwitch.setBinaryState(!currentBinaryState);
      res.send(200, 'Wemo switch toggled.');
    } else {
      res.send(409, 'You must wait some time between requests.');
    }
  } else {
    res.send(500, 'No Wemo switch detected.');
  }
});

// set up URLs to handle API
var handleDevice = function(device) {
  if (device.deviceType === wemo.WemoControllee.deviceType) {
    wemoSwitch = new wemo.WemoControllee(device);
    wemoSwitch.on('BinaryState', function(stateValue) {
      currentBinaryState = stateValue;
    });
    console.log('Wemo Switch found!');
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
app.listen(port);

console.log('Express app listening on port ' + port.toString());