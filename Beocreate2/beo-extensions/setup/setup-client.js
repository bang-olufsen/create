var setup = (function() {

setupFlow = [];
doingPostSetup = false;
simulatingSetup = false;

extensions["setup-finish"] = {
	assetPath: extensions.setup.assetPath,
	deepMenu: [],
	icon: "assistant.svg",
	id: "setup-finish",
	title: "Setup Finished"
}

$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			beo.send({target: "setup", header: "getSetupStatus"});
		}
	}
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "setup" || data.content.extension == "setup-finish") {
			$(".setup-navigation").addClass("start-finish");
		} else {
			$(".setup-navigation").removeClass("start-finish");
		}
		if (setupFlow.length != 2) {
			for (var i = 0; i < setupFlow.length; i++) {
				if (setupFlow[i].extension == data.content.extension) {
					if (setupFlow[i].allowAdvancing) {
						$("#assistant-button").removeClass("disabled");
					} else {
						$("#assistant-button").addClass("disabled");
					}
				}
			}
		}
	}
	
});

$(document).on("setup", function(event, data) {
	if (data.header == "setupStatus") {
		if (data.content.setupFlow.length == 0) {
			setupFlow = [];
			// No setup flow, restore UI state.
			if (data.content.setup == "finished") {
				$("body").css("opacity", "0");
				setTimeout(function() {
					window.location.reload();
				}, 550);
			} else {
				$("body").removeClass("setup");
				if (data.content.selectedExtension && data.content.selectedExtension != "setup" && data.content.selectedExtension != "setup-finish") {
					beo.restoreState(data.content.selectedExtension);
				} else {
					beo.restoreState("product-information");
				}
			}
		} else {
			if (data.content.setup == true) {
				$("body").addClass("setup");
				setupFlow = data.content.setupFlow;
				if (!historyConstructed || data.content.reset) {
					extensionHistory = [];
					for (var i = 0; i < setupFlow.length; i++) {
						extensionHistory.push(setupFlow[i].extension);
					}
					beo.showExtensionWithHistory(extensionHistory, data.content.selectedExtension);
				} else {
					beo.showExtension(data.content.selectedExtension);
				}
			}
			
			if (data.content.firstTime || data.content.firstTime == undefined) {
				$("#setup .menu-content.first-time").removeClass("hidden");
				$("#setup .menu-content.additional-setup").addClass("hidden");
			} else {
				$("#setup .menu-content.first-time").addClass("hidden");
				$("#setup .menu-content.additional-setup").removeClass("hidden");
			}
			
			if (data.content.postSetup) {
				$("#setup-finish .post-setup").removeClass("hidden");
				$("#setup-finish .no-post-setup").addClass("hidden");
			}
			
			$(".setup-list").empty();
			for (var i = 1; i < setupFlow.length-1; i++) {
				$(".setup-list").append("<li>"+extensions[setupFlow[i].extension].title+"</li>");
			}
		}
	}
	
	if (data.header == "showExtension") {
		if (data.content.extension) {
			changeExtension(data.content.extension);
		}
	}
	
	if (data.header == "extensionChanged") {
		if (data.content.selectedExtension) {
			changeExtension(data.content.selectedExtension);
		}
	}
	
	if (data.header == "doingPostSetup") {
		if (data.content.now) {
			doingPostSetup = true;
			beo.notify({title: "Setting up product...", message: "Please wait, this may take some time", icon: "attention", timeout: false});
			noConnectionNotifications = true;
			maxConnectionAttempts = 10;
		} else {
			if (doingPostSetup) {
				beo.notify();
				noConnectionNotifications = false;
				maxConnectionAttempts = 5;
			}
		}
	}
	
	if (data.header == "assistantButton") {
		if (data.content.lastStep) {
			$("#assistant-button").text("Finish Setup");
		} else {
			$("#assistant-button").text("Next Step");
		}
	}
	
	if (data.header == "allowAdvancing") {
		if (data.content.extension) {
			for (var i = 0; i < setupFlow.length; i++) {
				if (setupFlow[i].extension == data.content.extension) {
					setupFlow[i].allowAdvancing = (data.content.allow) ? true : false;
					if (setupFlow[i].extension == selectedExtension) {
						if (setupFlow[i].allowAdvancing) {
							$("#assistant-button").removeClass("disabled");
						} else {
							$("#assistant-button").addClass("disabled");
						}
					}
				}
			}
		}
	}
});

function changeExtension(extension) {
	if (selectedExtension != extension) {
		selectedExtensionIndex = 0;
		newExtensionIndex = 0;
		for (var i = 0; i < setupFlow.length; i++) {
			if (setupFlow[i].extension == selectedExtension) selectedExtensionIndex = i;
			if (setupFlow[i].extension == extension) newExtensionIndex = i;
		}
		//if (extension == "setup-finish") extension = "setup";
		if (newExtensionIndex > selectedExtensionIndex) {
			beo.showExtension(extension, "left");
		} else {
			beo.showExtension(extension, "right");
		}
	}
}

function nextStep() {
	if (!simulatingSetup) {
		beo.send({target: "setup", header: "nextStep"});
	} else {
		beo.showExtension("speaker-preset", "left");
		$("#assistant-button").text("Next Step");
		$("#assistant-button").removeClass("disabled");
	}
}

function simulateSetup() {
	if (!document.body.classList.contains("setup")) {
		beo.showExtension("setup");
		$("#assistant-button").text("Begin Setup");
		$("#assistant-button").removeClass("disabled");
		document.body.classList.add("setup");
		simulatingSetup = true;
	} else {
		document.body.classList.remove("setup");
		beo.showExtension("product-information");
		simulatingSetup = false;
	}
}


function generateDotBackground() {
	
	// Regenerate a random background pattern.
	$("#setup .background").empty();
	colours = ["red", "yellow", "green", "blue"];
	for (var i = 0; i < 20; i++) {
		randomColour = colours[Math.round(Math.random()*3)];
		//hRandom = 16*(Math.round(Math.random()*5)+1);
		hRandom = Math.round(Math.random()*80)+10;
		vRandom = Math.round(Math.random()*80)+10;
		$("#setup .background").append('<img class="create-dot" src="'+$("#setup").attr("data-asset-path")+'/create-dot-animate-'+randomColour+'.svg" style="top: '+vRandom+'%; left: '+hRandom+'%;">');
	}
	
}

return {
	nextStep: nextStep,
	simulateSetup: simulateSetup
}

})();