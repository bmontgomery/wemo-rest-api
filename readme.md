# Wemo REST API

Largely based on the the work represented in the [node-upnp-controlpoint](https://github.com/stormboy/node-upnp-controlpoint) project, this simply wraps a simple web API around a Wemo switch and allows switching the device on and off with simple HTTP GET calls to '/on' and '/off' URL's.

## How to use

Install all dependencies:

    npm install

Start the application by navigating to the directory in a command line console, and typing

    node index.js

Assuming your computer is on the same network as the Wemo Switch and everything has been set up properly, the application will find the switch, and when requests are sent to the /on or /off URL's, the application will pass those requests along to the Wemo Switch.

All the dirty work of finding and communicating with the Wemo Swtich is handled by the [node-upnp-controlpoint](https://github.com/stormboy/node-upnp-controlpoint) code, which is included in the 'lib' directory of this project.