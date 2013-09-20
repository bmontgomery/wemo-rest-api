// var upnp = require("upnp-client"),
var upnp = require("./upnp"),
	util = require('util'),
	EventEmitter = require('events').EventEmitter,
	http = require("http"),
	Url = require("url"),
	xml2js = require('xml2js'),
	UpnpDevice = require("./upnp-device").UpnpDevice;

var TRACE = false;
var DETAIL = false;

var UpnpControlPoint = function() {
    EventEmitter.call(this);
    
	var self = this;

	this.devices = {};	// a map of udn to device object

	this.ssdp = new upnp.ControlPoint();	// create a client instance

	/**
	 * Device found

	NT: Notification Type
		upnp:rootdevice 
			Sent once for root device. 
		uuid:device-UUID
			Sent once for each device, root or embedded, where device-UUID is specified by the UPnP vendor. See 
			section 1.1.4, “UUID format and RECOMMENDED generation algorithms” for the MANDATORY UUID format. 
		urn:schemas-upnp-org:device:deviceType:ver
			Sent once for each device, root or embedded, where deviceType and ver are defined by UPnP Forum working 
			committee, and ver specifies the version of the device type. 
		urn:schemas-upnp-org:service:serviceType:ver
			Sent once for each service where serviceType and ver are defined by UPnP Forum working committee and ver
			specifies the version of the service type. 
		urn:domain-name:device:deviceType:ver
			Sent once for each device, root or embedded, where domain-name is a Vendor Domain Name, deviceType and ver
			are defined by the UPnP vendor, and ver specifies the version of the device type. Period characters in the Vendor 
			Domain Name MUST be replaced with hyphens in accordance with RFC 2141. 
		urn:domain-name:service:serviceType:ver
			Sent once for each service where domain-name is a Vendor Domain Name, serviceType and ver are defined by 
			UPnP vendor, and ver specifies the version of the service type. Period characters in the Vendor Domain Name 
			MUST be replaced with hyphens in accordance with RFC 2141. 
	 */
	this.ssdp.on("DeviceFound", function(device) {
		var udn = getUUID(device.usn);
			
		if (TRACE) {
			console.log("DeviceFound: " + udn);
		}
		
		if (self.devices[udn]) {	
			// already got this device
			return;
		}
		
		if (TRACE) {
			console.log('\t' + JSON.stringify(device));
			//console.log('\t' + device.usn); 		// unique ID for the device
			//console.log('\t' + device.st); 		//-> "urn:schemas-upnp-org:device:InternetGatewayDevice:1"
			//console.log('\t' + device.location); 		//-> "http://192.168.0.1/root.sxml"
		}
	
		self.devices[udn] = "holding";
			
		self._getDeviceDetails(udn, device.location, function(device) {
			self.devices[udn] = device;
			self.emit("device", device);
		});
	});
	
	/**
	 * Device alive
	 */
	this.ssdp.on("DeviceAvailable", function(device) {
		var udn = getUUID(device.usn);
			
		
		if (self.devices[udn]) {
			return;
		}
		
		if (TRACE) {
			console.log("DeviceAvailable");
			//console.log('\t' + JSON.stringify(device));
			console.log('\t' + udn + " : " + device.nt);
			// console.log('\t' + device.usn); 		// Unique Service Name.  A unique ID for the device
			//console.log('\t' + device.nt); 		// Notification Type  e.g. "urn:schemas-upnp-org:device:InternetGatewayDevice:1"
			//console.log('\t' + device.location); 		// Location -> "http://192.168.0.1/root.sxml"
		}

		self.devices[udn] = "holding";
		self._getDeviceDetails(udn, device.location, function(device) {
			self.devices[udn] = device;
			self.emit("device", device);
		});

	});
	
	/**
	 * Device left the building
	 */
	this.ssdp.on("DeviceUnavailable", function(dev) {
		var udn = getUUID(dev.usn);
			
		if (TRACE) {
			console.log("DeviceUnavailable");
			console.log('\t' + JSON.stringify(dev));
		}
		
		self.emit("device-lost", udn);

		delete self.devices[udn];
	});
	
	/**
	 * Device has been updated
	 */
	this.ssdp.on("DeviceUpdate", function(device) {
		var udn = getUUID(device.usn);
			
		if (TRACE) {
			console.log("DeviceUpdate");
			console.log('\t' + JSON.stringify(device));
		}
		
		//self.devices[udn] = device;
	
		// TODO update device object
	});

	// for handling incoming events from subscribed services
	this.eventHandler = new EventHandler();
}

util.inherits(UpnpControlPoint, EventEmitter);


UpnpControlPoint.prototype.search = function(s) {
	if (s) {
		//ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1');
		//ssdp.search('ssdp:all');
		this.ssdp.search(s);
	}
	else {
		this.ssdp.search('upnp:rootdevice');
	}
}

/**
 * Query the device for details.
 * 
 * @param {Object} deviceUrl
 */	
UpnpControlPoint.prototype._getDeviceDetails = function(udn, location, callback) {
	var self = this;
	var localAddress = "127.0.0.1";		// will determine which local address is used to talk with the device.
	if (TRACE) {
		console.log("getting device details from " + location);
	}
	options = Url.parse(location);
	var req = http.request(options, function(res) {
		//res.setEncoding('utf8');
		var resData = "";
		res.on('data', function (chunk) {
			resData += chunk;
		});
		res.on('end', function () {
			if (res.statusCode != 200) {
				console.log("problem getting device details: " + res.statusCode + " : " + resData);
				return;
			}
			xml2js.parseString(resData, function(err, result) {
				var desc = result.root.device[0];
				if (TRACE) {
					console.log(desc.deviceType + " : " + desc.friendlyName + " : " + location);
				}
				var device = new UpnpDevice(self, udn, location, desc, localAddress);
				callback(device);
			});
		});
	});
	req.on('socket', function(socket) {
		localAddress = socket.address().address;	// the local address used to communicate with the device. Used to determine callback URL. 
	});
	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});
	req.end();
}


/* ---------------------------------------------------------------------------------- */
/*
	headers:
 {
 	"host":"192.168.0.122:6767",
 	"content-type":"text/xml",
 	"content-length":"132",
 	"nt":"upnp:event",
 	"nts":"upnp:propchange",
 	"sid":"uuid:4af70162-1dd2-11b2-8f95-86a98a724376",		// subscription ID
 	"seq":"2"
 }
 
	content:
	<e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0">
		<e:property>
			<BinaryState>1</BinaryState>
		</e:property>
	</e:propertyset>
 */



var EventHandler = function() {
	var self = this;

	this.serverPort = 6767;
	this.responseCount = 1;		// not sure if this is supposed to be per-subscription
	this.server = http.createServer(function(req, res) {
		self._serviceCallbackHandler(req, res);
	});

	this.server.listen(this.serverPort);
	
	this.subscriptions = {};
}

EventHandler.prototype.addSubscription = function(subscription) {
	this.subscriptions[subscription.sid] = subscription;
}

EventHandler.prototype.removeSubscription = function(sid) {
	delete this.subscriptions[sid];
}

/**
 "host":"192.168.0.122:6767","content-type":"text/xml","content-length":"140","nt":"upnp:event","nts":"upnp:propchange","sid":"uuid:7edd52ba-1dd2-11b2-8d34-bb2eba00fd46","seq":"0"
 
 * @param {Object} req
 * @param {Object} res
 */
EventHandler.prototype._serviceCallbackHandler = function(req, res) {
	// console.log("got request: " + JSON.stringify(req.headers));

	var self = this;
	var reqContent = "";	
	req.on("data", function(buf) {
		reqContent += buf;
	});
	req.on("end", function() {
		//console.log("callback content: " + reqContent);
		var parser = new xml2js.Parser();
		try {
			parser.parseString(reqContent, function(err, result) {
				if (err) {
					console.log("got XML parsing err: " + err);
					return;
				}
				var sid = req.headers.sid;
				var subscription = self.subscriptions[sid];
				if (subscription) {
					if (TRACE && DETAIL) {
						console.log("event for sid " + subscription.sid + ": " + JSON.stringify(result));
					}
					values = {};
					var properties = result["e:propertyset"]["e:property"];
					for (var i=0; i<properties.length; i++) {
						var prop = properties[i];
						for (name in prop) {
							values[name] = prop[name][0];
						}
					}

					// acknowledge the event notification					
					res.writeHead(200, { "Extended-Response" : self.responseCount + " ; comment=\"Notification Acknowledged\"" });
					res.end("");
					self.responseCount++;

					subscription.handleEvent(values);
				}
			});
		}
		catch (ex) {
			if (ex.toString().startsWith("Error: Text data outside of root node.")) {
				// ignore
			}
			else {
				 console.log("exception: " + ex);
			}
		}
	});
}

exports.UpnpControlPoint = UpnpControlPoint;


/* ----------------------------------- utility functions ------------------------------------- */

if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}

function getUUID(usn) {
	var udn = usn;
	var s = usn.split("::");
	if (s.length > 0) {
		udn = s[0];
	}

	if (udn.startsWith("uuid:")) {
		udn = udn.substring(5);
	}
	
	return udn;
}

