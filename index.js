// Web app requires
var express = require('express');
var app = express();

// Wemo requires
var UpnpControlPoint = require("./lib/upnp-controlpoint").UpnpControlPoint;
var wemo = require("./lib/wemo");

// hold a reference tot he Wemo switch
var wemoSwitch;

// Set up API URLs
app.get('/on', function(req, res) {
  if (wemoSwitch) {
    wemoSwitch.setBinaryState(true);
    res.send('Wemo switch turned on.');
  } else {
    res.send('No Wemo switch detected.');
  }
});

app.get('/off', function(req, res) {
  if (wemoSwitch) {
    wemoSwitch.setBinaryState(false);
    res.send('Wemo switch turned off.');
  } else {
    res.send('No Wemo switch detected.');
  }
});

// set up URLs to handle API
var handleDevice = function(device) {
  if (device.deviceType === wemo.WemoControllee.deviceType) {
    wemoSwitch = new wemo.WemoControllee(device);
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