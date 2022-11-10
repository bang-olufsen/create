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
var fs = require("fs");
var networkCore = require('../../beocreate_essentials/networking');

	var debug = beo.debug;
	var extensions = beo.extensions;
	
	var version = require("./package.json").version;
	
	var defaultSettings = {
		"wireless": true,
		"useHifiberryHotspot": true,
		"setupNetworkWhenConnectionLost": false,
		"testNoEthernet": false
	};
	var settings = JSON.parse(JSON.stringify(defaultSettings));
	
	// testNoEthernet: Set to true to make Ethernet a "stealth" interface: even when connected, the system will consider it disconnected to allow testing automated hotspot functions.
	
	var networkHardware = {wifi: false, ethernet: false};
	
	var hasLocalConnection = false;
	var hasInternetConnection = false;
	var cachedIPAddresses = {wifi: null, ethernet: null}; // If IP addresses change, the system should rebroadcast its zeroconf advertisement.
	
	var canStartSetupNetwork = false;
	var wirelessOn = false;
	
	beo.bus.on('general', function(event) {
		
		
		if (event.header == "startup") {
			checkLocalConnection(function(status) {
				if (status == true) {
					setConnectionMode({mode: "connected"});
				} else {
					setConnectionMode({mode: "initial"});
					temporarilyAllowSetupNetwork();
				}
			}, true);
		}
		
		if (event.header == "shutdown") {
			
			setConnectionMode();
		}
		
		if (event.header == "activatedExtension") {
			if (event.content.extension == "network") {
				checkLocalConnection(function(status) {
					if (status == true) {
						setConnectionMode({mode: "connected"});
					}
				});
				if (connectionMode == "hotspot") sawPreviousNetworks = true; // Set this so that when the user is viewing the UI it doesn't drop out unexpectedly.
				beo.bus.emit("ui", {target: "network", header: "networkHardware", content: {hardware: networkHardware}});
			}
		}
	});
	
	
	beo.bus.on('network', function(event) {
		
		if (event.header == "settings") {
			
			if (event.content.settings) {
				settings = Object.assign(settings, event.content.settings);
			}
			
		}
		
		if (event.header == "populateWifiUI") {
			
			networks = networkCore.listSavedNetworks();
			if (networks.length > 0 && beo.setup) {
				if (extensions["setup"] && extensions["setup"].allowAdvancing) {
					extensions["setup"].allowAdvancing("network", true);
				}
			}
			beo.sendToUI("network", "savedNetworks", {networks: networks});
			
			
			wifiScan();
			networkCore.getWifiStatus(function(status, error) {
				if (!error) {
					wirelessOn = status.up;
					beo.sendToUI("network", "wifiStatus", {status: status});
				} else {
					beo.sendToUI("network","wifiStatus", {status: null, error: error});
				}
			});
			
		}
		
		if (event.header == "scanWifi") {
			
			wifiScan();
			networkCore.getWifiStatus(function(status, error) {
				if (!error) {
					wirelessOn = status.up;
					beo.bus.emit("ui", {target: "network", header: "wifiStatus", content: {status: status}});
				} else {
					beo.bus.emit("ui", {target: "network", header: "wifiStatus", content: {status: null, error: error}});
				}
			});
			
		}
		
		if (event.header == "toggleWireless") {
			if (event.content.enabled != undefined && wirelessOn != event.content.enabled) {
				networkCore.setWifiStatus(event.content.enabled, function(newStatus, err) {
					if (!err) {
						wirelessOn = newStatus;
						settings.wireless = wirelessOn;
						beo.sendToUI("network", "wirelessToggle", {enabled: wirelessOn, error: false});
						beo.saveSettings("network", settings);
						
						if (wirelessOn) {
							networks = networkCore.listSavedNetworks();
							beo.sendToUI("network", "savedNetworks", {networks: networks});
							networkCore.getWifiStatus(function(status, error) {
								if (!error) {
									wirelessOn = status.up;
									beo.sendToUI("network", "wifiStatus", {status: status});
								} else {
									beo.sendToUI("network","wifiStatus", {status: null, error: error});
								}
							});
							// Scan for networks after 2 and 10 seconds. After 10 seconds, send status again.
							setTimeout(function() {
								wifiScan();
							}, 2000);
							setTimeout(function() {
								if (wirelessOn) {
									wifiScan();
									networkCore.getWifiStatus(function(status, error) {
										if (!error) {
											wirelessOn = status.up;
											beo.sendToUI("network", "wifiStatus", {status: status});
										} else {
											beo.sendToUI("network","wifiStatus", {status: null, error: error});
										}
									});
								}
							}, 11000);
						}
					} else {
						beo.sendToUI("network", "wirelessToggle", {enabled: wirelessOn, error: true});
					}
				});
			}
		}
		
		if (event.header == "populateEthernetUI") {
			
			networkCore.getEthernetStatus(function(status, error) {
				if (!error) {
					beo.bus.emit("ui", {target: "network", header: "ethernetStatus", content: {status: status, testNoEthernet: settings.testNoEthernet}});
				} else {
					beo.bus.emit("ui", {target: "network", header: "ethernetStatus", content: {status: null, error: error}});
				}
			});
			
		}
		
		if (event.header == "getCountry") {
			
			
			beo.bus.emit("choose-country", {header: "currentCountry", content: {country: country}});
			
		}
		
		if (event.header == "addNetwork") {
			if (event.content.ssid) {
				update = (event.content.update) ? true : false;
				networkCore.addNetwork({ssid: event.content.ssid, password: event.content.password, username: event.content.username}, update).then(result => {
					if (result == 1 || result == 3) {
						if (result == 1) {
							beo.bus.emit("ui", {target: "network", header: "networkAdded", content: {ssid: event.content.ssid}});
							if (debug) console.log("Network '"+event.content.ssid+"' was added.");
						} else if (result == 3) {
							beo.bus.emit("ui", {target: "network", header: "networkUpdated", content: {ssid: event.content.ssid}});
							if (debug) console.log("Network '"+event.content.ssid+"' was updated.");
							temporarilyAllowSetupNetwork();
						}
						networks = networkCore.listSavedNetworks();
						if (networks.length > 0 && beo.setup) {
							if (extensions["setup"] && extensions["setup"].allowAdvancing) {
								extensions["setup"].allowAdvancing("network", true);
							}
						}
						wifiScan();
						beo.bus.emit("ui", {target: "network", header: "savedNetworks", content: {networks: networks}});
					} else {
						if (debug) console.error("Network '"+event.content.ssid+"' already exists.");
						beo.bus.emit("ui", {target: "network", header: "networkExists", content: {ssid: event.content.ssid}});
					}
				}).catch(error => {
					// Error adding network.
					console.error("Error adding network:", error);
				});
			}		
		}
		
		if (event.header == "forgetNetwork") {
			if (event.content.ssid) {
				success = networkCore.removeNetwork(event.content.ssid);
				if (success) {
					beo.bus.emit("ui", {target: "network", header: "networkRemoved", content: {ssid: event.content.ssid}});
					if (debug) console.log("Network '"+event.content.ssid+"' was removed.");
					networks = networkCore.listSavedNetworks();
					wifiScan();
					if (networks.length != 0 && beo.setup) {
						if (extensions["setup"] && extensions["setup"].allowAdvancing) {
							extensions["setup"].allowAdvancing("network", false);
						}
					}
					temporarilyAllowSetupNetwork();
					beo.bus.emit("ui", {target: "network", header: "savedNetworks", content: {networks: networks}});
				} else {
					if (debug) console.error("Network '"+event.content.ssid+"' was not removed, because it was not found.");
				}
			}
		}
		
		if (event.header == "applyIPSettings") {
			if (event.content.forInterface && event.content.automatic != undefined) {
				if (event.content.forInterface == "wifi" || event.content.forInterface == "ethernet") {
					if (event.content.automatic) {
						networkCore.configureIPAddress(null, event.content.forInterface, function(success, error) {
							if (success) console.log("Interface '"+event.content.forInterface+"' configured for DHCP.");
						});
					} else if (event.content.settings.address &&
								event.content.settings.subnetmask &&
								event.content.settings.router &&
								event.content.settings.dns) {
						networkCore.configureIPAddress(event.content.settings, event.content.forInterface, function(success, error) {
							if (success) console.log("Interface '"+event.content.forInterface+"' configured for static IP address.");
						});
					}
					if (event.content.forInterface == "wifi") {
						networkCore.getWifiStatus(function(status, error) {
							if (!error) {
								beo.bus.emit("ui", {target: "network", header: "wifiStatus", content: {status: status}});
							} else {
								beo.bus.emit("ui", {target: "network", header: "wifiStatus", content: {status: null, error: error}});
							}
						});
					} else {
						networkCore.getEthernetStatus(function(status, error) {
							if (!error) {
								beo.bus.emit("ui", {target: "network", header: "ethernetStatus", content: {status: status, testNoEthernet: settings.testNoEthernet}});
							} else {
								beo.bus.emit("ui", {target: "network", header: "ethernetStatus", content: {status: null, error: error}});
							}
						});
					}
				}
			}
		}
		
	});
	
	beo.bus.on('setup', function(event) {
	
		if (event.header == "advancing" && event.content.fromExtension == "network") {
			temporarilyAllowSetupNetwork();
			beo.bus.emit("ui", {target: "network", header: "exitingHotspot"});
			setConnectionMode({mode: "initial"});
		}
				
	});
	
	var wifiScanning = false;
	function wifiScan(callback) {
		if (!wifiScanning && wirelessOn) {
			wifiScanning = true;
			beo.bus.emit("ui", {target: "network", header: "scanning"});
			networkCore.listAvailableNetworks(function(networks, error) {
				wifiScanning = false;
				if (!error) {
					beo.bus.emit("ui", {target: "network", header: "availableNetworks", content: {networks: networks}});
				} else {
					beo.bus.emit("ui", {target: "network", header: "availableNetworks", content: {networks: networks, error: error}});
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
					setupNetwork();
					beo.bus.emit("network", {header: "status", content: "connecting"});
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
					beo.bus.emit("ui", {target: "network", header: "connected"});
					beo.bus.emit("network", {header: "status", content: "connected"});
					interval = 60;
					break;
				case "disconnected":
					// A bit faster checks when there is no connection. This mode is really only for systems without Wi-Fi.
					if (debug) console.log("Network: local network connection was not detected.");
					beo.bus.emit("network", {header: "status", content: "disconnected"});
					interval = 30;
					break;
				case "hotspot":
					// Start hotspot. During hotspot mode, periodically check if previously set up Wi-Fi networks become available, switch hotspot off in that case.
					hotspotStartedOnce = true;
					setupNetwork(true);
					if (extensions["setup"] && extensions["setup"].joinSetupFlow) {
						extensions["setup"].joinSetupFlow("network", {after: ["choose-country"], before: ["speaker-preset", "product-information"]});
					}
					interval = 30;
					beo.bus.emit("network", {header: "status", content: "setup"});
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
									if (networkHardware.wifi && canStartSetupNetwork) {
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
						if (!sawPreviousNetworks && !wifiScanning) {
							wifiScan(function(networks, error) {
								if (error) {
									// Error scanning, but ignore it.
								} else {
									if (networks.length > 0) {
										for (var i = 0; i < networks.length; i++) {
											if (networks[i].added) {
												if (!beo.setup) {
													sawPreviousNetworks = true; // Set this flag so that we don't constantly turn on and off the hotspot, if a network that has a familiar SSID doesn't actually work.
													if (debug) console.log("Network: hotspot is on, but a previously added network was seen.");
													setConnectionMode({mode: "initial"});
												}
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
	
	
	function setupNetwork(start) {
		if (start) {
			hotspotName = "";
			hotspotPrefix = "Beocreate";
			if (beo.customisations &&
				beo.customisations.hotspotPrefix) {
				hotspotPrefix = beo.customisations.hotspotPrefix;
			} else if (beo.systemConfiguration.cardType) {
				if (beo.systemConfiguration.cardType.indexOf("Beocreate") != -1) {
					hotspotPrefix = "Beocreate";
				} else {
					hotspotPrefix = "HiFiBerry";
				}
			}
			if (extensions["product-information"] && extensions["product-information"].getProductInformation) {
				info = extensions["product-information"].getProductInformation();
				if (info.systemID) {
					// Hotspot name contains the Raspberry Pi ID to allow multiple hotspots to coexist.
					hotspotName = hotspotPrefix+" Setup "+info.systemID.substr(1).replace(/^0+/, '');
				}
			}
			if (!hotspotName) hotspotName = hotspotPrefix+" Setup";
			if (debug) console.log("Network: starting setup hotspot with name: '"+hotspotName+"'...");
			beo.bus.emit("network", {header: "status", content: "setup"});
		}
		if (!settings.useHifiberryHotspot) {
			if (start) {
				networkCore.setupNetwork(hotspotName);
			} else {
				if (networkHardware.wifi && networkCore.getSetupNetworkStatus()) {
					if (debug) console.log("Stopping setup hotspot...");
					networkCore.setupNetwork();
				}
			}
		} else {
			if (start) {
				networkCore.setSetupNetworkStatus(true);
				if (fs.existsSync("/etc/tempap-hostapd.conf")) {
					hotspotConfig = fs.readFileSync("/etc/tempap-hostapd.conf", "utf8").split('\n');
					for (var i = 0; i < hotspotConfig.length; i++) {
						if (hotspotConfig[i].indexOf("ssid=") != -1) {
							hotspotConfig[i] = "ssid="+hotspotName;
						}
					}
					fs.writeFileSync("/etc/tempap-hostapd.conf", hotspotConfig.join("\n"));
				}
				child_process.exec("systemctl start tempap.service");
			} else {
				if (debug) console.log("Stopping setup hotspot...");
				child_process.exec("systemctl stop tempap.service");
				networkCore.setSetupNetworkStatus(false);
			}
		}
	}
	
	setupNetworkAllowTimeout = null;
	function temporarilyAllowSetupNetwork() {
		if (settings.wireless) canStartSetupNetwork = true;
		if (!settings.setupNetworkWhenConnectionLost) {
			clearTimeout(setupNetworkAllowTimeout);
			setupNetworkAllowTimeout = setTimeout(function() {
				canStartSetupNetwork = false;
			}, 90000);
		}
	}
	
	
	function checkLocalConnection(callback, canTurnOffWireless = false) {
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
				if (settings.testNoEthernet) connection = false;
			} else {
				networkHardware.ethernet = false;
				cachedIPAddresses.ethernet = null;
			}
			networkCore.getWifiStatus(function(status, error) {
				if (!error) {
					networkHardware.wifi = true;
					wirelessOn = status.up;
					if (!settings.wireless && 
						canTurnOffWireless &&
						wirelessOn) {
						networkCore.setWifiStatus(false, function(newStatus, err) {
							wirelessOn = newStatus;
						});
						cachedIPAddresses.wifi = null;
					} else {
						if (status.connected) connection = true;
						if (status.ipv4 && status.ipv4.address) {
							if (status.ipv4.address != cachedIPAddresses.wifi) {
								newIP = true;
								cachedIPAddresses.wifi = status.ipv4.address;
							}
						} else {
							cachedIPAddresses.wifi = null;
						}
					}
					//if (status.connected) console.log("Wlan connected.");
				} else {
					networkHardware.wifi = false;
					cachedIPAddresses.wifi = null;
				}
				if (connection != hasLocalConnection) {
					hasLocalConnection = connection;
					beo.bus.emit("network", {header: "localNetworkStatus", content: hasLocalConnection});
					if (connection == false && hasInternetConnection) {
						hasInternetConnection = false;
						beo.bus.emit("network", {header: "internetStatus", content: hasInternetConnection});
					}
				}
				if (newIP) {
					beo.bus.emit("network", {header: "newIPAddresses", content: {ipv4: cachedIPAddresses}});
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
				beo.bus.emit("network", {header: "internetStatus", content: hasInternetConnection});
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
	
interact = {
	actions: {
		startSetupNetwork: function() {
			if (networkHardware.wifi) setupNetwork(true);
		}
	}
}
	
module.exports = {
	getCountry: getCountry,
	setCountry: setCountry,
	checkInternetConnection: checkInternetConnection,
	checkLocalConnection: checkLocalConnection,
	version: version,
	interact: interact
};




