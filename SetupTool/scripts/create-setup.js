// BANG & OLUFSEN
// BeoCreate 4-Channel Amplifier Setup
// Release 3

var os;
var screenFlow = ["welcome", "setup-start", "setup-wifi", "setup-profile", "setup-name", "setup-finish", "overview", "sound-adjustments", "name", "wifi", "profile", "custom-tuning", "guide", "sources", "ssh", "connect-to", "software-update", "about"]; // Indicates where different screens exist spatially within the application.
var sourceNames = {"bluetooth": "Bluetooth", "shairport-sync": "Shairport-sync", "spotifyd": "Spotifyd"};
window.addEventListener('load', function() {
	
	// Enables fastclick.js so that buttons respond immediately.
	new FastClick(document.body);
	
	os = getOS();
	$(".device").text(os[1]); // Change strings and instructions in the UI to refer to the correct platform.
	$(".device-specific").addClass("hidden");
	$(".device-specific."+os[0]).removeClass("hidden");
	
	if (localStorage.beoCreateSavedProducts) {
		savedProducts = JSON.parse(localStorage.beoCreateSavedProducts);
	}
	if (localStorage.beoCreateSelectedProductIndex) {
		if (localStorage.beoCreateSelectedProductIndex == "undefined") {
			selectedProductIndex = null;
		} else {
			selectedProductIndex = JSON.parse(localStorage.beoCreateSelectedProductIndex);
		}
	}
	updateProductList();
	selectProduct(selectedProductIndex, true);
	
	if (localStorage.beoCreateSoundProfiles) {
		soundProfiles = JSON.parse(localStorage.beoCreateSoundProfiles);
	}
	$.getJSON("profiles.json", function( json ) {
		console.log(json);
  		soundProfiles = json;
		localStorage.beoCreateSoundProfiles = JSON.stringify(json);
 	});
 	
 	if (window.applicationCache) {
	    applicationCache.addEventListener('updateready', function() {
	    	localStorage.beoCreateToolUpdated = 1;
	    	window.location.reload();
	    });
	}
	
	if (localStorage.beoCreateToolUpdated == 1) {
		localStorage.beoCreateToolUpdated = 0;
		notify("Setup Tool updated", "", "done");
	}
	
	connectProduct();
	
}, false);


// Detect platform to tailor instructions.
// https://stackoverflow.com/questions/38241480/detect-macos-ios-windows-android-and-linux-os-with-js
// (modified to return a human-readable string that will be used in the UI)
function getOS() {
	var userAgent = window.navigator.userAgent,
		platform = window.navigator.platform,
		macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
		windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
		iosPlatforms = ['iPhone', 'iPad', 'iPod'],
		os = null;
		osUI = "";
	if (macosPlatforms.indexOf(platform) !== -1) {
		os = 'macos';
		osUI = "Mac";
	} else if (iosPlatforms.indexOf(platform) !== -1) {
		os = 'ios';
		osUI = platform;
	} else if (windowsPlatforms.indexOf(platform) !== -1) {
		os = 'windows';
		osUI = "Windows device";
	} else if (/Android/.test(userAgent)) {
		os = 'android';
		osUI = "Android device";
	} else {
		os = 'other';
		osUI = "device"
	}

  return [os, osUI];
}

var currentScreen = "welcome";
var previousScreen = null;
function transitionToScreen(screen) {
	if (!screen) screen = previousScreen;
	if (screen != currentScreen) {
		previousScreen = currentScreen;
		currentScreen = screen;

		psIndex = screenFlow.indexOf(previousScreen);
		nsIndex = screenFlow.indexOf(currentScreen);

		direction = "right";
		if (psIndex < nsIndex) {
			direction = "left";
		}
		$("#"+previousScreen).addClass(direction).removeClass("visible");
		$("#"+currentScreen).addClass("block");
		setTimeout(function() {
			$("#"+currentScreen).removeClass("left right").addClass("visible");
		}, 20);
		setTimeout(function() {
			$("#"+previousScreen).removeClass("block");
		}, 520);
	}
	switch (screen) { // Special actions to run when transitioning to a screen.
		case "wifi":
			wifiScanTriedAgain = true;
			sendToProduct({header: "wifi", content: {operation: "listAvailable"}});
			sendToProduct({header: "wifi", content: {operation: "status"}});
			sendToProduct({header: "wifi", content: {operation: "listSaved"}});
			if (wifiMode == "hotspot") {
				$("#multi-button").removeClass("load hidden disabled");
				$("#multi-button span").text("Finish Wi-Fi Setup");
				multiButtonFunction = "finishWifi";
			}
			break;
		case "profile":
			listSoundProfiles();
			break;
		case "custom-tuning":
			sendToProduct({header: "wifi", content: {operation: "ip"}});
			//sendToProduct({header: "soundProfile", content: {operation: "enableCustom"}});
			break;
		case "ssh":
			sendToProduct({header: "wifi", content: {operation: "ip"}});
			sendToProduct({header: "setup", content: {operation: "ssh", type: "get"}});
			break;
		case "sources":
			sendToProduct({header: "sources", content: {operation: "list"}});
			break;
		case "software-update":
			sendToProduct({header: "softwareUpdate", content: {operation: "check"}});
			notify("Checking for update...", "", "load", true);
			break;
	}
	
	if (screen == "overview") {
		switch (previousScreen) {
			case "name":
				if ($("#text-input-system-name-2").val()) {
					saveSystemName();
					notify("Restarting sound system...", "This will take a moment, please wait", "load", true);
				}
			case "profile":
				//sendToProduct({header: "soundProfile", content: {operation: "flashProfile"}});
				break;
		}
	}
	
}

function setupMethod(method) {
	$(".pibakery-install-guide, .image-install-guide").addClass("hidden");
	$(".setup-guide-intro").removeClass("hidden");
	if (method == "pibakery") {
		$(".pibakery-install-guide").removeClass("hidden");
		$(".setup-guide-intro").addClass("hidden");
	}
	if (method == "image") {
		$(".image-install-guide").removeClass("hidden");
		$(".setup-guide-intro").addClass("hidden");
	}
}


// SOCKET COMMUNICATION

var blankProductHostname = "beocreate-4ch-blank";
var productHotspotIP = "169.254.14.197";
var triedHotspotIP = false;
var productHostname = null;
var savedProducts = [];
var selectedProductIndex = null;
var productAutoCycle = 0;
var connected = false;
var reconnectTimeout = null;
var connectTimeout = null;
var reconnect = false;
var socket;

// The app will attempt to connect to saved products in sequence. If it cannot reach a product, it will try the next one. After the list of saved products has been exhausted, it will try to connect to a "known blank board". It will repeat this until a product is found.

function updateProductList(selected) {
	$(".saved-products-list").empty();
	if (savedProducts.length > 0) {
		$("#later-previous-setup").removeClass("hidden");
		$("#initial-previous-setup").addClass("hidden");
		
		for (var i = 0; i < savedProducts.length; i++) {
			icon = "symbols-thin-black/volume.svg";
			//if (savedProducts[i].model) icon = 'speakers/'+savedProducts[i].model+'.png';
			$(".saved-products-list").append('<div class="saved-product-item saved-product-item-' + i + ' menu-item icon left radio" onclick="productClick('+i+');"><img class="menu-icon" src="'+icon+'"><div class="menu-label">' + savedProducts[i].name + '</div><img class="menu-icon right checkmark" src="symbols-thin-black/checkmark.svg"></div>');
		}
		$(".saved-product-item").removeClass("selected");
		if (typeof selected != "undefined") {
			$(".saved-product-item-"+selected).addClass("selected");
		} else if (typeof selectedProductIndex != "undefined") {
			$(".saved-product-item-"+selectedProductIndex).addClass("selected");
		}
	} else {
		$("#later-previous-setup").addClass("hidden");
		$("#initial-previous-setup").removeClass("hidden");
	}
}

function addOrUpdateProduct(hostname, details, update, connectNow) {
	// Check if a product with the same hostname exists
	console.log("addOrUpdateProduct() called with hostname: "+hostname);
	existingProduct = null;
	for (var i = 0; i < savedProducts.length; i++) {
		if (savedProducts[i].hostname == hostname) {
			existingProduct = i;
		}
	}
	if (existingProduct != null) {
		if (update) { // Product exists, but will be updated with new details.
			if (details.name) {
				savedProducts[existingProduct].name = details.name;
			}
			if (details.newHostname) {
				savedProducts[existingProduct].hostname = details.newHostname;
				productHostname = details.newHostname;
			}
			if (details.pin) {
				savedProducts[existingProduct].pin = details.pin;
			}
			if (details.model) {
				$(".product-model").text("");
				if (soundProfiles) {
					for (var i = 0; i < soundProfiles.models.length; i++) {
						if (soundProfiles.models[i].file == details.model) {
							$(".product-model").text(soundProfiles.models[i].name);
						}
					}
				}
			}
			localStorage.beoCreateSavedProducts = JSON.stringify(savedProducts);
			updateProductList(existingProduct);
			result = existingProduct;
		} else {
			// Product exists, return null.
			result = null;	
		}
	} else {
		// Add a new product.
		productCount = savedProducts.push({hostname: hostname});
		if (details.name) {
			savedProducts[productCount-1].name = details.name;
		}
		if (details.model) {
			savedProducts[productCount-1].model = details.model;
		}
		localStorage.beoCreateSavedProducts = JSON.stringify(savedProducts);
		updateProductList();
		selectProduct(productCount-1);
		if (connectNow) connectProduct(true);
		result = productCount-1;
	}
	return result;
}

function removeProduct(index) {
	if (index < selectedProductIndex) selectedProductIndex--;
	console.log(selectedProductIndex);
	savedProducts.splice(index, 1);
	localStorage.beoCreateSavedProducts = JSON.stringify(savedProducts);
	if (savedProducts.length == 0) selectedProductIndex = null;
	localStorage.beoCreateSelectedProductIndex = selectedProductIndex;
	updateProductList();
	toggleProductDeleteMode(false);
	return true;
}

productDeleteMode = false;
function toggleProductDeleteMode(force) {
	if (force == true) productDeleteMode = false;
	if (force == false) productDeleteMode = true;
	if (productDeleteMode == false) {
		$(".product-delete-mode-hide").addClass("hidden");
		$(".saved-products-list .menu-icon.right").attr("src", "symbols-thin-black/delete.svg");
		$(".saved-products-list .selected .menu-icon.right").attr("src", "symbols-thin-black/checkmark.svg");
		$(".saved-products-list").addClass("delete-mode");
		$(".product-delete-mode-disable").addClass("disabled");
		$("#connect-to-delete-button").attr("src", "symbols-thin-black/done.svg");
		productDeleteMode = true;
	} else if (productDeleteMode == true) {
		$(".product-delete-mode-hide").removeClass("hidden");
		$(".saved-products-list .menu-icon.right").attr("src", "symbols-thin-black/checkmark.svg");
		$(".saved-products-list").removeClass("delete-mode");
		$(".product-delete-mode-disable").removeClass("disabled");
		$("#connect-to-delete-button").attr("src", "symbols-thin-black/delete.svg");
		productDeleteMode = false;
	}
}

function productClick(index) {
	if (!productDeleteMode) {
		selectProduct(index, null, true);
	} else {
		ask("remove-product-ask-menu", [savedProducts[index].name], [function() {removeProduct(index)}]);
	}
}

function inputProduct() {
	options = {placeholders: {text: "System Name"}};
	startTextInput(1, "Add System", "Enter the name of the system you would like to add, exactly as it was set up. Alternatively, enter its hostname (without \".local\").", options, function(details) {
		hostname = generateHostname(details.text);
		productDetails = {name: details.text};
		productAddResult = addOrUpdateProduct(hostname, productDetails, false, true);
		if (productAddResult != null) {
			notify(details.text + " added", "", "done");
		} else {
			notify(details.text + " already added", "", "notification");	
		}
	});
}

function inputProductIP() {
	options = {placeholders: {text: "192.168..."}};
	startTextInput(1, "Connect with IP", "Enter the IP address of the system you would like to connect to. The system will announce its IP address.", options, function(details) {
		theIP = details.text;
		connectProduct(true, theIP);
	});
}

function selectProduct(index, autoCycle, manual) {

	if (typeof index == "undefined") {
		// Return selected product
		sel = null;
		for (var i = 0; i < savedProducts.length; i++) {
			if (savedProducts[i].hostname == productHostname) {
				sel = i;
			}
		}
		return sel;
	} else if (index == null) {
		// Automatically select next product, if no index specified.
		if (savedProducts.length > 0) {
			if (productAutoCycle != null) {
				if (productAutoCycle < savedProducts.length) {
					productHostname = savedProducts[productAutoCycle].hostname;
					productAutoCycle++;
				} else {
					productHostname = null; // Will try to connect to a blank product after trying saved products.
					productAutoCycle = 0;
				}
			}
		} else {
			productHostname = null;
		}
	} else if (index == "new") {
		productHostname = null; // Will try to connect to a blank product after trying saved products.
		productAutoCycle = null;
		connectProduct(true);
		selectedProductIndex = null;
	} else {
		
		if (index != selectedProductIndex || !manual) {
			$("#multi-button span").text("Connecting...");
			$("#multi-button").removeClass("hidden").addClass("disabled load");
			selectedProductIndex = index;
			$(".saved-product-item").removeClass("selected");
			$(".saved-product-item-"+index).addClass("selected");
			localStorage.beoCreateSelectedProductIndex = JSON.stringify(selectedProductIndex);
			if (!savedProducts[index]) {
				selectedProductIndex = 0;
				index = 0;
			}
			productHostname = savedProducts[index].hostname;
			if (!autoCycle) {
				productAutoCycle = null;
				if (manual) connectProduct(true);
			} else {
				if (index < (savedProducts.length-1)) {
					productAutoCycle = parseInt(index)+1;
				} else {
					productAutoCycle = 0;	
				}
			}
		}
	}
}

function connectProduct(manualClose, withIP) {

	if (manualClose) {
		if (socket) socket.close();
	}
	
	clearTimeout(connectTimeout);
	connectTimeout = setTimeout(function() {
		if (!connected) {
			if (socket) socket.close();
		}
	}, 3000);
	
	if (withIP) {
		socket = new WebSocket('ws://' + withIP + ':1337', ["beocreate-remote"]);
	} else {
		if (productHostname) {
			socket = new WebSocket('ws://' + productHostname + '.local:1337', ["beocreate-remote"]);
		} else {
			if (triedHotspotIP) {
				socket = new WebSocket('ws://' + blankProductHostname + '.local:1337', ["beocreate-remote"]);
				triedHotspotIP = false;
			} else {
				socket = new WebSocket('ws://' + productHotspotIP + ':1337', ["beocreate-remote"]);
				triedHotspotIP = true;
			}
		}
	}
	
	
	socket.onmessage = function(message) {
		data = JSON.parse(message.data);
		//console.log(message.data);
		console.log(data);
		processReceivedData(data);
	};

	// Error.
	socket.onerror = function(error) {
		//console.log(error);
	};

	// Socket closes, either because the connection is lost or because the connection attempt failed. Socket could also close when another product is selected.
	socket.onclose = function() {
		if (connected) {
			connected = false;
			$("body").addClass("disconnected");
			selectedProfile = null;
			if (currentSetupStep != 4) {
				// If we're at setup step 4, we're expecting a disconnect, so don't show it in the interface.
				allowAdvancingToStep = 0;
				currentSetupStep = 0;
				checkIfAllowsNextStep();
				transitionToScreen("welcome");
				$("#multi-button span").text("Connecting...");
				$("#multi-button").removeClass("hidden").addClass("disabled load");
				$(".sound-profile-item").removeClass("selected");
			}
			setupMethod();
			clearTimeout(reconnectTimeout);
			toggleProductDeleteMode(false);
			reconnectTimeout = setTimeout(function() {
				connectProduct();
			}, 500);
		} else {
			if (!reconnect) {
				selectProduct(null); // If this is not a reconnect, select the next product.
				theDelay = 200;
				if (currentSetupStep != 4) {
					$("#multi-button span").text("Searching...");
					$("#multi-button").removeClass("hidden").addClass("disabled load");
				}
			} else {
				$("body").addClass("reconnect");
				theDelay = 5000;
				if (currentSetupStep != 4) {
					$("#multi-button span").text("Connecting...");
					$("#multi-button").removeClass("hidden").addClass("disabled load");
				}
			}
			
			clearTimeout(connectTimeout);
			reconnectTimeout = setTimeout(function() {
				connectProduct();
			}, theDelay);
		}
	};

	// Socket opens.
	socket.onopen = function() {
		connected = true;
		$("body").removeClass("disconnected reconnect");
		notify(false);
		connectedWith = null;
		if (productHostname) {
			connectedWith = productHostname;
			if (productAutoCycle != null) {
				selectedProductIndex = selectProduct(); // gets selected product
				
				//selectedProductIndex = productAutoCycle;
				//console.log("Selected: "+selectedProductIndex);
				$(".saved-product-item").removeClass("selected");
				$(".saved-product-item-"+selectedProductIndex).addClass("selected");
				localStorage.beoCreateSelectedProductIndex = JSON.stringify(selectedProductIndex);
			} 
		} else {
			localStorage.beoCreateSelectedProductIndex = JSON.stringify(null);
			if (triedHotspotIP) {
				connectedWith = "IP";
			} else {
				connectedWith = "blank";
			}
			
		}
		reconnect = true;
		$("#name").removeClass("block");
		sendToProduct({header: "handshake", content: {operation: "doHandshake", connectedWith: connectedWith}});
		clearTimeout(reconnectTimeout);
		clearTimeout(connectTimeout);
	};
}

function sendToProduct(jsonObject) {
	if (connected) {
		socket.send(JSON.stringify(jsonObject));
	}
}


function processReceivedData(data) {
	switch (data.header) {
		case "handshake":
			// When a new connection is made, the app will request a handshake. A properly set up product will return this handshake packet to let the app know basic details about the product. Otherwise the product will send the "setup" packet and the app will start the guided setup procedure
			currentSetupStep = null;
			if (data.content.hostname) {
				productHostname = data.content.hostname;
			}
			addOrUpdateProduct(productHostname, {name: data.content.name, model: data.content.model}, true);
			$(".product-hostname").text(productHostname+".local");
			$(".product-name").text(data.content.name);
			selectedProfile = data.content.model;
			$(".product-model").text("");
			if (data.content.modelName) {
				$(".product-model").text(data.content.modelName);
			} else if (soundProfiles) {
				for (var i = 0; i < soundProfiles.models.length; i++) {
					if (soundProfiles.models[i].file == data.content.model) {
						$(".product-model").text(soundProfiles.models[i].name);
					}
				}
			}
			$("#adjustments-disabled-note").removeClass("hidden");
			$("#custom-tuning-warning").addClass("hidden");
			if (data.content.volumeLimit != null) {
				setVolumeLimit(data.content.volumeLimit, true);	
				$("#vol-limit").removeClass("disabled");
				$("#custom-tuning-warning").removeClass("hidden");
				$("#adjustments-disabled-note").addClass("hidden");
			} else {
				$("#vol-limit").addClass("disabled");
			}
			if (data.content.chSelect != null) {
				$(".channel-select-item").removeClass("selected");
				$("#channel-select-item-"+data.content.chSelect).addClass("selected");
				$("#ch-select").removeClass("disabled");
				$("#custom-tuning-warning").removeClass("hidden");
				$("#adjustments-disabled-note").addClass("hidden");
			} else {
				$(".channel-select-item").removeClass("selected");
				$("#ch-select").addClass("disabled");
			}
			if (data.content.crossoverBands == 3) {
				$(".3-way-hide").addClass("hidden");
				$("#custom-tuning-warning").removeClass("hidden");
				$("#adjustments-disabled-note").addClass("hidden");
			} else {
				$(".3-way-hide").removeClass("hidden");
			}
			
			if (data.content.softwareUpdate) {
				$("#software-update-menu-item").removeClass("hidden");
			} else {
				$("#software-update-menu-item").addClass("hidden");
			}
			
			if (data.content.systemVersion) {
				$(".system-version").text("Release "+data.content.systemVersion);
			}
			
			$("#multi-button span").text("Searching...");
			$("#multi-button").removeClass("load").addClass("disabled hidden");
			wifiMode = data.content.wifiMode;
			wifiSettingsMode(wifiMode);
			transitionToScreen("overview");
			
			break;
		case "setup":
			if (data.content.status != undefined) {
				if (data.content.status == null) {
					// Setup has been completed. This will not be returned, the handshake will be sent instead (above).

				} else {
					// Indicates the setup state.
					wifiMode = data.content.wifiMode;
					wifiSettingsMode(wifiMode);
					doSetup(data.content.status);
				}
			}
			if (data.content.allowStep) {
				allowAdvancingToStep = data.content.allowStep;
				checkIfAllowsNextStep();
			}
			break;
		case "sources":
			if (data.content.message == "installing") {
				notify("Installing "+sourceNames[data.content.source]+"...", "This will take a while. The system will restart after the installation.", "load", true);
			}
			if (data.content.message == true) {
				notify(sourceNames[data.content.source]+" installed", "Restarting sound system, please wait...", "done", true);
			}
			if (data.content.sources) {
				$(".source-list-item").removeClass("disabled");
				for (var i = 0; i < data.content.sources.length; i++) {
				if (data.content.sources[i].file == data.content.model) {
					$("#source-list-"+data.content.sources[i]).addClass("disabled");
				}
			}
			}
			break;
		case "systemName":
			result = addOrUpdateProduct(data.content.hostname, {name: data.content.name, model: data.content.model, newHostname: data.content.hostname}, true);
			if (result === true || result === false) {
				//
			} else {
				selectProduct(result);
			}
			break;
		case "wifi":
			if (data.content.type == "available") {
				$(".wifi-available-list").empty();
				availableNetworks = data.content.networks;
				if (availableNetworks == null) {
					if (!wifiScanTriedAgain) {
						sendToProduct({header: "wifi", content: {operation: "listAvailable"}});
						wifiScanTriedAgain = true;
					}
					return;
				}
				for (var i = 0; i < data.content.networks.length; i++) {
					network = data.content.networks[i];
					
					// Determine signal strength icon
					if (network.quality > 60) {
						signalIcon = 3;
					} else if (network.quality > 40) {
						signalIcon = 2;
					} else if (network.quality > 30) {
						signalIcon = 1;
					} else {
						signalIcon = 0;
					}
					
					extraClasses = "";
					if (network.added) extraClasses += " disabled added";
					if (network.security != "open") extraClasses += " secure";
					
					hexEscapedNetworkName = network.ssid.decodeEscapeSequence();
					networkName = decodeUTF8(hexEscapedNetworkName);
					
					$(".wifi-available-list").append('<div class="wifi-available-item wifi-available-item-' + i + ' menu-item icon left'+extraClasses+'" onclick="addNetwork('+i+');"><div class="one-row"><img class="menu-icon" src="symbols-thin-black/wifi-'+signalIcon+'.svg"><div class="menu-label">' + networkName + '</div><img class="menu-icon right lock" src="symbols-thin-black/lock.svg"></div><div class="menu-value">Added</div></div>');
				}
			}
			if (data.content.type == "saved") {
				$(".wifi-saved-list").empty();
				$(".wifi-connected-wrap, .wifi-saved-wrap").addClass("hidden");
				if (data.content.networks) {
					if (currentSetupStep != null) {
						if (allowAdvancingToStep < 2) allowAdvancingToStep = 2;
						checkIfAllowsNextStep();
					}
				}
				savedNetworks = data.content.networks;
				for (var i = 0; i < data.content.networks.length; i++) {
					network = data.content.networks[i];
					
					//console.log(network.SSID);
					hexEscapedNetworkName = network.SSID.decodeEscapeSequence();
					//console.log(hexEscapedNetworkName);
					networkName = decodeUTF8(hexEscapedNetworkName);
					//console.log(networkName);
					extraClasses = "";
					if (network.current) {//extraClasses += " current";
						
						$(".wifi-connected-item .menu-label").text(networkName);
						$(".wifi-connected-item").attr("onclick", "removeNetwork("+i+");");
						$(".wifi-connected-wrap").removeClass("hidden");
					} else {
						if (network.errors == "tempDisabled") extraClasses = " wrong-password";
						$(".wifi-saved-list").append('<div class="menu-item wifi-saved-item wifi-saved-item-' + network.ID + ' icon left'+extraClasses+'" onclick="removeNetwork('+i+');"><div class="one-row"><img class="menu-icon" src="symbols-thin-black/wifi.svg"><div class="menu-label">' + networkName + '</div><img class="menu-icon right" src="symbols-thin-black/delete.svg"></div><div class="menu-value red">Invalid Password</div></div>');
						$(".wifi-saved-wrap").removeClass("hidden");
					}
				}
			}
			if (data.content.type == "added") {
				if (data.content.SSID) {
					hexEscapedNetworkName = data.content.SSID.decodeEscapeSequence();
					networkName = decodeUTF8(hexEscapedNetworkName);
					notify(networkName + " added", "", "wifi-3");
					setTimeout(function() {
						wifiScanTriedAgain = true;
						sendToProduct({header: "wifi", content: {operation: "listAvailable"}});
						sendToProduct({header: "wifi", content: {operation: "listSaved"}});
					}, 500);
				}
			}
			if (data.content.type == "removed") {
				setTimeout(function() {
					wifiScanTriedAgain = true;
					sendToProduct({header: "wifi", content: {operation: "listAvailable"}});
					sendToProduct({header: "wifi", content: {operation: "listSaved"}});
				}, 500);
			}
			if (data.content.type == "status") {
				if (data.content.status.quality) {
					// Determine signal strength icon
					if (data.content.status.quality > 60) {
						signalIcon = 3;
					} else if (data.content.status.quality > 40) {
						signalIcon = 2;
					} else if (data.content.status.quality > 30) {
						signalIcon = 1;
					} else {
						signalIcon = 0;
					}
					$(".wifi-connected-item .menu-icon.left").attr("src", "symbols-thin-black/wifi-"+signalIcon+".svg");
				}
			}
			if (data.content.type == "ip") {
				$(".system-ip").text(data.content.ip);
			}
			break;
		case "soundProfile":
			if (currentSetupStep != 4) {
				if (data.content.message == "downloading") {
					notify("Downloading sound profile...", "", "load", true);
				}
				if (data.content.message == "downloadError") {
					notify("Error downloading sound profile", "", "notification");
				}
				if (data.content.message == "flashError") {
					notify("Error installing the sound profile", "Please try again", "notification");
				}
				if (data.content.message == "flashing") {
					notify("Programming the sound processor...", "Don't unplug the sound system", "load", true);
				}
				if (data.content.message == "done") {
					notify("Sound profile changed", "", "done");
					sendToProduct({header: "handshake", content: {operation: "doHandshake"}});
				}
				if (data.content.message == "custom") {
					$("#vol-limit").addClass("disabled");
					$(".channel-select-item").removeClass("selected");
					$("#ch-select").addClass("disabled");
					$(".3-way-hide").removeClass("hidden");
					$("#adjustments-disabled-note").removeClass("hidden");
				}
			}
			break;
		case "ssh":
			if (data.content.enabled == 1) {
				$(".ssh-disabled").addClass("hidden");
				$(".ssh-enabled").removeClass("hidden");
			} else {
				$(".ssh-disabled").removeClass("hidden");
				$(".ssh-enabled").addClass("hidden");
			}
			break;
		case "plainJSON":
			console.log(JSON.parse(data.content));
			break;
		case "bottomProgress":
			$("#multi-button span").text(data.content);
			$("#multi-button").addClass("load disabled").removeClass("hidden");
			break;
		case "softwareUpdate":
			notify(false);
			if (data.content.available == true) {
				$("#no-updates").addClass("hidden");
				$("#update-available").removeClass("hidden");
				$(".new-system-version").text("Release "+data.content.newVersion);
				$(".update-changelog").html(data.content.releaseNotesHTML);
			} else {
				$("#no-updates").removeClass("hidden");
				$("#update-available").addClass("hidden");
			}
			break;
	}
}

function installSource(source, confirm) {
	if (!confirm) {
			ask("install-source-ask-menu", [sourceNames[source]], [function() {installSource(source, 1)}]);
		} else {
			sendToProduct({header: "sources", content: {operation: "install", source: source, restartNow: true}});
	}
}

var allowAdvancingToStep = null;
var allowNext = false;
var currentSetupStep = 0;

function checkIfAllowsNextStep(step) {
	if (!step) step = currentSetupStep;
	if (currentSetupStep != null) {
		$("#multi-button").removeClass("hidden load");
		if (currentSetupStep < allowAdvancingToStep) {
			$("#multi-button").removeClass("disabled hidden load");
			allowNext = true;
		} else {
			$("#multi-button").addClass("disabled");
			allowNext = false;
		}
	}
}

function prevStep() {
	doSetup(currentSetupStep-1);
}

multiButtonFunction = "";
function multiButton() {
	if (currentSetupStep != null) {
		nextStep();
	} else {
		switch (multiButtonFunction) {
			case "finishWifi":
				$("#multi-button span").text("Finishing...");
				$("#multi-button").addClass("hidden disabled");
				notify("Applying Wi-Fi settings...", "", "load", true);
				sendToProduct({header: "wifi", content: {operation: "setMode", mode: "autoHotspot"}});
				break;
		}
	}

}

function nextStep() {
	if (allowNext) {
		if (currentSetupStep == 0 && wifiMode == false) {
			// Skip Wi-Fi setup if no Wi-Fi hardware is detected.
			doSetup(2);
		} else {
			doSetup(currentSetupStep+1);
		}
	}
}

function doSetup(setupStep) {
	sendToProduct({header: "setup", content: {operation: "requestStep", step: setupStep}});
	switch (setupStep) {
		case 0: // Ready to set up.
			transitionToScreen("setup-start");
			$("#multi-button span").text("Begin Setup");
			break;
		case 1: // Wi-Fi.
			transitionToScreen("setup-wifi");
			$("#multi-button span").text("Next Step");
			break;
		case 2: // Sound profiles.
			transitionToScreen("setup-profile");
			allowAdvancingToStep = 2;
			listSoundProfiles();
			$("#multi-button span").text("Next Step");
			break;
		case 3: // System name.
			transitionToScreen("setup-name");
			$("#multi-button span").text("Finish Setup");
			break;
		case 4: // System name.
			saveSystemName(setupStep);
			transitionToScreen("setup-finish");
			$("#multi-button span").text("Finishing...");
			$("#multi-button").addClass("load disabled").removeClass("hidden");
			break;
	}
	currentSetupStep = setupStep;
	checkIfAllowsNextStep();
}


function ssh(mode) {
	if (mode == true) {
		sendToProduct({header: "setup", content: {operation: "ssh", type: "enable"}});
	} else {
		sendToProduct({header: "setup", content: {operation: "ssh", type: "disable"}});
	}
}

function installSoftwareUpdate(confirm) {
	if (!confirm) {
			ask("install-update-ask-menu", [], [function() {installSoftwareUpdate(1)}]);
		} else {
			sendToProduct({header: "softwareUpdate", content: {operation: "install"}});
	}
}

var availableNetworks;
var savedNetworks;
var wifiMode = "";
var wifiScanTriedAgain = false;

function wifiSettingsMode(mode) {
	switch (mode) {
		case "normal":
		case "autoHotspot":
			$(".wifi-not-connected").addClass("hidden");
			$(".wifi-connected").removeClass("hidden");
			$("body").removeClass("no-wifi").addClass("has-wifi");
			break;
		case "hotspot":
			$(".wifi-not-connected").removeClass("hidden");
			$(".wifi-connected").addClass("hidden");
			$("body").removeClass("no-wifi").addClass("has-wifi");
			break;
		case false:
			$(".wifi-not-connected").addClass("hidden");
			$(".wifi-connected").removeClass("hidden");
			$("body").addClass("no-wifi").removeClass("has-wifi");
			break;
	}
}


function addOtherNetwork() {
	options = {placeholders: {text: "Network Name", password: "Password"}, minLength: {password: 8}, optional: {password: true}};
	startTextInput(3, "Add Other", "Enter the name and password of the network you would like to add. If the network has no password, leave it blank.", options, function(details) {
		sendToProduct({header: "wifi", content: {operation: "add", options: {SSID: details.text, password: details.password}}});
	});
}

function addNetwork(index, confirm) {
	if (availableNetworks[index].security != "open") {
		// Ask for password.
		options = {placeholders: {password: "Password"}, minLength: {password: 8}};
		startTextInput(2, "Enter Password", availableNetworks[index].ssid+" is protected with a password. Enter it to add the network.", options, function(details) {
			sendToProduct({header: "wifi", content: {operation: "add", options: {ID: index, password: details.password}}});
	});
	} else {
		// Confirm adding an open network.
		if (!confirm) {
			ask("open-network-ask-menu", [availableNetworks[index].ssid], [function() {addNetwork(index, 1)}]);
		} else {
			sendToProduct({header: "wifi", content: {operation: "add", options: {ID: index}}});
		}
	}
}

function removeNetwork(index, confirm) {
	if (!confirm) {
		hexEscapedNetworkName = savedNetworks[index].SSID.decodeEscapeSequence();
			networkName = decodeUTF8(hexEscapedNetworkName);
		if (!savedNetworks[index].current) {
			ask("remove-network-ask-menu", [networkName], [function() {removeNetwork(index, 1)}]);
		} else {
			ask("remove-current-network-ask-menu", [networkName], [function() {removeNetwork(index, 1)}]);
		}
	} else {	
		sendToProduct({header: "wifi", content: {operation: "remove", ID: savedNetworks[index].ID}});
	}
}

var soundProfiles;
var selectedProfile = null;
function listSoundProfiles() {
	// Bang & Olufsen profiles
	//console.log(soundProfiles.beoModels.length);
	$(".beo-sound-profiles, .other-sound-profiles").empty();
	for (var i = 0; i < soundProfiles.models.length; i++) {
		if (soundProfiles.models[i].mfg && soundProfiles.models[i].mfg == "Bang & Olufsen") {
			container = "beo-sound-profiles";
		} else {
			container = "other-sound-profiles";
		}
			extraClasses = "";
			if (selectedProfile == soundProfiles.models[i].file) extraClasses = " selected";
			if (soundProfiles.models[i].hidden) extraClasses+= " hidden";
			$("."+container).append('<div class="sound-profile-item menu-item sound-profile-item-' + soundProfiles.models[i].file + extraClasses + ' icon large left radio" onclick="selectSoundProfile('+i+');"><div class="one-row"><img class="menu-icon" src="images/speakers/'+soundProfiles.models[i].file+'.svg"><div class="unified-label-value"><div class="menu-label">' + soundProfiles.models[i].name + '</div><div class="menu-value">' + soundProfiles.models[i].description + '</div></div><img src="symbols-thin-black/checkmark.svg" class="menu-icon right checkmark"></div></div>');
	}
	
}

function selectSoundProfile(index) {
	if (currentSetupStep != null) {
		selectedProfile = soundProfiles.models[index].file;
		$(".sound-profile-item").removeClass("selected");
		$(".sound-profile-item-"+selectedProfile).addClass("selected");
		if (soundProfiles.models[index].path) {
			thePath = soundProfiles.models[index].path;
		} else {
			thePath = soundProfiles.basePath;
		}
		sendToProduct({header: "soundProfile", content: {operation: "selectModel", fileName: selectedProfile, basePath: thePath}});
	} else {
		ask("flash-dsp-ask-menu", null, [function() {
			selectedProfile = soundProfiles.models[index].file;
			$(".sound-profile-item").removeClass("selected");
			$(".sound-profile-item-"+selectedProfile).addClass("selected");
			if (soundProfiles.models[index].path) {
			thePath = soundProfiles.models[index].path;
			} else {
				thePath = soundProfiles.basePath;
			}
			sendToProduct({header: "soundProfile", content: {operation: "selectModel", fileName: selectedProfile, basePath: thePath, flashNow: true}});
		}]);
	}
}

function selectChannel(channel) {
	$(".channel-select-item").removeClass("selected");
	$("#channel-select-item-"+channel).addClass("selected");
	sendToProduct({header: "dsp", content: {operation: "setChSelect", ch: channel}});   
}

function disableSoundAdjustments() {
	sendToProduct({header: "soundProfile", content: {operation: "enableCustom"}});
	$("#custom-tuning-warning").addClass("hidden");
	notify("Sound adjustments disabled", "", "done");
}

var textInputCallback;
var textInputMode = 0;
var textInputOptions;

function startTextInput(type, title, prompt, options, callback) {
	
	$("#text-input").addClass("block").removeClass("text password");
	$("#text-input-submit").addClass("disabled");
	
	textInputMode = type;
	if (type == 1) $("#text-input").addClass("text");
	if (type == 2) $("#text-input").addClass("password");
	if (type == 3) $("#text-input").addClass("text password");
	
	textInputOptions = options;
	if (options.placeholders.text) $("#text-input input[type=text]").attr("placeholder", options.placeholders.text);
	if (options.placeholders.password) $("#text-input input[type=password]").attr("placeholder", options.placeholders.password);
	
	$("#text-input input[type=text], #text-input input[type=password]").val("");
	
	$("#text-prompt").text(prompt);
	$("#text-input h1").text(title);
	textInputCallback = callback;
	
	setTimeout(function() {
		$("#text-input").removeClass("bottom").addClass("visible");
	}, 20);
	setTimeout(function() {
		$("#chrome").addClass("at-background");
	}, 520);
}

var textInputValid = false;
function validateTextInput() {
	textInputValid = true;
	txt = $("#text-input input[type=text]").val();
	passwd = $("#text-input input[type=password]").val();
	if (textInputMode == 1 || textInputMode == 3) {
		if (!txt) textInputValid = false;
		if (textInputOptions.minLength && textInputOptions.minLength.text) {
			if (txt.length < textInputOptions.minLength.text) textInputValid = false;
		}
	}
	if (textInputMode == 2 || textInputMode == 3) {
		if (textInputOptions.optional && textInputOptions.optional.password) {
			if (textInputOptions.minLength.password && passwd != "") {
				if (passwd.length < textInputOptions.minLength.password) textInputValid = false;
			}
		} else {
			if (!passwd) textInputValid = false;
			if (textInputOptions.minLength.password) {
				if (passwd.length < textInputOptions.minLength.password) textInputValid = false;
			}
		}
	}
	if (textInputValid) {
		$("#text-input-submit").removeClass("disabled");
	} else {
		$("#text-input-submit").addClass("disabled");
	}
}

function submitText() {
	if (textInputValid) {
		txt = $("#text-input input[type=text]").val();
		passwd = $("#text-input input[type=password]").val();
		textInputCallback({text: txt, password: passwd});
		cancelText();
		return true;
	} else {
		return false;	
	}
}


function cancelText() {
	$("#text-input input[type=text], #text-input input[type=password]").blur();
	$("#text-input").addClass("bottom").removeClass("visible");
	$("#chrome").removeClass("at-background");
	setTimeout(function() {
		$("#text-input").removeClass("block");
	}, 520);
}

generatedHostname = "";
systemName = "";
$('input').bind('input propertychange', function() {
    if ($(this).attr("id") == "text-input-plain") validateTextInput();
	if ($(this).attr("id") == "text-input-password") validateTextInput();
	
	if ($(this).attr("class") == "text-input-system-name") {
		generatedHostname = generateHostname($(this).val());
		systemName = $(this).val();
		$(".system-name-input-hostname").text(generatedHostname+".local");
		if ($(this).val()) {
			$(".system-name-input-hostname-string").removeClass("hidden");
			if (currentSetupStep != null) allowAdvancingToStep = 4;
		} else {
			$(".system-name-input-hostname-string").addClass("hidden");
			if (currentSetupStep != null) allowAdvancingToStep = 3;
		}
		if (currentSetupStep != null) checkIfAllowsNextStep();
	}
	
	if ($(this).attr("id") == "volume-limit-slider") setVolumeLimit($(this).val());
});
	
function saveSystemName(setupStep) {
	$(".text-input-system-name").val("");
	if (!setupStep) {
		if (currentSetupStep == 3) {
			if (allowNext) {
				$(".text-input-system-name").blur();
				nextStep();
			}
		} else {
			$(".text-input-system-name").blur();
			sendToProduct({header: "setup", content: {operation: "systemName", hostname: generatedHostname, name: systemName, restartNow: true}});
		}
	} else {
		if (setupStep == 4) {
			console.log("Saving system name and doing automated setup.");
			$(".text-input-system-name").blur();
			sendToProduct({header: "setup", content: {operation: "setName", hostname: generatedHostname, name: systemName, doAutomatedSetup: true}});
		}
	}
}

function setVolumeLimit(limit, show) {
	if (show) {
		$("#volume-limit-slider").val(limit);
	} else {
		sendToProduct({header: "dsp", content: {operation: "setVolumeLimit", limit: limit}});   
	}
}

var notifyTimeout = null;
function notify(notification, finePrint, icon, persistent) {
	if (notification === false) {
		$("#notify").removeClass("visible");
		setTimeout(function() {
			$("#notify").removeClass("block");
			$("#notify img").removeClass("load-animate");
		}, 520);
	} else {
		if (icon) {
			if (icon != "load") {
				$("#notify img").removeClass("load-animate");
				$("#notify img").attr("src", "symbols-thin-black/"+icon+".svg");
			} else {
				$("#notify img").attr("src", "symbols-thin-black/load.svg");
				$("#notify img").addClass("load-animate");
			}
		} else {
			$("#notify img").attr("src", "symbols-thin-black/notification.svg")
		}

		$("#notify p").empty();
		if (finePrint) $("#notify p").text(finePrint);
		$("#notify h1").text(notification);

		if (notifyTimeout) clearTimeout(notifyTimeout);
		notifyTimeout = null;
		$("#notify").addClass("block");
		setTimeout(function() {
			$("#notify").addClass("visible");
		}, 20);
		if (!persistent) {
			notifyTimeout = setTimeout(function() {
				$("#notify").removeClass("visible");
				setTimeout(function() {
					$("#notify").removeClass("block");
					$("#notify img").removeClass("load-animate");
				}, 520);
			}, 2000);
		}
	}
}

var askCallbacks = null;
function ask(menuID, dynamicContent, callbacks) {
	if (menuID) {
		if (callbacks) askCallbacks = callbacks;
		$("#ask-dynamic-menu").html($("#"+menuID).html());
		if (dynamicContent) {
			for (var i = 0; i < dynamicContent.length; i++) {
				$(".ask-dynamic-"+i).text(dynamicContent[i]);
			}
		}
		$("#ask").addClass("block");
		setTimeout(function() {
			$("#ask").addClass("visible");
		}, 100);
		setTimeout(function() {
			$("#chrome").addClass("at-background");
		}, 600);
	} else {
		$("#chrome").removeClass("at-background");
		$("#ask").removeClass("visible");
		setTimeout(function() {
			$("#ask").removeClass("block");
		}, 520);
	}
}

function askOption(callbackIndex) {
	if (askCallbacks) {
		askCallbacks[callbackIndex]();
	}
	ask();
	askCallbacks = null;
}

function help(topic) {
	if (topic) {
		$(".help-topic").addClass("hidden");
		$("#"+topic).removeClass("hidden");
		$("#help").addClass("block");
		setTimeout(function() {
			$("#help").addClass("visible").removeClass("bottom");
		}, 100);
		setTimeout(function() {
			$("#chrome").addClass("at-background");
		}, 600);
	} else {
		$("#chrome").removeClass("at-background");
		$("#help").removeClass("visible").addClass("bottom");
		setTimeout(function() {
			$("#help").removeClass("block");
		}, 520);
	}
}

function generateHostname(readableName) {
	n = readableName.toLowerCase(); // Convert to lower case
	n = removeDiacritics(n); // Remove diacritics
	n = n.replace(" ", "-"); // Replace spaces with hyphens
	n = n.replace(/[^\w\-]|_/g, ""); // Remove non-alphanumeric characters except hyphens
	n = n.replace(/-+$/g, ""); // Remove hyphens from the end of the name.
	return n; //+".local"; // Add .local
}



// SUPPORT FUNCTIONS

// OTHER SUPPORTING FUNCTIONS

// encode or decode UTF8 (used with displaying Wi-Fi network names)
function encodeUTF8(s) {
	return unescape(encodeURIComponent(s));
}

function decodeUTF8(s) {
	return decodeURIComponent(escape(s));
}

// decode hex escape sequence
String.prototype.decodeEscapeSequence = function() {
	return this.replace(/\\x([0-9A-Fa-f]{2})/g, function() {
		return String.fromCharCode(parseInt(arguments[1], 16));
	});
};


// EMBEDDED DIACRITICS.JS

/*
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
    var defaultDiacriticsRemovalMap = [
        {'base':'A', 'letters':'\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F'},
        {'base':'AA','letters':'\uA732'},
        {'base':'AE','letters':'\u00C6\u01FC\u01E2'},
        {'base':'AO','letters':'\uA734'},
        {'base':'AU','letters':'\uA736'},
        {'base':'AV','letters':'\uA738\uA73A'},
        {'base':'AY','letters':'\uA73C'},
        {'base':'B', 'letters':'\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181'},
        {'base':'C', 'letters':'\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E'},
        {'base':'D', 'letters':'\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779\u00D0'},
        {'base':'DZ','letters':'\u01F1\u01C4'},
        {'base':'Dz','letters':'\u01F2\u01C5'},
        {'base':'E', 'letters':'\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E'},
        {'base':'F', 'letters':'\u0046\u24BB\uFF26\u1E1E\u0191\uA77B'},
        {'base':'G', 'letters':'\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E'},
        {'base':'H', 'letters':'\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D'},
        {'base':'I', 'letters':'\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197'},
        {'base':'J', 'letters':'\u004A\u24BF\uFF2A\u0134\u0248'},
        {'base':'K', 'letters':'\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2'},
        {'base':'L', 'letters':'\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780'},
        {'base':'LJ','letters':'\u01C7'},
        {'base':'Lj','letters':'\u01C8'},
        {'base':'M', 'letters':'\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C'},
        {'base':'N', 'letters':'\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4'},
        {'base':'NJ','letters':'\u01CA'},
        {'base':'Nj','letters':'\u01CB'},
        {'base':'O', 'letters':'\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C'},
        {'base':'OI','letters':'\u01A2'},
        {'base':'OO','letters':'\uA74E'},
        {'base':'OU','letters':'\u0222'},
        {'base':'OE','letters':'\u008C\u0152'},
        {'base':'oe','letters':'\u009C\u0153'},
        {'base':'P', 'letters':'\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754'},
        {'base':'Q', 'letters':'\u0051\u24C6\uFF31\uA756\uA758\u024A'},
        {'base':'R', 'letters':'\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782'},
        {'base':'S', 'letters':'\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784'},
        {'base':'T', 'letters':'\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786'},
        {'base':'TZ','letters':'\uA728'},
        {'base':'U', 'letters':'\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244'},
        {'base':'V', 'letters':'\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245'},
        {'base':'VY','letters':'\uA760'},
        {'base':'W', 'letters':'\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72'},
        {'base':'X', 'letters':'\u0058\u24CD\uFF38\u1E8A\u1E8C'},
        {'base':'Y', 'letters':'\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE'},
        {'base':'Z', 'letters':'\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762'},
        {'base':'a', 'letters':'\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250'},
        {'base':'aa','letters':'\uA733'},
        {'base':'ae','letters':'\u00E6\u01FD\u01E3'},
        {'base':'ao','letters':'\uA735'},
        {'base':'au','letters':'\uA737'},
        {'base':'av','letters':'\uA739\uA73B'},
        {'base':'ay','letters':'\uA73D'},
        {'base':'b', 'letters':'\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253'},
        {'base':'c', 'letters':'\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184'},
        {'base':'d', 'letters':'\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A'},
        {'base':'dz','letters':'\u01F3\u01C6'},
        {'base':'e', 'letters':'\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD'},
        {'base':'f', 'letters':'\u0066\u24D5\uFF46\u1E1F\u0192\uA77C'},
        {'base':'g', 'letters':'\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F'},
        {'base':'h', 'letters':'\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265'},
        {'base':'hv','letters':'\u0195'},
        {'base':'i', 'letters':'\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131'},
        {'base':'j', 'letters':'\u006A\u24D9\uFF4A\u0135\u01F0\u0249'},
        {'base':'k', 'letters':'\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3'},
        {'base':'l', 'letters':'\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747'},
        {'base':'lj','letters':'\u01C9'},
        {'base':'m', 'letters':'\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F'},
        {'base':'n', 'letters':'\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5'},
        {'base':'nj','letters':'\u01CC'},
        {'base':'o', 'letters':'\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275'},
        {'base':'oi','letters':'\u01A3'},
        {'base':'ou','letters':'\u0223'},
        {'base':'oo','letters':'\uA74F'},
        {'base':'p','letters':'\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755'},
        {'base':'q','letters':'\u0071\u24E0\uFF51\u024B\uA757\uA759'},
        {'base':'r','letters':'\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783'},
        {'base':'s','letters':'\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B'},
        {'base':'t','letters':'\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787'},
        {'base':'tz','letters':'\uA729'},
        {'base':'u','letters': '\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289'},
        {'base':'v','letters':'\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C'},
        {'base':'vy','letters':'\uA761'},
        {'base':'w','letters':'\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73'},
        {'base':'x','letters':'\u0078\u24E7\uFF58\u1E8B\u1E8D'},
        {'base':'y','letters':'\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF'},
        {'base':'z','letters':'\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763'}
    ];

    var diacriticsMap = {};
    for (var i=0; i < defaultDiacriticsRemovalMap .length; i++){
        var letters = defaultDiacriticsRemovalMap [i].letters;
        for (var j=0; j < letters.length ; j++){
            diacriticsMap[letters[j]] = defaultDiacriticsRemovalMap [i].base;
        }
    }

    // "what?" version ... http://jsperf.com/diacritics/12
    function removeDiacritics (str) {
        return str.replace(/[^\u0000-\u007E]/g, function(a){ 
           return diacriticsMap[a] || a; 
        });
    } 