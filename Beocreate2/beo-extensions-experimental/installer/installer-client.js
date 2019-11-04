var installer = (function() {

var reloadAfterRestart = false;
var availableExtensions = {};
var extensionUpdates = {};

$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			if (reloadAfterRestart) window.location.reload(true);
			// When the product connects after server restart, reload the UI so that changes to extensions are reflected.
		}
	}
	
});


$(document).on("installer", function(event, data) {
	
	
	if (data.header == "listInstalled") {
		$(".extensions-list-container").empty();
		
		for (extension in data.content.extensions) {
			labelClasses = [];
			value = undefined;
			
			label = titleForExtension(extension);
			if (data.content.extensions[extension].version) {
				value = "v"+data.content.extensions[extension].version;
				extensions[extension].version = data.content.extensions[extension].version;
			}
			
			valueTranslation = false;
			if (!data.content.extensions[extension].loadedSuccesfully) {
				labelClasses = ["red"];
				value = "Server code error";
				valueTranslation = "failedToLoad";
			}
			
			if (extensions[extension].icon) {
				icon = extensions[extension].assetPath+"/symbols-black/"+extensions[extension].icon;
			} else {
				icon = extensions["product-information"].assetPath+"/symbols-black/puzzle.svg";
			}
			/*if (extensions[extension].builtIn) {
				iconRight = null;
				isStatic = true;
			} else {
				// Allow this extension to be deleted.
				iconRight = "common/symbols-black/delete.svg";
				isStatic = false;
			}*/
				
			$(".extensions-list-container").append(createMenuItem({
				label: label,
				labelClasses: labelClasses,
				value: value,
				//iconRight: "common/symbols-black/more.svg",
				translation: {value: valueTranslation},
				//static: isStatic,
				icon: icon,
				onclick: "installer.showExtensionInfo('"+extension+"');"
			}));
		}
		
	}
	
	if (data.header == "availableExtensions") {
		$(".available-extensions-sources, .available-extensions-other").empty();
		availableExtensions = data.content.extensions;
		extensionCountSources = 0;
		extensionCountOther = 0;
		
		for (extension in availableExtensions) {
			labelClasses = [];
			value = undefined;
			
			label = availableExtensions[extension].name;
			description = availableExtensions[extension].description;
			
			if (availableExtensions[extension].iconName) {
				icon = extensions["installer"].assetPath+"/icon-cache/"+availableExtensions[extension].iconName;
			} else {
				icon = extensions["installer"].assetPath+"/symbols-black/puzzle.svg";
			}
			
			menuOptions = {
				label: label,
				labelClasses: labelClasses,
				value: "Install",
				valueAsButton: true,
				twoRows: true,
				customMarkup: "<p>"+description+"</p>",
				//static: isStatic,
				icon: icon,
				onclick: "installer.installExtension('"+extension+"');"
			}
			if (availableExtensions[extension].source) {
				extensionCountSources++;
				$(".available-extensions-sources").append(createMenuItem(menuOptions));
			} else {
				extensionCountOther++;
				$(".available-extensions-other").append(createMenuItem(menuOptions));
			}
		}
		
		if ($(".available-extensions").hasClass("sources-only")) {
			if (extensionCountSources > 0) {
				$(".no-extensions-available").addClass("hidden");
			} else {
				$(".no-extensions-available").removeClass("hidden");
			}
		} else {
			if (extensionCountOther > 0 || extensionCountSources > 0) {
				$(".no-extensions-available").addClass("hidden");
			} else {
				$(".no-extensions-available").removeClass("hidden");
			}
		}
		if (extensionCountOther > 0) {
			$(".available-extensions .other-title").removeClass("hidden");
		} else {
			$(".available-extensions .other-title").addClass("hidden");
		}
		if (extensionCountSources > 0) {
			$(".available-extensions .sources-title").removeClass("hidden");
		} else {
			$(".available-extensions .sources-title").addClass("hidden");
			$(".available-extensions .other-title").addClass("hidden");
		}
		
	}
	
	
	
	if (data.header == "checkingForUpdates") {
		$(".up-to-date").addClass("hidden");
		$(".checking-for-updates").removeClass("hidden");
		$(".updates-available").addClass("hidden");
		$(".update-all").addClass("disabled");
	}
	
	if (data.header == "extensionUpdatesAvailable") {
		$(".updates-list-container").empty();
		extensionUpdates = data.content.updates;
		updateCount = 0;
		
		for (extension in extensionUpdates) {
			labelClasses = [];
			value = undefined;
			
			label = extensionUpdates[extension].name;
			notes = extensionUpdates[extension].notes;
			
			if (extensionUpdates[extension].iconName) {
				icon = extensions["installer"].assetPath+"/icon-cache/"+extensionUpdates[extension].iconName;
			} else {
				icon = extensions["installer"].assetPath+"/symbols-black/puzzle.svg";
			}
			
			menuOptions = {
				label: extensionUpdates[extension].name,
				labelClasses: labelClasses,
				value: extensionUpdates[extension].version,
				//valueAsButton: true,
				twoRows: true,
				customMarkup: "<p>"+extensionUpdates[extension].notes+"</p>",
				//static: isStatic,
				icon: icon,
				onclick: "installer.updateExtension('"+extension+"');"
			}
			
			updateCount++;
			$(".updates-list-container").append(createMenuItem(menuOptions));
		}
		
		$(".checking-for-updates").addClass("hidden");
		if (updateCount > 0) {
			$(".up-to-date").addClass("hidden");
			$(".updates-available").removeClass("hidden");
			$(".updates-list-container").removeClass("hidden");
			$(".update-all").removeClass("disabled hidden");
		} else {
			$(".up-to-date").removeClass("hidden");
			$(".updates-available").addClass("hidden");
			$(".updates-list-container").addClass("hidden");
			$(".update-all").addClass("hidden");
		}
	}
	
	
	if (data.header == "installing") {
		title = (data.content.extension) ? titleForExtension(data.content.extension) : false;
		if (title) {
			notify({title: "Installing "+title+"…", icon: "attention", timeout: false, id: "installer"});
		} else {
			notify({title: "Installing extension…", icon: "attention", timeout: false, id: "installer"});
		}
	}
	
	if (data.header == "installed") {
		reloadAfterRestart = true;
		title = (data.content.extension) ? titleForExtension(data.content.extension) : false;
		if (title) {
			notify({title: title+" installed", message: "Restarting Beocreate 2, please wait…", icon: "attention", timeout: false, id: "installer"});
		} else {
			notify({title: "Installation complete", message: "Restarting Beocreate 2, please wait…", icon: "attention", timeout: false, id: "installer"});
		}
		noConnectionNotifications = true;
		maxConnectionAttempts = 10;
	}
	
	if (data.header == "removing") {
		title = (data.content.extension) ? titleForExtension(data.content.extension) : false;
		if (title) {
			notify({title: "Removing "+title+"…", icon: "attention", timeout: false, id: "installer"});
		} else {
			notify({title: "Removing extension…", icon: "attention", timeout: false, id: "installer"});
		}
	}
	
	if (data.header == "removed") {
		reloadAfterRestart = true;
		title = (data.content.extension) ? titleForExtension(data.content.extension) : false;
		if (title) {
			notify({title: title+" removed", message: "Restarting Beocreate 2, please wait…", icon: "attention", timeout: false, id: "installer"});
		} else {
			notify({title: "Extension removed", message: "Restarting Beocreate 2, please wait…", icon: "attention", timeout: false, id: "installer"});
		}
		noConnectionNotifications = true;
		maxConnectionAttempts = 10;
	}
});

var installerSelectedExtension = null;
function showExtensionInfo(extension) {
	if (extensions[extension]) {
		installerSelectedExtension = extension;
		version = "unknown";
		if (extensions[extension].version) {
			version = extensions[extension].version;
		}
		if (extensions[extension].builtIn) {
			ask("extension-info-prompt-built-in", [titleForExtension(extension), version]);
		} else {
			ask("extension-info-prompt-removable", [titleForExtension(extension), version]);
		}
	}
}

function installExtension(extension) {
	if (extension) {
		closeExtensionBrowser();
		send({target: "installer", header: "installExtension", content: {extension: extension}});
	}
}

function removeExtension(input, confirmed) {
	if (input == true || (input && confirmed == true)) {
		if (input != true) installerSelectedExtension = input;
		if (extensions[installerSelectedExtension]) {
			send({target: "installer", header: "removeExtension", content: {extension: installerSelectedExtension}});
			installerSelectedExtension = null;
		}
		ask();
	} else {
		if (installerSelectedExtension && extensions[installerSelectedExtension]) {
			ask("remove-extension-prompt", [titleForExtension(installerSelectedExtension)]);
		}
	}
}

function titleForExtension(extension) {
	if (extensions[extension]) {
		if (extensions[extension].genericTitle) {
			return extensions[extension].genericTitle;
		} else {
			return extensions[extension].title;
		}
	} else {
		return false;
	}
}

function openExtensionBrowser(sourcesOnly) {
	if (sourcesOnly) {
		$(".available-extensions").addClass("sources-only");
	} else {
		$(".available-extensions").removeClass("sources-only");
	}
	send({target: "installer", header: "getAvailableExtensions"});
	showPopupView("extension-browser-popup", null, closeExtensionBrowser);
}

function closeExtensionBrowser() {
	hidePopupView("extension-browser-popup");
}

function updateAll() {
	closeExtensionBrowser();
	send({target: "installer", header: "updateAll"});
}

function updateExtension(extension) {
	send({target: "installer", header: "updateExtension", content: {extension: extension}});
}

return {
	removeExtension: removeExtension,
	installExtension: installExtension,
	showExtensionInfo: showExtensionInfo,
	closeExtensionBrowser: closeExtensionBrowser,
	openExtensionBrowser: openExtensionBrowser,
	updateAll: updateAll,
	updateExtension: updateExtension
}

})();