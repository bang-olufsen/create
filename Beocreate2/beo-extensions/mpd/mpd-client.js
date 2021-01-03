var mpd = (function() {

var mpdEnabled = false;
var storageList = [];
var discoveredNAS = {};
var shares = [];
var sharePath = "/";
var selectedShare = null;

$(document).on("mpd", function(event, data) {
	if (data.header == "mpdSettings") {
		
		if (data.content.mpdEnabled) {
			mpdEnabled = true;
			$("#mpd-enabled-toggle").addClass("on");
			$("#mpd-link").attr("href", "http://"+window.location.host+":9000").removeClass("hidden");
		} else {
			mpdEnabled = false;
			$("#mpd-enabled-toggle").removeClass("on");
			$("#mpd-link").addClass("hidden");
		}
		beo.notify(false, "mpd");
	}
	if (data.header == "mountedStorage") {
		$("#mpd-mounted-storage").empty();
		if (data.content && data.content.storage) {
			storageList = data.content.storage;
			for (s in data.content.storage) {
				if (data.content.storage[s].kind == "USB") {
					menuOptions = {
						label: data.content.storage[s].name,
						value: "Remove...",
						valueAsButton: true,
						icon: extensions.mpd.assetPath+"/symbols-black/usb-drive.svg",
						description: "USB drive",
						onclick: "mpd.removeStorage("+s+");"
					}
				} else if (data.content.storage[s].kind == "NAS") {
					menuOptions = {
						label: data.content.storage[s].name,
						value: (data.content.storage[s].mount) ? "Remove..." : "Unavailable",
						valueAsButton: (data.content.storage[s].mount) ? true : false,
						icon: (data.content.storage[s].mount) ? extensions.mpd.assetPath+"/symbols-black/nas.svg" : "/common/symbols-colour/warning-yellow.svg",
						description: "NAS — "+data.content.storage[s].path,
						onclick: "mpd.removeStorage("+s+", "+(!data.content.storage[s].mount)+");"
					}
				}
				$("#mpd-mounted-storage").append(beo.createMenuItem(menuOptions));
			}
		}
		//beo.notify(false, "mpd");
	}
	
	if (data.header == "discoveredNAS") {
		$("#mpd-discovered-storage").empty();
		discoveredNAS = {};
		if (data.content && data.content.storage && Object.keys(data.content.storage).length) {
			discoveredNAS = data.content.storage;
			$("#mpd-discovered-storage").append("<h2>Found NAS Servers</h2>");
			for (s in data.content.storage) {
				menuOptions = {
					label: s,
					value: "Add...",
					icon: extensions.mpd.assetPath+"/symbols-black/nas.svg",
					valueAsButton: true,
					onclick: "mpd.addNAS(1, '"+s+"');"
				}
				$("#mpd-discovered-storage").append(beo.createMenuItem(menuOptions));
			}
		}
	}
	
	if (data.header == "discoveringNAS") {
		if (data.content) {
			$("#mpd-discovering-storage").removeClass("hidden");
		} else {
			$("#mpd-discovering-storage").addClass("hidden");
		}
	}
	
	if (data.header == "shares" && data.content && 
		data.content.server && data.content.shares) {
		if (!data.content.errors) {
			beo.notify();
			$("#mpd-server-name").text(data.content.server.name);
			$("#mpd-share-list").empty();
			shares = data.content.shares;
			sharePath = "/";
			selectedShare = null;
			for (s in shares) {
				menuOptions = {
					label: shares[s],
					valueAsButton: true,
					checkmark: "left",
					id: "mpd-share-list-item-"+s,
					onclick: "mpd.addNAS(2, '"+s+"');"
				}
				$("#mpd-share-list").append(beo.createMenuItem(menuOptions));
			}
			$("#mpd-nas-path").text(sharePath);
			$("#mpd-add-nas-button").addClass("disabled");
			beo.ask("mpd-nas-setup", null, null, function() {
				addNAS(0);
			});
		} else {
			beo.notify({title: "Destination unavailable", message: "Available shares on the selected NAS could not be listed.", icon: "common/symbols-colour/warning-yellow.svg", timeout: false, buttonAction: "close", buttonTitle: "Close"});
		}
	}
	
	if (data.header == "addingNAS") {
		beo.notify({title: "Adding server...", message: "Please wait.", icon: "attention", timeout: false});
	}
	
	if (data.header == "addedNAS") {
		beo.notify({title: data.content.name, message: "Server added.", icon: "common/symbols-black/checkmark-round.svg"});
	}
	
	if (data.header == "isUpdatingDatabase") {
		if (data.content.updating) {
			$("#mpd-update-button").addClass("disabled");
			$("#mpd-updating-label").removeClass("hidden");
		} else {
			$("#mpd-update-button").removeClass("disabled");
			$("#mpd-updating-label").addClass("hidden");
		}
	}
	

});


function toggleEnabled() {
	enabled = (!mpdEnabled) ? true : false;
	if (enabled) {
		beo.notify({title: "Turning MPD on...", icon: "attention", timeout: false});
	} else {
		beo.notify({title: "Turning MPD off...", icon: "attention", timeout: false});
	}
	beo.send({target: "mpd", header: "mpdEnabled", content: {enabled: enabled}});
}

var noReset = false;
var shareListTimeout = null;
function addNAS(stage, data, withIP = false) {
	switch (stage) {
		case 0:
			// Cancel.
			if (!noReset) beo.sendToProduct("mpd", "cancelNASAdd");
			break;
		case 1:
			// Enter username & password.
			noReset = false;
			beo.startTextInput(3, "Server Login", "Enter user name and password to log into '"+data+"'.", 
			{text: "", placeholders: {text: "User name", password: "Password"}, minLength: {text: 1}}, function(input) {
				if (input && input.text && input.password) {
					if (!withIP && discoveredNAS[data]) {
						beo.sendToProduct("mpd", "getNASShares", {server: discoveredNAS[data], username: input.text, password: input.password, withIP: false});
					} else {
						beo.sendToProduct("mpd", "getNASShares", {server: {addresses: [data]}, username: input.text, password: input.password, withIP: true});
					}
					beo.notify({title: "Waiting for server...", message: "Please wait.", icon: "attention", timeout: false});
				}
			});
			break;
		case 2:
			// Select share.
			$("#mpd-share-list div").removeClass("checked");
			$("#mpd-share-list #mpd-share-list-item-"+data).addClass("checked");
			$("#mpd-add-nas-button").removeClass("disabled");
			selectedShare = data;
			break;
		case 3:
			// Set path (optional).
			beo.startTextInput(1, "Set Path", "If the content is in a subfolder on the server, enter the path to that folder.", 
			{text: "/", placeholders: {text: "/path/to/folder"}, minLength: {text: 1}}, function(input) {
				if (input && input.text) {
					if (input.text.charAt(0) != "/") {
						sharePath = "/"+input.text;
					} else {
						sharePath = input.text;
					}
				}
				$("#mpd-nas-path").text(sharePath);
			});
			break;
		case 4:
			// Save.
			noReset = true;
			beo.sendToProduct("mpd", "addNAS", {share: shares[selectedShare], path: sharePath});
			beo.ask();
			break;
		case 5:
			// Enter IP address manually.
			beo.startTextInput(1, "Add Other Server", "Enter the IP address of the SMB server you would like to add.", {placeholders: {text: "10.0..."}, optional: {text: true}}, function(input) {
				// Validate and store input.
				if (input) {
					if (input.text) {
						if (isValidIP(input.text)) {
							addNAS(1, input.text, true);
						} else {
							beo.notify({title: "IP address is not valid", message: "The address must contain four numbers separated by periods.", timeout: false, buttonTitle: "Close", buttonAction: "close"});
						}
					}
				}
			});
			break;
	}
}


function isValidIP(address) {
	ipItems = address.split(".");
	validIP = true;
	if (ipItems.length == 4 && address != "0.0.0.0") {
		// Length matches.
		for (var i = 0; i < ipItems.length; i++) {
			if (isNaN(ipItems[i])) validIP = false;
		}
	} else {
		validIP = false;
	}
	return validIP;
}

function removeStorage(index, unavailable = false) {
	if (storageList[index].kind == "USB") {
		storageName = storageList[index].name;
	} else {
		storageName = storageList[index].name+"/"+storageList[index].path;
	}
	if (!unavailable) {
		beo.ask("mpd-remove-storage", [storageName], [
			function() {
				beo.sendToProduct("mpd", "removeStorage", {id: storageList[index].id});
			}
		]);
	} else {
		beo.ask("mpd-remove-storage-unavailable", [storageName], [
			function() {
				beo.sendToProduct("mpd", "mountNASAgain");
			},
			function() {
				beo.sendToProduct("mpd", "removeStorage", {id: storageList[index].id});
			}
		]);
	}
}

function updateDatabase() {
	beo.sendToProduct("mpd", "updateDatabase");
}
	

interactDictionary = {
	actions: {
		updateDatabase: {
			name: "Update Music Library",
			icon: "extensions/mpd/symbols-black/mpd.svg"
		}
	}
}


return {
	toggleEnabled: toggleEnabled,
	addNAS: addNAS,
	removeStorage: removeStorage,
	updateDatabase: updateDatabase,
	interactDictionary: interactDictionary,
};

})();