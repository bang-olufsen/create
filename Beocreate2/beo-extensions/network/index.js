/*Copyright 2018-2019 Bang & Olufsen A/S
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.*/

// BEOCREATE NETWORK SETUP

var child_process = require('child_process');
var networkCore = require('../../beocreate_essentials/networking');

module.exports = function(beoBus, globals) {
	var beoBus = beoBus;
	var debug = globals.debug;
	var extensions = globals.extensions;
	
	var version = require("./package.json").version;
	
	var networkHardware = {wifi: false, ethernet: false};
	
	var hasLocalConnection = false;
	var hasInternetConnection = false;
	var cachedIPAddresses = {wifi: null, ethernet: null}; // If IP addresses change, the system should rebroadcast its zeroconf advertisement.
	
	var testNoEthernet = false; // Set to true to make Ethernet a "stealth" interface: even when connected, the system will consider it disconnected to allow testing automated hotspot functions.
	
	beoBus.on('general', function(event) {
		
		
		if (event.header == "startup") {
			checkLocalConnection(function(status) {
				if (status == true) {
					setConnectionMode({mode: "connected"});
				} else {
					setConnectionMode({mode: "initial"});
				}
			});
		}
		
		if (event.header == "shutdown") {
			
			setConnectionMode();
		}
		
		if (event.header == "activatedExtension") {
			if (event.content == "network") {
				checkLocalConnection(function(status) {
					if (status == true) {
						setConnectionMode({mode: "connected"});
					}
				});
				if (connectionMode == "hotspot") sawPreviousNetworks = true; // Set this so that when the user is viewing the UI it doesn't drop out unexpectedly.
				beoBus.emit("ui", {target: "network", header: "networkHardware", content: {hardware: networkHardware}});
			}
		}
	});
	
	
	beoBus.on('network', function(event) {
		
		if (event.header == "populateWifiUI") {
			
			networks = networkCore.listSavedNetworks();
			beoBus.emit("ui", {target: "network", header: "savedNetworks", content: {networks: networks}});
			
			wifiScan();
			
			networkCore.getWifiStatus(function(status, error) {
				if (!error) {
					beoBus.emit("ui", {target: "network", header: "wifiStatus", content: {status: status}});
				} else {
					beoBus.emit("ui", {target: "network", header: "wifiStatus", content: {status: null, error: error}});
				}
			});
			
		}
		
		if (event.header == "scanWifi") {
			
			wifiScan();
			networkCore.getWifiStatus(function(status, error) {
				if (!error) {
					beoBus.emit("ui", {target: "network", header: "wifiStatus", content: {status: status}});
				} else {
					beoBus.emit("ui", {target: "network", header: "wifiStatus", content: {status: null, error: error}});
				}
			});
			
		}
		
		if (event.header == "populateEthernetUI") {
			
			networkCore.getEthernetStatus(function(status, error) {
				if (!error) {
					beoBus.emit("ui", {target: "network", header: "ethernetStatus", content: {status: status, testNoEthernet: testNoEthernet}});
				} else {
					beoBus.emit("ui", {target: "network", header: "ethernetStatus", content: {status: null, error: error}});
				}
			});
			
		}
		
		if (event.header == "getCountry") {
			
			
			beoBus.emit("choose-country", {header: "currentCountry", content: {country: country}});
			
		}
		
		if (event.header == "addNetwork") {
			if (event.content.ssid) {
				update = (event.content.update) ? true : false;
				result = networkCore.addNetwork({ssid: event.content.ssid, password: event.content.password, username: event.content.username}, update);
				if (result == 1 || result == 3) {
					if (result == 1) {
						beoBus.emit("ui", {target: "network", header: "networkAdded", content: {ssid: event.content.ssid}});
						if (debug) console.log("Network '"+event.content.ssid+"' was added.");
					} else if (result == 3) {
						beoBus.emit("ui", {target: "network", header: "networkUpdated", content: {ssid: event.content.ssid}});
						if (debug) console.log("Network '"+event.content.ssid+"' was updated.");
					}
					networks = networkCore.listSavedNetworks();
					beoBus.emit("ui", {target: "network", header: "savedNetworks", content: {networks: networks}});
				} else {
					if (debug) console.error("Network '"+event.content.ssid+"' already exists.");
					beoBus.emit("ui", {target: "network", header: "networkExists", content: {ssid: event.content.ssid}});
				}
			}		
		}
		
		if (event.header == "forgetNetwork") {
			if (event.content.ssid) {
				success = networkCore.removeNetwork(event.content.ssid);
				if (success) {
					beoBus.emit("ui", {target: "network", header: "networkRemoved", content: {ssid: event.content.ssid}});
					if (debug) console.log("Network '"+event.content.ssid+"' was removed.");
					networks = networkCore.listSavedNetworks();
					beoBus.emit("ui", {target: "network", header: "savedNetworks", content: {networks: networks}});
				} else {
					if (debug) console.error("Network '"+event.content.ssid+"' was not removed, because it was not found.");
				}
			}
		}
		
	});
	
	var wifiScanning = false;
	function wifiScan(callback) {
		if (!wifiScanning) {
			wifiScanning = true;
			beoBus.emit("ui", {target: "network", header: "scanning"});
			networkCore.listAvailableNetworks(function(networks, error) {
				wifiScanning = false;
				if (!error) {
					beoBus.emit("ui", {target: "network", header: "availableNetworks", content: {networks: networks}});
				} else {
					beoBus.emit("ui", {target: "network", header: "availableNetworks", content: {networks: networks, error: error}});
				}
				if (callback) callback(networks, error);
			});
		}
	}
	
	// CONNECTION CONTROLLER
	// Periodically checks the network connection and takes action, depending on circumstances.
	var connectionCheckInterval = null;
	var connectionMode = "";
	var connectionCheckCounter = 0;
	var connectionCheckMax = 0;
	var sawPreviousNetworks = false;
	
	function setConnectionMode(options) {

		if (options && options.mode && connectionMode != options.mode) {
			clearInterval(connectionCheckInterval);
			connectionCheckCounter = 0;
			
			switch (options.mode) {
				case "initial":
					// Rapid checks when system starts or after exiting hotspot mode;
					connectionCheckMax = 10;
					if (debug) console.log("Network: checking for local network...");
					if (networkHardware.wifi && networkCore.getSetupNetworkStatus()) {
						if (debug) console.log("Network: switching off setup hotspot...");
						networkCore.setupNetwork();
					}
					beoBus.emit("led", {header: "blink", content: {options: {interval: 0.5, colour: "white"}}});
					interval = 3;
					break;
				case "connected":
					// Slow checks when the connection is running normally.
					if (debug) console.log("Network: connected to local network.");
					sawPreviousNetworks = false;
					if (networkHardware.wifi && networkCore.getSetupNetworkStatus()) {
						networkCore.setupNetwork();
					}
					if (extensions["setup"] && extensions["setup"].leaveSetupFlow) {
						extensions["setup"].leaveSetupFlow("network");
					}
					checkInternetConnection(function(status) {
						if (debug && status == true) console.log("Network: internet connection is working.");
					});
					beoBus.emit("led", {header: "fadeTo", content: {options: {colour: "white", then: {action: "fadeTo", colour: "red", after: 2, speed: "slow"}}}});
					interval = 60;
					break;
				case "disconnected":
					// A bit faster checks when there is no connection. This mode is really only for systems without Wi-Fi.
					if (debug) console.log("Network: local network connection was not detected.");
					interval = 30;
					break;
				case "hotspot":
					// Start hotspot. During hotspot mode, periodically check if previously set up Wi-Fi networks become available, switch hotspot off in that case.
					hotspotName = "";
					if (extensions["product-information"] && extensions["product-information"].getProductInformation) {
						info = extensions["product-information"].getProductInformation();
						if (info.systemID) {
							// Hotspot name contains the Raspberry Pi ID to allow multiple hotspots to coexist.
							hotspotName = "Beocreate_Setup_"+info.systemID.replace(/^0+/, '');
						}
					}
					if (!hotspotName) hotspotName = "Beocreate_Setup";
					if (debug) console.log("Network: starting setup hotspot with name: '"+hotspotName+"'...");
					networkCore.setupNetwork(hotspotName);
					if (extensions["setup"] && extensions["setup"].joinSetupFlow) {
						extensions["setup"].joinSetupFlow("network", {after: ["choose-country"], before: ["sound-preset", "product-information"]});
					}
					interval = 30;
					beoBus.emit("led", {header: "blink", content: {options: {interval: 1, colour: "orange"}}});
					break;
			}
			connectionMode = options.mode;
			
			connectionCheckInterval = setInterval(function() {
				switch (connectionMode) {
					case "initial":
						checkLocalConnection(function(status) {
							if (status == true) {
								setConnectionMode({mode: "connected"});
							} else {
								connectionCheckCounter++;
								if (connectionCheckCounter >= connectionCheckMax) {
									if (networkHardware.wifi) {
										setConnectionMode({mode: "hotspot"});
									} else {
										setConnectionMode({mode: "disconnected"});
									}
								}
							}
						});
						break;
					case "connected":
						checkLocalConnection(function(status) {
							//if (debug) console.log("Has local network connection: "+status);
							if (status == false) {
								if (debug) console.log("Network connection lost.");
								if (networkHardware.wifi) {
									setConnectionMode({mode: "hotspot"});
								} else {
									setConnectionMode({mode: "disconnected"});
								} 
							} else {
								if (!hasInternetConnection) {
									// Keep checking for internet connection, if it hasn't been yet detected.
									checkInternetConnection(function(status) {
										if (debug && status == true) console.log("Network: internet connection is working.");
									});
								}
							}
						});
						break;
					case "disconnected":
						checkLocalConnection(function(status) {
							if (status == true) {
								setConnectionMode({mode: "connected"});
							}
						});
						break;
					case "hotspot":
						checkLocalConnection(function(status) {
							// A wild Ethernet connection appears.
							if (status == true) {
								setConnectionMode({mode: "connected"});
							}
						});
						if (!sawPreviousNetworks && !wifiScanning && !globals.setup) {
							wifiScan(function(networks, error) {
								if (error) {
									// Error scanning, but ignore it.
								} else {
									if (networks.length > 0) {
										for (var i = 0; i < networks.length; i++) {
											if (networks[i].added) {
												sawPreviousNetworks = true; // Set this flag so that we don't constantly turn on and off the hotspot, if a network that has a familiar SSID doesn't actually work.
												if (debug) console.log("Network: hotspot is on, but a previously added network was seen.");
												setConnectionMode({mode: "initial"});
												break;
											}
										}
									}
								}
							});
						}
						break;
				}
			}, interval*1000);
		}
	}
	
	
	function checkLocalConnection(callback) {
		networkCore.getEthernetStatus(function(status, error) {
			connection = false;
			newIP = false;
			if (!error) {
				networkHardware.ethernet = true;
				if (status.connected) connection = true;
				if (status.ipv4 && status.ipv4.address) {
					if (status.ipv4.address != cachedIPAddresses.ethernet) {
						newIP = true;
						cachedIPAddresses.ethernet = status.ipv4.address;
					}
				} else {
					cachedIPAddresses.ethernet = null;
				}
				//if (status.connected) console.log("Ethernet connected.");
				if (testNoEthernet) connection = false;
			} else {
				networkHardware.ethernet = false;
				cachedIPAddresses.ethernet = null;
			}
			networkCore.getWifiStatus(function(status, error) {
				if (!error) {
					networkHardware.wifi = true;
					if (status.connected) connection = true;
					if (status.ipv4 && status.ipv4.address) {
						if (status.ipv4.address != cachedIPAddresses.wifi) {
							newIP = true;
							cachedIPAddresses.wifi = status.ipv4.address;
						}
					} else {
						cachedIPAddresses.wifi = null;
					}
					//if (status.connected) console.log("Wlan connected.");
				} else {
					networkHardware.wifi = false;
					cachedIPAddresses.wifi = null;
				}
				if (connection != hasLocalConnection) {
					hasLocalConnection = connection;
					beoBus.emit("network", {header: "localNetworkStatus", content: hasLocalConnection});
					if (connection == false && hasInternetConnection) {
						hasInternetConnection = false;
						beoBus.emit("network", {header: "internetStatus", content: hasInternetConnection});
					}
				}
				if (newIP) {
					beoBus.emit("network", {header: "newIPAddresses", content: {ipv4: cachedIPAddresses}});
				}
				callback(connection);
			});
		});
	}
	
	
	function checkInternetConnection(callback) {
		networkCore.checkForInternet(function(result) {
			connection = (result) ? true : false;
			if (connection != hasInternetConnection) {
				hasInternetConnection = connection;
				beoBus.emit("network", {header: "internetStatus", content: hasInternetConnection});
			}
			callback(connection);
		});
	}
	
	
	function getCountry() {
		return networkCore.getCountry();
	}
	
	function setCountry(countryCode) {
		return networkCore.setCountry(countryCode);
	}
	
	return {
		getCountry: getCountry,
		setCountry: setCountry,
		checkInternetConnection: checkInternetConnection,
		checkLocalConnection: checkLocalConnection,
		version: version
	};
};




