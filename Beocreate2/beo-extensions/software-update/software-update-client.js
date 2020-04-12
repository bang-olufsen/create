var software_update = (function() {

var newVersion = null;

$(document).on("general", function(event, data) {
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "software-update") {
			$(".checking-for-update").removeClass("hidden");
		}
	}
	
});

$(document).on("software-update", function(event, data) {
	
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
					updateMode = "Security only";
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
					updateMode = "Experimental";
					break;
				case false:
					updateMode = "Off";
					break;
			}
			if (updateMode) {
				$(".auto-update-mode").text(updateMode);
			}
			if (data.content.manualMode && data.content.manualMode != data.content.mode) {
				$("#manual-update-track").removeClass("hidden");
				manualMode = "Unknown";
				switch (data.content.manualMode) {
					case "critical":
						manualMode = "Security only";
						break;
					case "stable":
						manualMode = "Regular";
						break;
					case "latest":
						manualMode = "Quick";
						break;
					case "experimental":
						manualMode = "Experimental";
						break;
				}
				$("#manual-update-track .menu-value").text(manualMode);
			} else {
				$("#manual-update-track").addClass("hidden");
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
		$("#update-available-container").empty();
		$("#update-available-container").append(beo.createMenuItem(menuOptions));
		
		$("#update-release-notes").empty();
		if (data.content.releaseNotes) {
			releaseNotes = data.content.releaseNotes.split("\n");
			openUL = "";
			notesHTML = ""
			for (var i = 0; i < releaseNotes.length; i++) {
				if (!(i == 0 && releaseNotes[i].trim() == newVersion)) {
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
			$("#update-release-notes").append(notesHTML);
		} else {
			$("#update-release-notes").html("<p>No release notes included.</p>");
		}
	}
	
	if (data.header == "upToDate") {
		$(".checking-for-update").addClass("hidden");
		$(".no-update-available").removeClass("hidden");
		$(".software-update-available").addClass("hidden");
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
			beo.notify({title: "Restoring previous version...", message: "The product will restart with the previous software version and settings. If the product name or network settings have changed, you may need to reconnect to the product manually.", timeout: false, icon: "attention", "software-update");
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


function install() {
	beo.send({target: "software-update", header: "install"});
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
	restore: restore
};

})();