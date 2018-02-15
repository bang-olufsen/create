/*Copyright 2018 Bang & Olufsen A/S
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

// Wi-Fi/Network Setup

// Handles discovery and setup of Wi-Fi networks. In essence, it is a front-end for wpa_supplicant and a few other tools.

// Requires that wireless-tools, ping and utf8 modules are installed.
var iwconfig = require('wireless-tools/iwconfig');
var iwlist = require('wireless-tools/iwlist');
var wpa_cli = require('wireless-tools/wpa_cli');
//var udhcpd = require('wireless-tools/udhcpd');
var os = require('os');
var ping = require('ping');
var utf8 = require('utf8');

var child_process = require('child_process');

var wifiMode = "normal"; // "hotspot", "autoHotspot";

var wifi_setup = module.exports = {
	listAvailable: listAvailable,
	listSaved: listSaved,
	getStatus: getStatus,
	getIP: getIP,
	addNetwork: addNetwork,
	removeNetwork: removeNetwork,
	mode: mode,
	initialise: initialise,
	waitForNetwork: waitForNetwork
};

var savedNetworks = null;

var interface = "wlan0";
var setupNetworkName = "BeoSetup";

function initialise(withMode, callback, customInterface) {
	getStatus(function(response) {
		if (response != false) {
			mode(withMode);
			if (callback) callback(true);
		} else {
			wifiMode = false;
			if (callback) callback(false);
			// No Wi-Fi in this system – let's assume a wired connection.
		}
	});
}


function listSaved(callback, customInterface) {
	// Lists networks that have already been set up. If customInterface is not specified, wlan0 is used.
	//interface = "wlan0";
	if (customInterface) interface = customInterface;
	if (wifiMode) {
		command = "wpa_cli -i "+interface+" list_networks";
		child_process.exec(command, function(error, stdout, stderr) {
			if (error) {
				callback(null, error);
			} else if (stdout) {
				resultItems = stdout.split("\n").splice(1);
				savedNetworks = [];
				for (var i = 0; i < resultItems.length; i++) {
					networkItems = resultItems[i].split("\t");
					if (!isNaN(parseInt(networkItems[0])) && networkItems[1] != setupNetworkName) { // Check that this is a valid entry (and not an empty line), and that this is not the BeoSetup network (we don't want to show that)
						tempID = parseInt(networkItems[0]); // gGt the ID
						tempSSID = utf8.decode(networkItems[1]);
						tempCurrent = false;
						tempErrors = null;
						if (networkItems[3]) { // find the current network
							if (networkItems[3] == "[CURRENT]") tempCurrent = true;
							if (networkItems[3] == "[TEMP-DISABLED]") tempErrors = "tempDisabled";
						}
						savedNetworks.push({ID: tempID, SSID: tempSSID, current: tempCurrent, errors: tempErrors});
					}
	
				}
				callback(savedNetworks, null);
			}
		});
	} else {
		callback(null);
	}
}



function getStatus(callback, customInterface) {
	// Returns Wi-Fi status. If customInterface is not specified, wlan0 is used.
	if (customInterface) interface = customInterface;
	iwconfig.status(interface, function(err, status) {
		if (err) {
			callback(false);
		} else {
			callback(status);
		}
	});
}



var networkScanRound = 0;
var networkScanInterface;
var networkScanCallback = null;
var availableNetworks = [];

function listAvailable(callback, customInterface) {
	// Scans for available networks. Tries up to 10 times, if the scan fails for some reason. If customInterface is not specified, wlan0 is used.
	//interface = "wlan0";
	if (customInterface) interface = customInterface;
	if (wifiMode) {
		networkScanRound = 0;
		networkScanCallback = callback;
		networkScanInterface = interface;
		
		if (!savedNetworks) { // Check if saved networks have already been listed, if not, list them.
			listSaved(function(savedNetworks, error) {  
				scanForNetworks(); // Begin the scan rounds.
			});
		} else {
			scanForNetworks(); // Begin the scan rounds.
		}
	} else {
		callback(null);
	}
}

var scanForNetworks = function() {
	// If the actual scan function gets no results, it will call this function again, which in turn will start another scan.
	networkScan(networkScanRound, function() {
		networkScanRound++;
		scanForNetworks();
	});
}

function networkScan(scanRound, callback) {
	if (scanRound < 10) {
	
		iwlist.scan({
				iface: interface,
				show_hidden: false
			}, function(err, networks) {
				if (err) {
					// Unsuccesful, try again.
					if (callback) callback();
				} else if (networks) {
					// Succesful scan.
					if (networks.length > 0) {
						listedSSIDs = [];
						availableNetworks = [];
						// Go through networks to remove duplicates and also those that already seem to be configured.
						savedSSIDs = [];
						for (var i = 0; i < savedNetworks.length; i++) {
							savedSSIDs.push(savedNetworks[i].SSID);
						}
						for (var i = 0; i < networks.length; i++) {
							if (listedSSIDs.indexOf(networks[i].ssid) == -1) {
								listedSSIDs.push(networks[i].ssid);
								if (savedSSIDs.indexOf(networks[i].ssid) == -1) {
									networks[i].added = false;
								} else {
									networks[i].added = true;
								}
								availableNetworks.push(networks[i]);
							}
						}
						if (networkScanCallback) networkScanCallback(availableNetworks);
					} else {
						if (callback) callback();
					}
				}
		});
	} else {
		// All scan attempts failed. Return null, meaning error.
		if (networkScanCallback) networkScanCallback(null);
	}
}




function addNetwork(options, callback, customInterface) {
	// Adds a new network. If customInterface is not specified, wlan0 is used.
	// Expects an object with either ID (for choosing from list of available networks) or SSID and password to set up network settings.
	//interface = 'wlan0';
	if (customInterface) interface = customInterface;
	
	if (wifiMode) {
		if (options.ID != undefined) {
			options.SSID = availableNetworks[options.ID].ssid;
		} else if (options.SSID) {
			//theSSID = options.SSID;
			
		} else {
			callback(null, "Missing SSID");
			return;
		}
		wpa_cli.add_network(interface, function(err, data) {
			if (err) {
				//console.log("Error adding network. ", err);
				callback(null, err);
			} else {
				// network was added, configure
				addedNetworkID = data.result;
				//console.log("Added new network "+addedNetworkID);
				wpa_cli.set_network(interface, addedNetworkID, "ssid", "'\"" + options.SSID + "\"'", function(err, data) {
					if (err) {
						//console.log("Error naming network. ", err);
						callback(null, err);
					} else {
						// succesfully added SSID.
						//console.log("Named network "+addedNetworkID+" to "+options.SSID+".");
						if (options.password) { // if there is a password, add it.
							
							wpa_cli.set_network(interface, addedNetworkID, "psk", "'\"" + options.password + "\"'", function(err, data) {
								if (err) {
									console.log("Error adding password. ", err);
									callback(null, err);
								} else {
									// succesfully added password
									//console.log("Added password to network  "+addedNetworkID+" ("+options.password+").");
									finishAddingNetwork(interface, addedNetworkID, options, callback);
								}
							});
	
						} else {
							wpa_cli.set_network(interface, addedNetworkID, "key_mgmt", "NONE", function(err, data) {
								if (err) {
									console.log(err);
									callback(null, err);
								} else {
									// succesfully added password
									finishAddingNetwork(interface, addedNetworkID, options, callback);
								}
							});
							
						}
					}
				});
			}
		});
	} else {
		callback(null);
	}
}

function finishAddingNetwork(interface, addedNetworkID, options, callback) {
	//console.log(mode);
	if (wifiMode != "hotspot") {
		// if we're not in soft-AP mode, enable the network right away, otherwise it will be enabled when setup mode is turned off.
		wpa_cli.enable_network(interface, addedNetworkID, function(err, data) {
			if (err) {
				console.log("Error enabling network. ", err);
				callback(null, err);
			} else {
				wpa_cli.save_config(interface, function(err, data) {
					callback(options.SSID, null);
				});
			}
		});
	} else {
		wpa_cli.save_config(interface, function(err, data) {
			// current wpa_cli configuration is saved
			callback(options.SSID, null);
		});
	}
}



var newWifiMode;
function mode(newMode, callback, customInterface) {
	if (!newMode) {
		return wifiMode;
	} else {
		// Sets Wi-Fi operation mode (client/hotspot). If customInterface is not specified, wlan0 is used.
		//interface = "wlan0";
		if (customInterface) interface = customInterface;
		//console.log("Setting Wi-Fi to "+newMode);
		newWifiMode = newMode;
		if (wifiMode) {
			if (newMode == "normal" || newMode == "autoHotspot") {
					/*udhcpd.disable(interface, function(err) {
					  if (err) console.log(err);
					});*/
					command = "wpa_cli -i "+interface+" list_networks";
					child_process.exec(command, function(error, stdout, stderr) {
						if (error) {
							callback(null, error);
						} else if (stdout) {
							resultItems = stdout.split("\n").splice(1);
							for (var i = 0; i < resultItems.length; i++) {
								networkItems = resultItems[i].split("\t");
								if (!isNaN(parseInt(networkItems[0])) && networkItems[1] == setupNetworkName) { // Check if the BeoSetup network is disabled. If not, do the dance.
									//if (networkItems[3]) {
										//if (networkItems[3] != "[DISABLED]") {
											wpa_cli.disable_network(interface, 0, function(err, data) {
												if (err) {
													callback(null, err);
												} else {
													// Setup network disabled
													networkEnableIndex = 0;
													
													// First make sure we have a list of saved networks so that we can go through their IDs one by one.
													listSaved(function(savedNetworks, error) {  
														//console.log(savedNetworks);
														enableAllNetworks(interface, callback);
													});
												}
											});
										//}
									//}
								}
							}
							
						}
					});
			} else if (newMode == "hotspot") {
					wpa_cli.select_network(interface, 0, function(err, data) {
						if (err) {
							if (typeof(callback) == "function") callback(null, err);
						} else {
							// Successfully created setup network 
							wifiMode = "hotspot";
							
							/*dhcpOptions = {
							  interface: interface,
							  start: '192.168.1.101',
							  end: '192.168.1.200',
							  option: {
							    router: '192.168.1.1',
							    subnet: '255.255.255.0',
							    dns: [ '4.4.4.4', '8.8.8.8' ]
							  }
							};
							 
							udhcpd.enable(dhcpOptions, function(err) {
								if (err) console.log(err);
							});*/
							wpa_cli.save_config(interface, function(err, data) {
								command = "ifconfig "+interface+" down";
								child_process.exec(command, function(error, stdout, stderr) {
									if (error) {
										console.log(error);
									} else {
										setTimeout(function() {
											command = "ifconfig "+interface+" up";
											child_process.exec(command, function(error, stdout, stderr) {
												if (error) {
													console.log(error);
												} else {
													console.log("Hotspot enabled.");
												  	if (typeof(callback) == "function") callback("hotspot", null);
												}
											});
										}, 2000);
									}
								});
							});
						}
					});
			} else {
				callback(null);
			}
		}
		
	}
}


var networkEnableIndex = 0;
var networkEnableCallback;
var enableAllNetworks = function(customInterface, callback) {
	//console.log("Yay");
	if (callback) networkEnableCallback = callback;
	if (customInterface) interface = customInterface;
	if (savedNetworks[networkEnableIndex]) {
		theID = savedNetworks[networkEnableIndex].ID;
		enableNetwork(theID, function() {
			// set x to next item
			networkEnableIndex++;
			enableAllNetworks();
		});
	} else {
		// All networks enabled
		wifiMode = newWifiMode;
			wpa_cli.save_config(interface, function(err, data) {
				// current wpa_cli configuration is saved
				if (wifiMode == "autoHotspot") {
					//console.log("Waiting for network soon...");
					
					waitForNetwork(function(hasConnection) {
						if (!hasConnection) {
							mode("hotspot", callback);	
						} else {
							//console.log("Wi-Fi: autohotspot, connection was found");
							if (networkEnableCallback) networkEnableCallback(wifiMode, null);
						}
					}, true, customInterface);
				} else {
					//console.log("Wi-Fi: normal");
					if (networkEnableCallback) networkEnableCallback(wifiMode, null);
				}
			});
	}
}

function enableNetwork(networkIndex, internalCallback) {
	wpa_cli.enable_network(interface, networkIndex, function(err, data) {
		if (err) {

			console.log(err);
			
		} else {
			// successfully enabled network, enable the next network
			//console.log("Enabled network "+networkIndex);
			if (internalCallback) internalCallback();

		}
	});


}





function removeNetwork(networkID, callback, customInterface) {
	// Removes a network. If customInterface is not specified, wlan0 is used.
	if (customInterface) interface = customInterface;
	if (wifiMode) {
		wpa_cli.remove_network(interface, networkID, function(err, data) {
			if (err) {
				callback(null, err);
			} else {
				wpa_cli.save_config('wlan0', function(err, data) {
					// current wpa_cli configuration is saved
					callback(networkID, null);
					if (wifiMode == "autoHotspot") {
						//console.log("Waiting for network soon...");
						
						waitForNetwork(function(hasConnection) {
							if (!hasConnection) {
								mode("hotspot");
							}
						});
					}
				});
			}
		});
	} else {
		callback(null);
	}
}


function getIP(callback, customInterface) {
	
	if (customInterface) interface = customInterface;
	
	theInterface = interface;
	if (!wifiMode) theInterface = "eth0";
	
	ifaces = os.networkInterfaces();
	theIP = false;
	if (ifaces[theInterface]) {
		for (var i = 0; i < ifaces[theInterface].length; i++) {
			if (ifaces[theInterface][i].family == "IPv4") {
				theIP = ifaces[theInterface][i].address;
			}
		}
	}
	callback(theIP);
}


// WAIT FOR NETWORK
var networkWaitTimeout = null;
var networkWaitRounds = 0;
var networkWaitCallback = null;
function waitForNetwork(callback, doWifiCheck, customInterface) {
	// Waits for up to 30 seconds for a network connection. If returns true to the callback as soon as a connection is detected, or false after the maximum time if connection is not detected.
	
	if (callback) networkWaitCallback = callback;
	if (!doWifiCheck) {
		// Perform a general check for an internet connection
		console.log("Waiting for internet connection...");
		var cfg = {
		    timeout: 30,
		    extra: ["-i 2"],
		};
		 
		ping.sys.probe("8.8.8.8", function(isAlive){
			if (isAlive) {
				console.log("Internet connection detected.");
				networkWaitRounds = 0;
				networkWaitCallback(true);
				
			} else {
				if (networkWaitRounds < 10) {
					networkWaitRounds++;
					console.log("No internet connection, trying again...");
					setTimeout(function() {
						waitForNetwork();
					}, 2000);
				} else {
					console.log("No internet connection.");
					networkWaitRounds = 0;
					networkWaitCallback(false);
				}
				
			}
		}, cfg);
	} else {
		// If doWifiCheck flag has been set, actually wait for the product to connect to the network. The ping may be too quick to detect it.
		if (customInterface) interface = customInterface;
		
		clearTimeout(networkWaitTimeout);
		networkWaitRound(1);
	}
}

function networkWaitRound(theRound) {
	if (theRound) networkWaitRounds = theRound;
	networkWaitTimeout = setTimeout(function() {
		networkWaitRounds++;
		console.log("Waiting for Wi-Fi network...");
		getStatus(function(status) {
			if (status.ssid && status.ssid != setupNetworkName) {
				console.log("Wi-Fi network found, checking for internet connection...");
				setTimeout(function() {
					networkWaitRounds = 0;
					if (networkWaitCallback) waitForNetwork();
				}, 2000);
				
				//if (networkWaitCallback) networkWaitCallback(true);
			} else {
				if (networkWaitRounds > 8) {
					console.log("Wi-Fi network not found.");
					if (networkWaitCallback) networkWaitCallback(false);
				} else {
					networkWaitRound();
				}
			}
		});
	}, 2000);
}