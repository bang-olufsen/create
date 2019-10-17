var network = (function() {
	
	savedNetworks = [];
	availableNetworks = [];
	networkAssetPath = $("#network").attr("data-asset-path");
	connectedNetwork = null;
	selectedNetworkTab = "wifi";
	wifiScanning = false;
	
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
				notify(false, "applyingNetworkSettings");
			}
		}
		
	});
	
	
	$(document).on("network", function(event, data) {
		
		if (data.header == "networkHardware" && data.content.hardware) {
			if (!data.content.hardware.wifi || !data.content.hardware.ethernet) {
				// Either Wi-Fi or Ethernet is not available.
				$(".network-tabs").addClass("hidden");
				if (data.content.hardware.wifi) {
					showMenuTab("network-wireless");
				} else if (data.content.hardware.ethernet) {
					showMenuTab("network-wired");
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
					$(".saved-networks").append(createMenuItem(menuOptions));
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
						$(".available-networks").append(createMenuItem(menuOptions));
					}
				}
			} else {
				$(".available-networks-wrap").addClass("hidden");
			}
		}
		
		if (data.header == "networkAdded") {
			if (data.content.ssid) notify({title: data.content.ssid+" added", icon: "/common/symbols-black/checkmark-round.svg", id: "networkAdded"});
		}
		
		if (data.header == "networkUpdated") {
			if (data.content.ssid) notify({title: data.content.ssid+" updated", icon: "/common/symbols-black/checkmark-round.svg", id: "networkAdded"});
		}
		
		if (data.header == "networkExists") {
			if (data.content.ssid) notify({title: data.content.ssid+" already added", icon: "/common/symbols-black/notification.svg", id: "networkAdded"});
		}
		
		if (data.header == "networkRemoved") {
			if (data.content.ssid) notify({title: data.content.ssid+" removed", icon: "/common/symbols-black/checkmark-round.svg", id: "networkAdded"});
		}
		
		if (data.header == "wifiStatus") {
			if (data.content.status.ipv4) {
				if (data.content.status.ipv4.address) $(".wifi-ip").text(data.content.status.ipv4.address);
				if (data.content.status.ipv4.subnetmask) $(".wifi-subnetmask").text(data.content.status.ipv4.subnetmask);
			}
			
			if (data.content.status.connected) {
				$(".wifi-connected-ssid").text(data.content.status.ssid);
				setSymbol(".wifi-connected-signal", networkAssetPath+"/symbols-black/wifi-"+qualityToBars(data.content.status.quality)+".svg");
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
		
		if (data.header == "ethernetStatus") {
			if (data.content.status.ipv4) {
				if (data.content.status.ipv4.address) $(".ethernet-ip").text(data.content.status.ipv4.address);
				if (data.content.status.ipv4.subnetmask) $(".ethernet-subnetmask").text(data.content.status.ipv4.subnetmask);
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
			sendToProductView({header: "autoReconnect", content: {status: "networkConnect", systemID: product_information.systemID(), systemName: product_information.systemName()}});
			notify({title: "Applying network settings…", message: "Make sure your device is connected to the same network as the product.", icon: "attention", timeout: false, id: "applyingNetworkSettings"});
			noConnectionNotifications = true;
			maxConnectionAttempts = 20;
		}
		
		if (data.header == "connected") {
			if (noConnectionNotifications) {
				notify(false, "applyingNetworkSettings");
				noConnectionNotifications = false;
				maxConnectionAttempts = 5;
			}
		}
	});
	
	ipAddressSettings = false;
	function showIPAddressSettings(forInterface) {
		if (forInterface == "wifi") {
			showPopupView("ip-address-wifi-popup");
			ipAddressSettings = "wifi";
		} else if (forInterface == "ethernet") {
			ipAddressSettings = "ethernet";
			showPopupView("ip-address-ethernet-popup");
		} else {
			hidePopupView("ip-address-"+ipAddressSettings+"-popup");
			ipAddressSettings = false;
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
				ask("saved-network-secure-prompt", [savedNetworks[networkIndex].ssid, extraText]);
			} else {
				ask("saved-network-open-prompt", [savedNetworks[networkIndex].ssid, extraText]);
			}
		} else {
			selectedNetwork = availableNetworks[networkIndex];
			if (availableNetworks[networkIndex].security) {
				addNetwork();
			} else {
				// Show a prompt about adding an unsecured network.
				ask("add-open-network-prompt", [selectedNetwork.ssid]);
			}
		}
	}
	
	function showingWifiTab() {
		send({target: "network", header: "populateWifiUI"});
		if (!wifiScanning) $(".search-for-networks-button").removeClass("hidden");
		selectedNetworkTab = "wifi";
	}
	
	function showingEthernetTab() {
		send({target: "network", header: "populateEthernetUI"});
		$(".search-for-networks-button").addClass("hidden");
		selectedNetworkTab = "ethernet";
	}
	
	function refreshWifi() {
		send({target: "network", header: "scanWifi"});
	}
	
	
	function addNetwork(input) {
		if (!input || input == true) {
			if (input == true) {
				// Add an open network.
				send({target: "network", header: "addNetwork", content: {ssid: selectedNetwork.ssid, password: false}});
			} else {
				startTextInput(2, "Add "+selectedNetwork.ssid, "The network requires a "+selectedNetwork.security.toUpperCase()+" password.", {placeholders: {password: "Password"}, minLength: {password: 6}}, network.addNetwork);
			}
		} else {
			if (!input.text) input.text = false;
			send({target: "network", header: "addNetwork", content: {ssid: selectedNetwork.ssid, username: input.text, password: input.password}});
		}
	}
	
	function forgetNetwork(confirmed) {
		if (confirmed) {
			ask();
			send({target: "network", header: "forgetNetwork", content: {ssid: selectedNetwork.ssid}});
		} else {
			ask("forget-network-prompt", [selectedNetwork.ssid]);
		}
	}
	
	function updatePassword(input) {
		if (!input) {
			ask();
			startTextInput(2, "Update Password", "If the password for "+selectedNetwork.ssid+" has changed, type the new password.", {placeholders: {password: "Password"}, minLength: {password: 6}}, network.updatePassword);
		} else {
			send({target: "network", header: "addNetwork", content: {ssid: selectedNetwork.ssid, password: input.password, update: true}});
		}
	}
	
	function addOtherNetwork(input) {
		if (!input) {
			startTextInput(3, "Add Other Network", "Type the name of the network to add. If the network has no password, leave it blank.", {placeholders: {password: "Password", text: "Network name"}, minLength: {text: 1, password: 6}, optional: {password: true}}, addOtherNetwork);
		} else {
			if (!input.password) input.password = false;
			send({target: "network", header: "addNetwork", content: {ssid: input.text, password: input.password}});
		}
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
	
	return {
		showingWifiTab: showingWifiTab,
		showingEthernetTab: showingEthernetTab,
		refreshWifi: refreshWifi,
		addOtherNetwork: addOtherNetwork,
		addNetwork: addNetwork,
		forgetNetwork: forgetNetwork,
		showNetworkOptions: showNetworkOptions,
		updatePassword: updatePassword,
		showIPAddressSettings: showIPAddressSettings
	};

})();