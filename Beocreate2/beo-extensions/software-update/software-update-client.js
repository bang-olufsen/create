var software_update = (function() {

var mostRecentTrack = null;
var mostRecentVersion = 0;
var versions = {};
var errorsChecking = 0;

$(document).on("general", function(event, data) {
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "software-update") {
			
			$("#earlier-updates").addClass("hidden");
		}
	}
	
});

$(document).on("software-update", function(event, data) {
	
	if (data.header == "checking" || data.header == "updateList") {
		if (data.content && data.content.checking) {
			$(".checking-for-update").removeClass("hidden");
			$(".update-check-error").addClass("hidden");
			$(".no-update-available").addClass("hidden");
		} else {
			$(".checking-for-update").addClass("hidden");
			if (errorsChecking && !mostRecentTrack && checkedSuccessfully <= 2) {
				$(".update-check-error").removeClass("hidden");
			} else if (!mostRecentTrack) {
				$(".no-update-available").removeClass("hidden");
				$(".software-update-available").addClass("hidden");
			}
		}
	}
	
	if (data.header == "updateList") {
		if (data.content && data.content.versions) {
			versions = data.content.versions;
			mostRecentTrack = null;
			mostRecentVersion = 0;
			errorsChecking = 0;
			checkedSuccessfully = 0;
			for (track in versions) {
				if (versions[track].error) errorsChecking++;
				if (versions[track].lastChecked) checkedSuccessfully++;
				if (versions[track].version) {
					if (parseInt(versions[track].version) > mostRecentVersion) {
						mostRecentVersion = parseInt(versions[track].version);
						mostRecentTrack = track;
					}
				}
			}
			if (mostRecentTrack) {
				if (mostRecentTrack == "experimental") {
					$("#main-pre-release-warning").removeClass("hidden");
				} else {
					$("#main-pre-release-warning").addClass("hidden");
				}
				menuOptions = {
					value: mostRecentVersion,
					static: true
				}
				if ($("body").hasClass("hifiberry-os")) {
					menuOptions.label = "HiFiBerryOS";
					menuOptions.icon = extensions["product-information"].assetPath+"/symbols-black/hifiberry.svg"
				} else {
					menuOptions.label = "Beocreate 2";
					menuOptions.icon = extensions["product-information"].assetPath+"/symbols-black/create.svg"
				}
				$("#update-available-container").empty();
				$("#update-available-container").append(beo.createMenuItem(menuOptions));
				
				$("#update-release-notes").html(generateMarkupForUpdate(mostRecentTrack));
				$(".software-update-available").removeClass("hidden");
			}
			
			$("#earlier-updates").addClass("hidden");
			$("#earlier-updates-container").empty();
			for (track in versions) {
				if (track != mostRecentTrack) {
					//if (versions[track].version) {
					if (versions[track].version && parseInt(versions[track].version) != mostRecentVersion) {
						$("#earlier-updates").removeClass("hidden");
						menuOptions = {
							value: versions[track].version,
							label: getTrackName(track),
							onclick: "software_update.showEarlierUpdate('"+track+"');"
						}
						if ($("body").hasClass("hifiberry-os")) {
							menuOptions.icon = extensions["product-information"].assetPath+"/symbols-black/hifiberry.svg"
						} else {
							menuOptions.icon = extensions["product-information"].assetPath+"/symbols-black/create.svg"
						}
						
						$("#earlier-updates-container").append(beo.createMenuItem(menuOptions));
					}
				}
			}
		}
	}
	
	
	if (data.header == "badge") {
		if (data.content && data.content.badge) {
			$(".software-update-badge").text("1").addClass("badge");
		} else {
			$(".software-update-badge").text("").removeClass("badge");
		}
	}
	
	if (data.header == "autoUpdateMode") {
		if (data.content.mode != undefined) {
			$(".auto-update-mode-selector > .menu-item").removeClass("checked");
			updateMode = null;
			switch (data.content.mode) {
				case "critical":
					$("#auto-update-critical").addClass("checked");
					updateMode = "Critical only";
					break;
				case "stable":
					$("#auto-update-stable").addClass("checked");
					updateMode = "Regular";
					break;
				case "latest":
					$("#auto-update-latest").addClass("checked");
					updateMode = "Quick";
					break;
				case "experimental":
					updateMode = "Pre-release";
					break;
				case false:
					updateMode = "Off";
					break;
			}
			if (updateMode) {
				$(".auto-update-mode").text(updateMode);
			}
			if (data.content.showExperimental) {
				$("#show-experimental-updates").removeClass("hidden");
			} else {
				$("#show-experimental-updates").addClass("hidden");
			}
		}
	}
	
	if (data.header == "updateAvailable" && data.content.version) {
		$(".checking-for-update").addClass("hidden");
		newVersion = data.content.version;
		menuOptions = {
			value: newVersion,
			static: true
		}
		if ($("body").hasClass("hifiberry-os")) {
			menuOptions.label = "HiFiBerryOS";
			menuOptions.icon = extensions["product-information"].assetPath+"/symbols-black/hifiberry.svg"
		} else {
			menuOptions.label = "Beocreate 2";
			menuOptions.icon = extensions["product-information"].assetPath+"/symbols-black/create.svg"
		}
		
		$(".no-update-available").addClass("hidden");
		$(".software-update-available").removeClass("hidden");
		$(".update-check-error").addClass("hidden");
		$("#update-available-container").empty();
		$("#update-available-container").append(beo.createMenuItem(menuOptions));
		
		$("#update-release-notes").empty();
		
	}
	
	if (data.header == "upToDate") {
		$(".checking-for-update").addClass("hidden");
		$(".no-update-available").removeClass("hidden");
		$(".software-update-available").addClass("hidden");
		$(".update-check-error").addClass("hidden");
		newVersion = null;
	}
	
	if (data.header == "errorChecking") {
		$(".checking-for-update").addClass("hidden");
		$(".no-update-available").addClass("hidden");
		$(".software-update-available").addClass("hidden");
		$(".update-check-error").removeClass("hidden");
		newVersion = null;
	}
	
	if (data.header == "updating") {
		notifyOptions = {title: "Updating product...", timeout: false, icon: "attention"};
		if (data.content.progress != undefined) {
			notifyOptions.progress = data.content.progress;
		}
		switch (data.content.phase) {
			case "download":
				notifyOptions.message = "Downloading...";
				break;
			case "extractingFirmware":
			case "resizing":
			case "extractingKernel":
				notifyOptions.message = "Unpacking, this will take some time...";
				break;
			case "copyingFiles":
				notifyOptions.message = "Moving things over...";
				break;
			case "finalising":
				notifyOptions.message = "Finalising...";
				break;
			case "done":
				notifyOptions.title = "Product updated";
				notifyOptions.message = "The product has been updated and it will now restart to finish the process. This may take some time, please wait.";
				beo.sendToProductView({header: "autoReconnect", content: {status: "updateComplete", systemID: product_information.systemID(), systemName: product_information.systemName()}});
				noConnectionNotifications = true;
				maxConnectionAttempts = 30;
				reloadOnReconnect = true;
				break;
			case "doneSimulation":
				notifyOptions.title = "Product updated";
				notifyOptions.message = "The product update simulation has finished. The product would now restart, in case of a real update. Start Beocreate 2 in non-developer mode to update.";
				notifyOptions.buttonTitle = "Done";
				notifyOptions.buttonAction = "close";
				notifyOptions.icon = null;
				break;
		}
		beo.notify(notifyOptions, "software-update");
	}
	
	if (data.header == "updateError") {
		notifyOptions = {title: "Update unsuccessful", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"};
		if (data.content.reason) {
			switch (data.content.reason) {
				case "downloadError":
					notifyOptions.message = "The update could not be downloaded. Please try again later, or contact support if the problem persists.";
					break;
			}
		}
		beo.notify(notifyOptions, "software-update");
	}
	
	if (data.header == "previousVersion") {
		if (!data.content.previousVersion) {
			$("#previous-version-information").text("Not available");
			$("#restore-previous-version-button").addClass("disabled");
		} else if (data.content.previousVersion == true) {
			$("#previous-version-information").text("Available");
			$("#restore-previous-version-button").removeClass("disabled");
		} else {
			$("#previous-version-information").text(data.content.previousVersion);
			$("#restore-previous-version-button").removeClass("disabled");
		}
	}
	
	if (data.header == "restoringPreviousVersion") {
		if (data.content.stage == "start") {
			noConnectionNotifications = true;
			maxConnectionAttempts = 30;
			reloadOnReconnect = true;
			beo.notify({title: "Restoring previous version...", message: "The product will restart with the previous software version and settings. If the product name or network settings have changed, you may need to reconnect to the product manually.", timeout: false, icon: "attention"}, "software-update");
		}
		if (data.content.stage == "fail") {
			noConnectionNotifications = false;
			maxConnectionAttempts = 5;
			reloadOnReconnect = false;
			notifyOptions = {title: "Restore unsuccesful", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"};
			if (data.content.reason == "notFound") notifyOptions.message = "Previous version was not found.";
			if (data.content.reason == "unknownPartition") notifyOptions.message = "Unknown backup partition.";
			beo.notify(notifyOptions, "software-update");
		}
	}
});

function generateMarkupForUpdate(track) {
	if (versions[track] && versions[track].releaseNotes) {
		releaseNotes = versions[track].releaseNotes.split("\n");
		openUL = "";
		notesHTML = ""
		for (var i = 0; i < releaseNotes.length; i++) {
			if (!(i == 0 && releaseNotes[i].trim() == versions[track].version)) {
				if (releaseNotes[i].trim().charAt(0) == "-") {
					// A dash is a list item.
					if (!openUL) {
						openUL += "\n<ul>";
					}
					openUL += "\n<li>"+releaseNotes[i].trim().substring(2)+"</li>";
					//console.log(openUL);
				} else {
					// Normal lines make p elements.
					if (openUL) {
						openUL += "\n</ul>";
						notesHTML += openUL;
						openUL = "";
					}
					notesHTML += "<p>"+releaseNotes[i].trim()+"</p>";
				}
			}
		}
		if (openUL) {
			openUL += "\n</ul>";
			notesHTML += openUL;
		}
		return notesHTML
	} else {
		return "<p>No release notes included.</p>";
	}
}

function getTrackName(track) {
	switch (track) {
		case "critical":
			return "Critical Release";
			break;
		case "stable":
			return "Regular Release";
			break;
		case "latest":
			return "Latest Release";
			break;
		case "experimental":
			return "Pre-Release";
			break;
	}
}

function showEarlierUpdate(track) {
	if (versions[track].version) {
		$("#earlier-release-notes").html(generateMarkupForUpdate(track));
		if (track == "experimental") {
			$("#earlier-pre-release-warning").removeClass("hidden");
		} else {
			$("#earlier-pre-release-warning").addClass("hidden");
		}
		beo.ask("earlier-update-info-prompt", [getTrackName(track)], [function() {
			install(track);
		}]);
	}
}


function install(track = mostRecentTrack) {
	beo.sendToProduct("software-update", "install", {track: mostRecentTrack});
}

function setAutoUpdate(mode) {
	beo.ask();
	beo.sendToProduct("software-update", {header: "autoUpdateMode", content: {mode: mode}});
}

function setManualUpdateMode(mode) {
	beo.sendToProduct("software-update", {header: "manualUpdateMode", content: {mode: mode}});
}

function restore(confirmed) {
	if (!confirmed) {
		beo.ask("restore-previous-version-prompt");
	} else {
		beo.ask();
		beo.sendToProduct("software-update", {header: "restorePreviousVersion"});
	}
}


return {
	install: install,
	setAutoUpdate: setAutoUpdate,
	setManualUpdateMode: setManualUpdateMode,
	restore: restore,
	showEarlierUpdate: showEarlierUpdate
};

})();