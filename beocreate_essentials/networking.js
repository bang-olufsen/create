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

// Wi-Fi/Ethernet Setup

// A collection of relevant network setup functions for BeoCreate sound systems.


var fs = require('fs');
var os = require('os');
var exec = require('child_process').exec;
var iwlist = require('wireless-tools/iwlist');
var iwconfig = require('wireless-tools/iwconfig');
var ifconfig = require('wireless-tools/ifconfig');
//var udhcpd = require('wireless-tools/udhcpd');
//var hostapd = require('wireless-tools/hostapd');

var networking = module.exports = {
	getWifiStatus: getWifiStatus,
	setWifiStatus: setWifiStatus,
	getEthernetStatus: getEthernetStatus,
	getCountry: getCountry,
	setCountry: setCountry,
	listSavedNetworks: listSavedNetworks,
	listAvailableNetworks: listAvailableNetworks,
	removeNetwork: removeNetwork,
	addNetwork: addNetwork,
	setupNetwork: setupNetwork,
	setSetupNetworkStatus: setSetupNetworkStatus,
	getSetupNetworkStatus: getSetupNetworkStatus,
	reconfigure: reconfigure,
	checkForInternet: checkForInternet,
	configureIPAddress: configureIPAddress
}

var wifiConfiguration = {networks: []};
var wifiConfigModified = 0;
var setupNetworkName = "";
var externalSetupNetwork = false;
var setupNetworkActive = false;

var wifiConfigPath = null;
if (fs.existsSync("/etc/wpa_supplicant/wpa_supplicant.conf")) {
	var wifiConfigPath = "/etc/wpa_supplicant/wpa_supplicant.conf";
} else if (fs.existsSync("/etc/wpa_supplicant.conf")) {
	var wifiConfigPath = "/etc/wpa_supplicant.conf";
}



// GET NETWORK STATUS
// Does the system have Wi-Fi, is it on, is it connected and if so, where? Same for ethernet.
function getWifiStatus(callback) {
	if (callback) {
		ifconfig.status('wlan0', function(err, status) { // Use ifconfig to check if Wi-Fi is on or not.
			if (err) {
				// The system has no Wi-Fi capabilities.
				callback(null, err);
			} else {
				wifiStatus = {up: false, connected: false};
				if (status.up) wifiStatus.up = true;
				iwconfig.status('wlan0', function(err, status) {
					if (err) {
						// The system has no Wi-Fi capabilities.
						callback(null, err);
					} else {
						if (status.ssid && !status.unassociated) {
							wifiStatus.ssid = decodeURIComponent(escape(status.ssid.decodeEscapeSequence()));
							if (status.mode != "master") wifiStatus.connected = true;
							wifiStatus.quality = status.quality;
						}
						wlan0 = os.networkInterfaces().wlan0;
						if (wlan0) {
							for (var i = 0; i < wlan0.length; i++) {
								if (wlan0[i].family == "IPv4") {
									wifiStatus.mac = wlan0[i].mac;
									wifiStatus.ipv4 = {address: wlan0[i].address, subnetmask: wlan0[i].netmask};
								}
								if (wlan0[i].family == "IPv6") {
									wifiStatus.ipv6 = {address: wlan0[i].address, subnetmask: wlan0[i].netmask};
								}
							}
							dhcp = readDHCPSettings("wifi");
							if (dhcp && dhcp.Network) {
								if (dhcp.Network.DHCP) {
									// Automatic settings.
									wifiStatus.ipSetup = {auto: true};
								} else {
									// Manual settings.
									wifiStatus.ipSetup = {auto: false};
									wifiStatus.ipSetup.address = dhcp.Network.Address.split("/")[0];
									wifiStatus.ipSetup.subnetmask = CIDRToSubnetmask(dhcp.Network.Address.split("/")[1]);
									wifiStatus.ipSetup.dns = dhcp.Network.DNS;
									wifiStatus.ipSetup.router = dhcp.Network.Gateway;
								}
							}
						}
						callback(wifiStatus, false);
					}
				});
			}
		});
	}
}

function setWifiStatus(power, callback) {
	if (power == true) {
		exec('ifconfig wlan0 up', function(error, stdout, stderr){
		    if (callback) callback(true, error);
		});
	} else {
		exec('ifconfig wlan0 down', function(error, stdout, stderr){
		    if (callback) callback(false, error);
		});
	}
}

function getEthernetStatus(callback) {
	if (callback) {
		ifconfig.status('eth0', function(err, status) {
			if (err) {
				// No ethernet.
				callback(null, err);
			} else {
				ethernetStatus = {up: false, connected: false};
				if (status.up) ethernetStatus.up = true;
				if (status.running) {
					ethernetStatus.connected = true;
					eth0 = os.networkInterfaces().eth0;
					for (var i = 0; i < eth0.length; i++) {
						if (eth0[i].family == "IPv4") {
							ethernetStatus.mac = eth0[i].mac;
							ethernetStatus.ipv4 = {address: eth0[i].address, subnetmask: eth0[i].netmask};
						}
						if (eth0[i].family == "IPv6") {
							ethernetStatus.ipv6 = {address: eth0[i].address, subnetmask: eth0[i].netmask};
						}
					}
				}
				dhcp = readDHCPSettings("ethernet");
				if (dhcp && dhcp.Network) {
					if (dhcp.Network.DHCP) {
						// Automatic settings.
						ethernetStatus.ipSetup = {auto: true};
					} else {
						// Manual settings.
						ethernetStatus.ipSetup = {auto: false};
						ethernetStatus.ipSetup.address = dhcp.Network.Address.split("/")[0];
						ethernetStatus.ipSetup.subnetmask = CIDRToSubnetmask(dhcp.Network.Address.split("/")[1]);
						ethernetStatus.ipSetup.dns = dhcp.Network.DNS;
						ethernetStatus.ipSetup.router = dhcp.Network.Gateway;
					}
				}
				callback(ethernetStatus, false);
			}
		});
	}
}


// GET/SET WI-FI COUNTRY
// Wi-Fi may not connect to a network without specifying the correct channels that vary by country.
function getCountry() {
	readWifiConfiguration();
	if (wifiConfiguration.country) {
		return wifiConfiguration.country;
	} else {
		return null;
	}
}

function setCountry(countryCode) {
	if (countryCode) {
		readWifiConfiguration();
		wifiConfiguration.country = countryCode.toUpperCase();
		saveWifiConfiguration();
		return countryCode.toUpperCase();
	} else {
		return false;
	}
}


// LIST WI-FI NETWORKS

function listSavedNetworks() {
	readWifiConfiguration();
	networks = [];
	wifiConfiguration.networks.forEach(function(network) {
		if (!network.setupNetwork) {
			if (network["key_mgmt"] && network["key_mgmt"] == "NONE") {
				security = false;
			} else {
				security = true;
			}
			networks.push({ssid: network.ssid, security: security});
		}
	});
	return networks;
}

networkScanRound = 0;

function listAvailableNetworks(callback) {
	if (callback) {
		performWifiScan(function(err, networks) {
			if (err) {
				// Unsuccesful, return error.
				if (networkScanRound < 10) {
					setTimeout(function() {
						//console.log("Looking for networks ("+networkScanRound+")...");
						listAvailableNetworks(callback);
						networkScanRound++;
					}, 1000);
				} else {
					networkScanRound = 0;
					callback([], err);
				}
			} else if (networks) {
				// Succesful scan.
				if (networks.length > 0) {
					savedNetworks = listSavedNetworks();
					savedSSIDs = [];
					for (var i = 0; i < savedNetworks.length; i++) {
						savedSSIDs.push(savedNetworks[i].ssid);
					}
					availableNetworks = [];
					listedSSIDs = [];
					// Go through networks to remove duplicates and also indicate those that already seem to be configured.
					
					for (var i = 0; i < networks.length; i++) {
						if (networks[i].ssid != undefined) {
							networks[i].ssid = decodeURIComponent(escape(networks[i].ssid.decodeEscapeSequence()));
							if (listedSSIDs.indexOf(networks[i].ssid) == -1) {
								listedSSIDs.push(networks[i].ssid);
								if (savedSSIDs.indexOf(networks[i].ssid) == -1) {
									networks[i].added = false;
								} else {
									networks[i].added = true;
								}
								if (networks[i].security == "open") {
									networks[i].security = false;
								}
								availableNetworks.push(networks[i]);
							}
						}
					}
					callback(availableNetworks, false);
				} else {
					callback([], false);
				}
			}
		});
	}
}

function performWifiScan(callback) {
	iwlist.scan({
			iface: "wlan0",
			show_hidden: true
		}, function(err, networks) {
			if (err) {
				// Unsuccesful, return error.
				callback(err, []);
			} else if (networks) {
				// Succesful scan.
				callback(false, networks);
			}
	});
}


// ADD OR REMOVE NETWORKS

function addNetwork(options, update) {
	if (!options.ssid) return false;
	readWifiConfiguration();
	
	networkIndex = -1;
	for (var i = 0; i < wifiConfiguration.networks.length; i++) {
		if (wifiConfiguration.networks[i].ssid == options.ssid) {
			networkIndex = i;
		}
	}
	
	if (networkIndex == -1 || update) { // If the network doesn't exist, add it, otherwise update it (if the update flag has been set).
		if (networkIndex == -1) {
			updated = false;
			networkIndex = wifiConfiguration.networks.push({}) - 1;
		} else {
			updated = true;
		}
		
		wifiConfiguration.networks[networkIndex].ssid = options.ssid;
		
		if (options.password) {
			if (options.username) {
				// RADIUS network configuration here.
			} else {
				wifiConfiguration.networks[networkIndex].psk = options.password;
			}
			delete wifiConfiguration.networks[networkIndex].key_mgmt;
		} else {
			wifiConfiguration.networks[networkIndex].key_mgmt = "NONE";
			delete wifiConfiguration.networks[networkIndex].psk;
		}
		
		if (setupNetworkActive) wifiConfiguration.networks[networkIndex].disabled = 1;
		
		// Add in other options.
		for (option in options) {
			switch (option) {
				case "password":
				case "username":
				case "ssid":
					break;
				default:
					wifiConfiguration.networks[networkIndex][option] = options[option];
					break;
			}
		}
		
		saveWifiConfiguration(!setupNetworkActive);
		if (updated) {
			return 3;
		} else {
			return true;
		}
	} else {
		return 2; // This network exists and was not touched.
	}
}

function removeNetwork(ssid) {
	if (!ssid) return false;
	readWifiConfiguration();
	
	networkIndex = -1;
	for (var i = 0; i < wifiConfiguration.networks.length; i++) {
		if (wifiConfiguration.networks[i].ssid == ssid) {
			networkIndex = i;
		}
	}
	
	if (networkIndex != -1) {
		wifiConfiguration.networks.splice(networkIndex, 1);
		saveWifiConfiguration(!setupNetworkActive);
		return true;
	} else {
		return false;
	}
}

// MANAGE SETUP NETWORK

function setupNetwork(withName) {
	if (!externalSetupNetwork) {
		readWifiConfiguration();
		if (withName) { // Start setup network.
			for (var i = 0; i < wifiConfiguration.networks.length; i++) {
				wifiConfiguration.networks[i].disabled = 1; // Disable all other networks.
			}
			addNetwork({ssid: withName, key_mgmt: "NONE", proto: "RSN", pairwise: "CCMP", group: "CCMP", mode: 2, frequency: 2432, disabled: 0, setupNetwork: true}, true);
			setupNetworkName = withName;
			setupNetworkActive = true;
			
			
		} else { // Stop setup network.
			
			networkIndex = -1;
			for (var i = 0; i < wifiConfiguration.networks.length; i++) {
				if (wifiConfiguration.networks[i].setupNetwork) {
					networkIndex = i;
				} else {
					wifiConfiguration.networks[i].disabled = 0;
					// Enable all other networks.
				}
			}
			wifiConfiguration.networks.splice(networkIndex, 1);
			setupNetworkActive = false;
		}
		saveWifiConfiguration(true);
	}
}

function getSetupNetworkStatus() {
	return setupNetworkActive;
}

function setSetupNetworkStatus(status) {
	externalSetupNetwork = true;
	setupNetworkActive = status;
	readWifiConfiguration();
	if (status == true) {
		for (var i = 0; i < wifiConfiguration.networks.length; i++) {
			wifiConfiguration.networks[i].disabled = 1; // Disable all other networks.
		}
	} else { // Stop setup network.	
		for (var i = 0; i < wifiConfiguration.networks.length; i++) {
			wifiConfiguration.networks[i].disabled = 0; // Enable all networks
		}
	}
	saveWifiConfiguration(true);
}

function channelToFrequency(channel) {
	if (channel > 11) channel = 11; // Channels usable in all regions.
	return 2412 + (channel - 1) * 5; 
}

function reconfigure() {
	exec('wpa_cli -i wlan0 reconfigure', function(error, stdout, stderr){
	    if (error !== null) {
	        //callback(false);
	    } else {
			//callback(true);
		}
	});
}


// CONFIGURE STATIC IP OR DHCP

function configureIPAddress(options, forInterface, callback) {
	// If no options, automatic everything.
	config = readDHCPSettings(forInterface);
	hostsFile = fs.readFileSync("/etc/hosts", "utf8").split('\n');
	staticName = null;
	for (var i = 0; i < hostsFile.length; i++) {
		if (hostsFile[i].indexOf("127.0.1.1") != -1) {
			staticName = hostsFile[i].trim().split(/\s+/)[1];
		}
	}
	hostsLineToChange = null;
	if (dhcpConfig[forInterface].Network.Address) {
		for (var i = 0; i < hostsFile.length; i++) {
			if (hostsFile[i].indexOf(dhcpConfig[forInterface].Network.Address.split("/")[0]) != -1 &&
				hostsFile[i].indexOf(staticName) != -1) {
				hostsLineToChange = i;
				break;
			}
		}
	}
	if (config) {
		if (options &&
			options.address &&
			options.dns &&
			options.subnetmask &&
			options.router) {
			dhcpConfig[forInterface].Network = {
				Address: options.address+"/"+subnetmaskToCIDR(options.subnetmask),
				DNS: options.dns,
				Gateway: options.router
			};
			if (hostsLineToChange != null) {
				hostsFile[hostsLineToChange] = options.address+"\t"+staticName;
			} else {
				// Add new line.
				hostsFile.push(options.address+"\t"+staticName);
			}
		} else {
			dhcpConfig[forInterface].Network = {DHCP: "yes"};
			if (hostsLineToChange != null) {
				// Remove the static IP address from file.
				hostsFile.splice(hostsLineToChange, 1);
			} 
		}
		
		hostsText = hostsFile.join("\n");
		fs.writeFileSync("/etc/hosts", hostsText);
		
		writeDHCPSettings(forInterface);
		exec("systemctl restart systemd-networkd.service systemd-resolved.service", function(error, stdout, stderr) {
			if (error) {
				console.error("Restarting network services failed: "+error);
				if (callback) callback(false, error);
			} else {
				if (callback) callback(true);
			}
		});
	}
}


// CONFIGURATION R/W
// Enables the script to manipulate wpa_supplicant configuration as a JavaScript object.
function readWifiConfiguration() {
	modified = fs.statSync(wifiConfigPath).mtimeMs;
	if (modified != wifiConfigModified) { // Check if the config file has been modified since it was last accessed. Only read and parse if that's the case.
		wifiConfigModified = modified;
		wifiConfiguration = {networks: []};
		rawConfig = fs.readFileSync(wifiConfigPath, "utf8"); // Load raw config file
		configLines = rawConfig.split("\n"); // Remove whitespace and split into lines.
		currentNetworkEntry = -1;
		for (var i = 0; i < configLines.length; i++) {
			lineContents = configLines[i].trim().split("=");
			switch (lineContents[0]) {
				case "ctrl_interface":
					wifiConfiguration.ctrl_interface = lineContents.join("=");
					break;
				case "update_config":
					wifiConfiguration.update_config = lineContents[1];
					break;
				case "country":
					wifiConfiguration.country = lineContents[1];
					break;
				case "ap_scan":
					wifiConfiguration.ap_scan = lineContents[1];
					break;
				case "network":
					// Make a new network entry and increment current network entry index
					wifiConfiguration.networks.push({});
					currentNetworkEntry++;
					break;
				case "ssid":
					wifiConfiguration.networks[currentNetworkEntry].ssid = stringForJS(lineContents[1]);
					if (wifiConfiguration.networks[currentNetworkEntry].ssid.indexOf("Beocreate") != -1) {
						wifiConfiguration.networks[currentNetworkEntry].setupNetwork = true;
						setupNetworkActive = true;
					}
					break;
				case "disabled":
					if (wifiConfiguration.networks[currentNetworkEntry].setupNetwork) {
						if (lineContents[1] == 1) setupNetworkActive = false;
					}
					wifiConfiguration.networks[currentNetworkEntry].disabled = lineContents[1];
					break;
				case "mode":
					wifiConfiguration.networks[currentNetworkEntry].setupNetwork = true;
					wifiConfiguration.networks[currentNetworkEntry][lineContents[0]] = lineContents[1];
					break;
				case "psk":
					wifiConfiguration.networks[currentNetworkEntry].psk = stringForJS(lineContents[1]);
					break;
				default:
					if (lineContents[0].length > 1) {
						wifiConfiguration.networks[currentNetworkEntry][lineContents[0]] = lineContents[1];
					}
					break;
			}
		}
		// Filter out empty network entries:
		if (wifiConfiguration.networks) {
			wifiConfiguration.networks = wifiConfiguration.networks.filter(value => Object.keys(value).length !== 0);
		}
	} else {
		// console.log("Config has not been modified.");
	}
	return wifiConfiguration;
}
readWifiConfiguration();

function saveWifiConfiguration(reconfigure) {
	config = [];
	if (wifiConfiguration.ctrl_interface) config.push(wifiConfiguration.ctrl_interface);
	if (wifiConfiguration.update_config) config.push("update_config="+wifiConfiguration.update_config);
	if (wifiConfiguration.country) config.push("country="+wifiConfiguration.country);
	if (wifiConfiguration.ap_scan) config.push("ap_scan="+wifiConfiguration.ap_scan);
	config.push("\n");
	
	for (var i = 0; i < wifiConfiguration.networks.length; i++) {
		networkItem = "network={";
		for (property in wifiConfiguration.networks[i]) {
			switch (property) {
				case "ssid":
					networkItem += "\n\tssid="+stringForConfig(wifiConfiguration.networks[i].ssid);
					break;
				case "psk":
					networkItem += "\n\tpsk="+stringForConfig(wifiConfiguration.networks[i].psk, 64);
					break;
				case "disabled":
					if (wifiConfiguration.networks[i].disabled == 1) {
						networkItem += "\n\tdisabled=1";
					}
					break;
				case "setupNetwork":
					// Do nothing, this parameter is internal.
					break;
				default:
					networkItem += "\n\t"+property+"="+wifiConfiguration.networks[i][property];
					break;
			}
		}
		networkItem += "\n}\n";
		config.push(networkItem);
	}
	//return config.join("\n");
	fs.writeFileSync(wifiConfigPath, config.join("\n"));
	wifiConfigModified = fs.statSync(wifiConfigPath).mtimeMs; // Update the new modification time.
	if (reconfigure) {
		exec('wpa_cli -i wlan0 reconfigure', function(error, stdout, stderr){
		    if (error !== null) {
		        //callback(false);
		    } else {
				//callback(true);
			}
		});
	}
}

dhcpModified = {wifi: 0, ethernet: 0};
dhcpConfig = {wifi: {}, ethernet: {}};
function readDHCPSettings(forInterface) {
	path = null;
	if (forInterface == "wifi") path = "/etc/systemd/network/wireless.network";
	if (forInterface == "ethernet") path = "/etc/systemd/network/eth0.network";
	if (path) {
		if (fs.existsSync(path)) {
			modified = fs.statSync(path).mtimeMs;
			if (modified != dhcpModified[forInterface]) {
				// Reads configuration into a JavaScript object for easy access.
				dhcpModified[forInterface] = modified;
				dhcpConfig[forInterface] = {};
				dhcpConfigRaw = fs.readFileSync(path, "utf8").split('\n');
				section = null;
				for (var i = 0; i < dhcpConfigRaw.length; i++) {
					// Find settings sections.
					if (dhcpConfigRaw[i].indexOf("[") != -1 && dhcpConfigRaw[i].indexOf("]") != -1) {
						section = dhcpConfigRaw[i].trim().slice(1, -1);
						dhcpConfig[forInterface][section] = {};
					} else {
						if (section != null) {
							lineItems = dhcpConfigRaw[i].trim().split("=");
							if (lineItems.length == 2) {
								value = lineItems[1].trim();
								option = lineItems[0].trim();
								if (dhcpConfig[forInterface][section][option]) {
									// This option already exists, change it into an array or if it already is, just push the new value.
									if (typeof dhcpConfig[forInterface][section][option] == "object") {
										dhcpConfig[forInterface][section][option].push(value);
									} else {
										dhcpConfig[forInterface][section][option] = [dhcpConfig[forInterface][section][option]];
									}
								} else {
									dhcpConfig[forInterface][section][lineItems[0].trim()] = value;
								}
							}
						}
					}
				}
			}
			return dhcpConfig[forInterface];
		} else {
			console.error("File '"+path+"' does not exist.");
			return null;
		}
	} else {
		return null;
	}
}

function writeDHCPSettings(forInterface) {
	path = null;
	if (forInterface == "wifi") path = "/etc/systemd/network/wireless.network";
	if (forInterface == "ethernet") path = "/etc/systemd/network/eth0.network";
	if (path) {
		// Saves current configuration back into the file.
		if (fs.existsSync(path)) {
			config = [];
			for (section in dhcpConfig[forInterface]) {
				sectionStart = (config.length != 0) ? "\n["+section+"]" : "["+section+"]";
				config.push(sectionStart);
				for (option in dhcpConfig[forInterface][section]) {
					if (typeof dhcpConfig[forInterface][section][option] == "object") {
						// Iterate over the options of an array to add multiple lines of the same.
						for (var i = 0; i < dhcpConfig[forInterface][section][option].length; i++) {
							config.push(option+"="+dhcpConfig[forInterface][section][option][i]);
						}
					} else {
						config.push(option+"="+dhcpConfig[forInterface][section][option]);
					}
				}
			}
			//console.log(config.join("\n"));
			fs.writeFileSync(path, config.join("\n"));
			dhcpModified[forInterface] = fs.statSync(path).mtimeMs;
		}
	}
}

// Adapted from: https://stackoverflow.com/a/43694151
function subnetmaskToCIDR(netmask) {
	return (netmask.split('.').map(Number)
    	.map(part => (part >>> 0).toString(2))
		.join('')).split('1').length -1;
}

function CIDRToSubnetmask(bitCount) {
	var mask = [];
	for (var i = 0; i < 4; i++) {
		var n = Math.min(bitCount, 8);
		mask.push(256 - Math.pow(2, 8-n));
		bitCount -= n;
	}
	return mask.join('.');
}


function checkForInternet(callback) {
	exec('ping -c 1 1.1.1.1', function(error, stdout, stderr){
	    if (error !== null) {
	        callback(false);
	    } else {
			callback(true);
		}
	});
}

// CONFIGURATION R/W SUPPORT
// Sometimes data is hex-encoded in the configuration. These functions will decode and encode the data as needed.

function stringForConfig(text, exceptionLength) {
	// Encodes a string to hex if needed.
	// Check if removing non-ASCII characters changes the string. If so, provide the hex version.
	comparison = text.replace(/[^\x00-\x7F]/g, "");
	if (comparison == text) {
		if (exceptionLength == text.length) {
			return text; // If a PSK is stored as a 64 characters long hash, don't add quotes around it.
		} else {
			return "\""+text+"\"";
		}
	} else {
		return toHex(unescape(encodeURIComponent(text)));
	}
}

function stringForJS(raw) {
	// Decodes a hex string if needed.
	if (raw.charAt(0) == "\"") { // Non-hex strings can be identified by double quotes that surround them.
		return raw.slice(1,-1);
	} else {
		try {
			return decodeURIComponent(escape(fromHex(raw)));
		} catch (error) {
			return raw;
		}
		
	}
}

function fromHex(hex) { // https://jsfiddle.net/Guffa/uT2q5/
    var str = '';
    for (var i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

function toHex(str) { // https://stackoverflow.com/questions/21647928/javascript-unicode-string-to-hex
    var result = '';
    for (var i=0; i<str.length; i++) {
      result += str.charCodeAt(i).toString(16);
    }
    return result;
}

// Used to decode non-ASCII characters in SSIDs found with network scan.
String.prototype.decodeEscapeSequence = function() {
	return this.replace(/\\x([0-9A-Fa-f]{2})/g, function() {
		return String.fromCharCode(parseInt(arguments[1], 16));
	});
};
