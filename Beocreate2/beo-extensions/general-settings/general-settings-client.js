var general_settings = (function() {

$(document).on("general", function(event, data) {
	if (data.header == "activatedExtension") {
		if (data.content.extension == "general-settings") {
			// Check if sections have content, hide those that do not.
			if (document.querySelectorAll("#general-settings .beo-dynamic-menu.services > *").length > 0) {
				document.getElementById("general-services-title").classList.remove("hidden");
			} else {
				document.getElementById("general-services-title").classList.add("hidden");
			}
			
			if (document.querySelectorAll("#general-settings .beo-dynamic-menu.more > *").length > 0) {
				document.getElementById("general-more-title").classList.remove("hidden");
			} else {
				document.getElementById("general-more-title").classList.add("hidden");
			}
		}
	}
	
});


function restartProduct() {
	beo.ask();
	beo.send({target: "product-information", header: "restartProduct"});
}

function shutdownProduct() {
	beo.ask();
	beo.send({target: "product-information", header: "shutdownProduct"});
}

interactPowerOption = null;
function interactSetup(stage, data) {
	switch (stage) {
		case "setup":
			if (data && data.option) {
				interactSetup("option", data.option);
			} else {
				interactSetup("option", null);
			}
			$("#interact-power-setup-save").addClass("disabled");
			beo.ask("interact-power-setup");
			break;
		case "option":
			interactPowerOption = data;
			$("#interact-power-setup-options .menu-item").removeClass("checked");
			if (data) {
				$('#interact-power-setup-options .menu-item[data-option="'+data+'"]').addClass("checked");
				$("#interact-power-setup-save").removeClass("disabled");
			}
			break;
		case "save":
			beo.ask();
			window.interact.saveAction("general-settings", "power", {option: interactPowerOption});
			break;
		case "preview":
			if (data.option == "shutdown") return "Shut down Raspberry Pi";
			if (data.option == "restart") return "Restart Raspberry Pi";
			break;
	}
}

interactDictionary = {
	actions: {
		power: {
			name: "Power",
			icon: "common/symbols-black/power.svg",
			once: true,
			setup: function(data) { interactSetup("setup", data) }, 
			preview: function(data) { return interactSetup("preview", data) },
			illegalWith: ["triggers/general-settings/systemBoot"]
		}
	},
	triggers: {
		systemBoot: {
			name: "Product Startup",
			icon: "common/symbols-black/power.svg",
			once: true,
			illegalWith: ["actions/general-settings/power"]
		}
	}
}

return {
	restartProduct: restartProduct,
	shutdownProduct: shutdownProduct,
	interactDictionary: interactDictionary,
	interactSetup: interactSetup
};

})();
