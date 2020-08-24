var network = (function() {
	
savedNetworks = [];
availableNetworks = [];
networkAssetPath = extensions.network.assetPath;
connectedNetwork = null;
selectedNetworkTab = "wifi";
wifiScanning = false;
networkStatus = {wifi: {}, ethernet: {}};

$(document).on("general", function(event, data) {
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "network") {
			if (selectedNetworkTab == "wifi") {
				showingWifiTab();
			}
			if (selectedNetworkTab == "ethernet") {
				showingEthernetTab();
			}
		}
	}
	
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			beo.notify(false, "applyingNetworkSettings");
		}
	}
	
});


$(document).on("network", function(event, data) {
	
	if (data.header == "networkHardware" && data.content.hardware) {
		if (!data.content.hardware.wifi || !data.content.hardware.ethernet) {
			// Either Wi-Fi or Ethernet is not available.
			$(".network-tabs").addClass("hidden");
			if (data.content.hardware.wifi) {
				beo.showMenuTab("network-wireless");
			} else if (data.content.hardware.ethernet) {
				beo.showMenuTab("network-wired");
			} else {
				// Probably either of them is available.
			}
		} else {
			// Both are available.
			$(".network-tabs").removeClass("hidden");
		}
	}

	if (data.header == "savedNetworks") {
		
		savedNetworks = data.content.networks;
		if (savedNetworks.length > 0) {
			$(".saved-networks-wrap").removeClass("hidden");
			$(".saved-networks").empty();
			for (var i = 0; i < savedNetworks.length; i++) {
				if (connectedNetwork == savedNetworks[i].ssid) {
					if (savedNetworks[i].security) {
						$(".wifi-connected-lock").removeClass("hidden");
					} else {
						$(".wifi-connected-lock").addClass("hidden");
					}
					$(".wifi-connected-item").attr("onclick", "network.showNetworkOptions("+i+", true, true);");
				}
				menuOptions = {
					label: savedNetworks[i].ssid,
					onclick: "network.showNetworkOptions("+i+", true);",
					classes: ["saved-network-item-"+i],
					icon: networkAssetPath+"/symbols-black/wifi.svg"
				}
				if (savedNetworks[i].security) menuOptions.iconRight = networkAssetPath+"/symbols-black/lock.svg";
				$(".saved-networks").append(beo.createMenuItem(menuOptions));
			}
		} else {
			$(".saved-networks-wrap").addClass("hidden");
		}
	}
	
	if (data.header == "scanning") {
		
		$(".wifi-scanning").removeClass("hidden");
		$(".search-for-networks-button").addClass("hidden");
		wifiScanning = true;
	}
	
	if (data.header == "availableNetworks") {
		
		availableNetworks = data.content.networks;
		wifiScanning = false;
		$(".wifi-scanning").addClass("hidden");
		if (selectedNetworkTab == "wifi") $(".search-for-networks-button").removeClass("hidden");
		if (availableNetworks.length > 0) {
			$(".available-networks-wrap").removeClass("hidden");
			$(".available-networks").empty();
			for (var i = 0; i < availableNetworks.length; i++) {
				if (availableNetworks[i].ssid != connectedNetwork) {
					if (availableNetworks[i].added) {
						for (var s = 0; s < savedNetworks.length; s++) {
							if (savedNetworks[s].ssid == availableNetworks[i].ssid) break;
						}
						action = "network.showNetworkOptions("+s+", true);"
						value = "Saved";
					} else {
						action = "network.showNetworkOptions("+i+");";
						value = "";
					}
					menuOptions = {
						label: availableNetworks[i].ssid,
						value: value,
						onclick: action,
						classes: ["saved-network-item-"+i],
						icon: networkAssetPath+"/symbols-black/wifi-"+qualityToBars(availableNetworks[i].quality)+".svg"
					}
					if (availableNetworks[i].security) menuOptions.iconRight = networkAssetPath+"/symbols-black/lock.svg";
					$(".available-networks").append(beo.createMenuItem(menuOptions));
				}
			}
		} else {
			$(".available-networks-wrap").addClass("hidden");
		}
	}
	
	if (data.header == "networkAdded") {
		if (data.content.ssid) beo.notify({title: data.content.ssid+" added", icon: "/common/symbols-black/checkmark-round.svg", id: "networkAdded"});
	}
	
	if (data.header == "networkUpdated") {
		if (data.content.ssid) beo.notify({title: data.content.ssid+" updated", icon: "/common/symbols-black/checkmark-round.svg", id: "networkAdded"});
	}
	
	if (data.header == "networkExists") {
		if (data.content.ssid) beo.notify({title: data.content.ssid+" already added", icon: "/common/symbols-black/notification.svg", id: "networkAdded"});
	}
	
	if (data.header == "networkRemoved") {
		if (data.content.ssid) beo.notify({title: data.content.ssid+" removed", icon: "/common/symbols-black/checkmark-round.svg", id: "networkAdded"});
	}
	
	if (data.header == "wifiStatus") {
		
		networkStatus.wifi = data.content.status;
		
		if (networkStatus.wifi.up) {
			$(".wifi-on-wrap").removeClass("hidden");
			$(".wifi-toggle").addClass("on");
			$(".wifi-off-hr").addClass("hidden");
		} else {
			$(".wifi-on-wrap").addClass("hidden");
			$(".wifi-toggle").removeClass("on");
			$(".wifi-off-hr").removeClass("hidden");
		}
		
		$(".wifi-ip").text("No address");
		if (data.content.status.ipv4) {
			if (data.content.status.ipv4.address) $(".wifi-ip").text(data.content.status.ipv4.address);
		}
		
		
		if (data.content.status.connected) {
			$(".wifi-connected-ssid").text(data.content.status.ssid);
			beo.setSymbol(".wifi-connected-signal", networkAssetPath+"/symbols-black/wifi-"+qualityToBars(data.content.status.quality)+".svg");
			$(".wifi-connected-wrap").removeClass("hidden");
			connectedNetwork = data.content.status.ssid;
		} else {
			$(".wifi-connected-wrap").addClass("hidden");
			connectedNetwork = null;
		}
		for (var i = 0; i < savedNetworks.length; i++) {
			if (connectedNetwork == savedNetworks[i].ssid) {
				if (savedNetworks[i].security) {
					$(".wifi-connected-lock").removeClass("hidden");
				} else {
					$(".wifi-connected-lock").addClass("hidden");
				}
				$(".wifi-connected-item").attr("onclick", "network.showNetworkOptions("+i+", true, true);");
			}
		}
		
	}
	
	if (data.header == "wirelessToggle") {
		if (data.content.enabled) {
			$(".wifi-toggle").addClass("on");
		} else {
			$(".available-networks-wrap").addClass("hidden");
			$(".wifi-connected-wrap").addClass("hidden");
			$(".wifi-on-wrap").addClass("hidden");
			$(".wifi-off-hr").removeClass("hidden");
			$(".wifi-toggle").removeClass("on");
			networkStatus.wifi.up = false;
		}
	}
	
	if (data.header == "ethernetStatus") {
		networkStatus.ethernet = data.content.status;
		
		$(".ethernet-ip").text("No address");
		if (data.content.status.ipv4) {
			if (data.content.status.ipv4.address) $(".ethernet-ip").text(data.content.status.ipv4.address);
		}
		
		
		if (data.content.status.connected) {
			if (data.content.testNoEthernet) {
				$(".ethernet-status").text("Connected but ignored");
				$(".ethernet-status.ball").addClass("fill");
			} else {
				$(".ethernet-status").text("Connected");
				$(".ethernet-status.ball").addClass("fill");
			}
		} else {
			$(".ethernet-status").text("Cable unplugged");
			$(".ethernet-status.ball").removeClass("fill");
		}
	}
	
	if (data.header == "exitingHotspot") {
		// When the product applies new network settings, the connection will be temporarily lost. Inform Beocreate app of this so that it knows to auto-reconnect.
		beo.sendToProductView({header: "autoReconnect", content: {status: "networkConnect", systemID: product_information.systemID(), systemName: product_information.systemName()}});
		beo.notify({title: "Applying network settings…", message: "Make sure your "+os[1]+" is connected to the same network as the product.", icon: "attention", timeout: false, id: "applyingNetworkSettings"});
		noConnectionNotifications = true;
		maxConnectionAttempts = 20;
	}
	
	if (data.header == "connected") {
		if (noConnectionNotifications) {
			beo.notify(false, "applyingNetworkSettings");
			noConnectionNotifications = false;
			maxConnectionAttempts = 5;
		}
	}
});

selectedInterface = false;
function showIPAddressSettings(forInterface) {
	if (forInterface) {
		if (forInterface == "wifi") {
			selectedInterface = "wifi";
			$(".ip-address-popup header h1").text("Wireless IP Address");
		} else if (forInterface == "ethernet") {
			selectedInterface = "ethernet";
			$(".ip-address-popup header h1").text("Ethernet IP Address");
		}
		// Load current settings into view.
		ipSettingsChanged = false;
		if (networkStatus[selectedInterface].ipSetup.auto) {
			manualIPSettingsStore[selectedInterface].address = null;
			manualIPSettingsStore[selectedInterface].router = null;
			manualIPSettingsStore[selectedInterface].subnetmask = null;
			manualIPSettingsStore[selectedInterface].dns = null;
		} else {
			manualIPSettingsStore[selectedInterface].address = networkStatus[selectedInterface].ipSetup.address;
			manualIPSettingsStore[selectedInterface].router = networkStatus[selectedInterface].ipSetup.router;
			manualIPSettingsStore[selectedInterface].subnetmask = networkStatus[selectedInterface].ipSetup.subnetmask;
			manualIPSettingsStore[selectedInterface].dns = networkStatus[selectedInterface].ipSetup.dns;
		}
		setIPAddressMode();
		beo.showPopupView("ip-address-popup");
	} else {
		beo.hidePopupView("ip-address-popup");
		selectedInterface = false;
	}
}

manualIPSettingsStore = {wifi: {
	address: null,
	subnetmask: null,
	dns: null,
	router: null
}, ethernet: {
	address: null,
	subnetmask: null,
	dns: null,
	router: null
}};
autoIPAddressSelected = true;
ipSettingsChanged = false;

function setIPAddressMode(automatic) {
	if (automatic == undefined) {
		automatic = (networkStatus[selectedInterface].ipSetup.auto == true) ? true : false;
		updateOnly = true;
	} else {
		updateOnly = false;
	}
	$(".ip-address-mode-selector div").removeClass("selected");
	$(".ip-address-section").addClass("hidden");
	if (automatic) {
		$(".auto-ip-section").removeClass("hidden");
		$(".ip-address-mode-selector .auto").addClass("selected");
		
		$(".ip-automatic").text("No address");
		$(".subnetmask-automatic").text("–");
		if (networkStatus[selectedInterface].ipv4) {
			if (networkStatus[selectedInterface].ipv4.address) $(".ip-automatic").text(networkStatus[selectedInterface].ipv4.address);
			if (networkStatus[selectedInterface].ipv4.subnetmask) $(".subnetmask-automatic").text(networkStatus[selectedInterface].ipv4.subnetmask);
		}
		if (networkStatus[selectedInterface].ipSetup.auto == true) {
			$(".apply-ip-settings-button").addClass("disabled");
		} else {
			$(".apply-ip-settings-button").removeClass("disabled");
		}
		autoIPAddressSelected = true;
	} else {
		$(".manual-ip-section").removeClass("hidden");
		$(".ip-address-mode-selector .manual").addClass("selected");
		if (networkStatus[selectedInterface].ipSetup.auto != true && 
			!ipSettingsChanged) {
			$(".apply-ip-settings-button").addClass("disabled");
		} else if (manualIPSettingsStore[selectedInterface].address &&
					manualIPSettingsStore[selectedInterface].subnetmask &&
					manualIPSettingsStore[selectedInterface].router &&
					manualIPSettingsStore[selectedInterface].dns &&
					ipSettingsChanged) {
			$(".apply-ip-settings-button").removeClass("disabled");
		} else {
			$(".apply-ip-settings-button").addClass("disabled");
		}
		if (manualIPSettingsStore[selectedInterface].address) {
			$(".ip-manual").removeClass("button").text(manualIPSettingsStore[selectedInterface].address);
		} else {
			$(".ip-manual").addClass("button").text("Set...");
		}
		if (manualIPSettingsStore[selectedInterface].subnetmask) {
			$(".subnetmask-manual").removeClass("button").text(manualIPSettingsStore[selectedInterface].subnetmask);
		} else {
			$(".subnetmask-manual").addClass("button").text("Set...");
		}
		if (manualIPSettingsStore[selectedInterface].router) {
			$(".router-manual").removeClass("button").text(manualIPSettingsStore[selectedInterface].router);
		} else {
			$(".router-manual").addClass("button").text("Set...");
		}
		if (manualIPSettingsStore[selectedInterface].dns) {
			dns = manualIPSettingsStore[selectedInterface].dns;
			if (typeof dns == "object") {
				dns = dns.join(", ");
			}
			$(".dns-manual").removeClass("button").text(dns);
		} else {
			$(".dns-manual").addClass("button").text("Set...");
		}
		autoIPAddressSelected = false;
	}
}

function inputIPAddressSetting(setting) {
	switch (setting) {
		case "address":
			title = "IP Address";
			placeholder = "10.0...";
			if (manualIPSettingsStore[selectedInterface].address) {
				text = manualIPSettingsStore[selectedInterface].address;
			} else if (manualIPSettingsStore[selectedInterface].router) {
				textItems = manualIPSettingsStore[selectedInterface].router.split(".");
				textItems.splice(3, 1);
				text = textItems.join(".")+".";
			} else {
				text = null;
			}
			message = "Enter IPv4 address for the product.";
			break;
		case "subnetmask":
			title = "Subnet Mask";
			placeholder = "255.255.255.0";
			if (manualIPSettingsStore[selectedInterface].subnetmask) {
				text = manualIPSettingsStore[selectedInterface].subnetmask;
			} else {
				text = "255.255.255.0";
			}
			message = "Enter subnet mask.";
			break;
		case "router":
			title = "Router Address";
			placeholder = "10.0...";
			if (manualIPSettingsStore[selectedInterface].router) {
				text = manualIPSettingsStore[selectedInterface].router;
			} else if (manualIPSettingsStore[selectedInterface].address) {
				textItems = manualIPSettingsStore[selectedInterface].address.split(".");
				textItems[3] = "1";
				text = textItems.join(".");
			} else {
				text = null;
			}
			message = "Enter IPv4 address of the router or gateway the product connects to.";
			break;
		case "dns":
			title = "DNS Servers";
			placeholder = "9.9.9.9, 1.1.1.1";
			if (manualIPSettingsStore[selectedInterface].dns) {
				dns = manualIPSettingsStore[selectedInterface].dns;
			} else {
				dns = "9.9.9.9, 1.1.1.1";
			}
			if (typeof dns == "object" && dns != null) {
				dns = dns.join(", ");
			}
			text = dns;
			message = "Enter DNS server addresses. You can enter multiple servers separated by a comma.";
			break;
	}
	beo.startTextInput(1, title, message, {text: text, placeholders: {text: placeholder}}, function(input) {
		// Validate and store input.
		if (input) {
			switch (setting) {
				case "address":
					if (isValidIP(input.text)) {
						manualIPSettingsStore[selectedInterface].address = input.text;
						if (!manualIPSettingsStore[selectedInterface].router) {
							textItems = input.text.split(".");
							textItems[3] = "1";
							router = textItems.join(".");
							manualIPSettingsStore[selectedInterface].router = router;
						}
						if (!manualIPSettingsStore[selectedInterface].subnetmask) {
							manualIPSettingsStore[selectedInterface].subnetmask = "255.255.255.0";
						}
						if (!manualIPSettingsStore[selectedInterface].dns) {
							manualIPSettingsStore[selectedInterface].dns = ["9.9.9.9", "1.1.1.1"];
						}
						ipSettingsChanged = true;
						setIPAddressMode(false);
					} else {
						beo.notify({title: "IP address is not valid", message: "The address must contain four numbers separated by periods.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
					}
					break;
				case "subnetmask":
					if (isValidIP(input.text)) {
						manualIPSettingsStore[selectedInterface].subnetmask = input.text;
						ipSettingsChanged = true;
						setIPAddressMode(false);
					} else {
						beo.notify({title: "Subnet mask is not valid", message: "Subnet mask must contain four numbers separated by periods.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
					}
					break;
				case "router":
					if (isValidIP(input.text)) {
						manualIPSettingsStore[selectedInterface].router = input.text;
						ipSettingsChanged = true;
						setIPAddressMode(false);
					} else {
						beo.notify({title: "IP address is not valid", message: "The address must contain four numbers separated by periods.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
					}
					break;
				case "dns":
					dnsItems = input.text.split(",");
					validDNS = true;
					for (var i = 0; i < dnsItems.length; i++) {
						dnsItems[i] = dnsItems[i].trim();
						if (!isValidIP(dnsItems[i])) validDNS = false;
					}
					if (validDNS) {
						manualIPSettingsStore[selectedInterface].dns = dnsItems;
						ipSettingsChanged = true;
						setIPAddressMode(false);
					} else {
						beo.notify({title: "DNS server address is not valid", message: "The addresses must contain four numbers separated by periods.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
					}
					break;
			}
		}
	});
}

function isValidIP(address) {
	ipItems = address.split(".");
	validIP = true;
	if (ipItems.length == 4) {
		// Length matches.
		for (var i = 0; i < ipItems.length; i++) {
			if (isNaN(ipItems[i])) validIP = false;
		}
	} else {
		validIP = false;
	}
	return validIP;
}

function applyIPSettings(confirmed) {
	if (confirmed) {
		beo.ask();
		beo.send({target: "network", header: "applyIPSettings", content: {forInterface: selectedInterface, automatic: autoIPAddressSelected, settings: manualIPSettingsStore[selectedInterface]}});
		showIPAddressSettings();
	} else {
		beo.ask("apply-ip-settings-prompt");
	}
}


selectedNetwork = null;
function showNetworkOptions(networkIndex, saved, connected) {
	if (saved) {
		selectedNetwork = savedNetworks[networkIndex];
		if (connected) {
			extraText = "These options will disconnect the product from the network. If no other saved networks are available, the setup network will be created for making settings.";
		} else {
			extraText = "";
		}
		if (savedNetworks[networkIndex].security) {
			beo.ask("saved-network-secure-prompt", [savedNetworks[networkIndex].ssid, extraText]);
		} else {
			beo.ask("saved-network-open-prompt", [savedNetworks[networkIndex].ssid, extraText]);
		}
	} else {
		selectedNetwork = availableNetworks[networkIndex];
		if (availableNetworks[networkIndex].security) {
			addNetwork();
		} else {
			// Show a prompt about adding an unsecured network.
			beo.ask("add-open-network-prompt", [selectedNetwork.ssid]);
		}
	}
}

function showingWifiTab() {
	beo.send({target: "network", header: "populateWifiUI"});
	if (!wifiScanning) $(".search-for-networks-button").removeClass("hidden");
	selectedNetworkTab = "wifi";
}

function showingEthernetTab() {
	beo.send({target: "network", header: "populateEthernetUI"});
	$(".search-for-networks-button").addClass("hidden");
	selectedNetworkTab = "ethernet";
}

function refreshWifi() {
	beo.sendToProduct("network", "scanWifi");
}

function toggleWireless(confirmed) {
	if (networkStatus.wifi.up) {
		if (confirmed) {
			beo.ask();
			beo.sendToProduct("network", "toggleWireless", {enabled: false});
		} else {
			beo.ask("turn-off-wifi-prompt");
		}
	} else {
		beo.sendToProduct("network", "toggleWireless", {enabled: true});
	}
}


function addNetwork(open) {
	if (open) {
		// Add an open network.
		beo.send({target: "network", header: "addNetwork", content: {ssid: selectedNetwork.ssid, password: false}});
	} else {
		beo.startTextInput(2, "Add "+selectedNetwork.ssid, "The network requires a "+selectedNetwork.security.toUpperCase()+" password.", {placeholders: {password: "Password"}, minLength: {password: 6}}, function(input) {
			if (input) {
				if (!input.text) input.text = false;
				beo.send({target: "network", header: "addNetwork", content: {ssid: selectedNetwork.ssid, username: input.text, password: input.password}});
			}
		});
	}
}

function forgetNetwork(confirmed) {
	if (confirmed) {
		beo.ask();
		beo.send({target: "network", header: "forgetNetwork", content: {ssid: selectedNetwork.ssid}});
	} else {
		beo.ask("forget-network-prompt", [selectedNetwork.ssid]);
	}
}

function updatePassword() {
	
	beo.ask();
	beo.startTextInput(2, "Update Password", "If the password for "+selectedNetwork.ssid+" has changed, type the new password.", {placeholders: {password: "Password"}, minLength: {password: 6}}, function(input) {
		if (input) {
			beo.send({target: "network", header: "addNetwork", content: {ssid: selectedNetwork.ssid, password: input.password, update: true}});
		}
	});
}

function addOtherNetwork() {
	
	beo.startTextInput(3, "Add Other Network", "Type the name of the network to add. If the network has no password, leave it blank.", {placeholders: {password: "Password", text: "Network name"}, minLength: {text: 1, password: 6}, optional: {password: true}}, function(input) {
		if (input) {
			if (!input.password) input.password = false;
			beo.send({target: "network", header: "addNetwork", content: {ssid: input.text, password: input.password}});
		}
	});
}

function qualityToBars(quality) {
	// Determine signal strength icon
	if (quality > 60) {
		signalIcon = 3;
	} else if (quality > 40) {
		signalIcon = 2;
	} else if (quality > 30) {
		signalIcon = 1;
	} else {
		signalIcon = 0;
	}
	return signalIcon;
}
	
interactDictionary = {
	actions: {
		startSetupNetwork: {
			name: "Start Setup Network",
			icon: "extensions/network/symbols-black/wifi-3.svg"
		}
	}
}

	
return {
	showingWifiTab: showingWifiTab,
	showingEthernetTab: showingEthernetTab,
	toggleWireless: toggleWireless,
	refreshWifi: refreshWifi,
	addOtherNetwork: addOtherNetwork,
	addNetwork: addNetwork,
	forgetNetwork: forgetNetwork,
	showNetworkOptions: showNetworkOptions,
	updatePassword: updatePassword,
	showIPAddressSettings: showIPAddressSettings,
	setIPAddressMode: setIPAddressMode,
	inputIPAddressSetting: inputIPAddressSetting,
	applyIPSettings: applyIPSettings,
	interactDictionary: interactDictionary
};

})();