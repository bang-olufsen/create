var daisy_chain = (function() {

daisyChainEnabled = false;
skipStoringAdjustments = false;
soundAdjustmentsStored = false;
assistantStep = 0;

var daisyChainModeChecked = false;
$(document).on("general", function(event, data) {

	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "daisy-chain") {
			
		} else if (extensions[data.content.extension].parentMenu == "sound" || data.content.extension == "sound") {
			if (!daisyChainModeChecked) beo.sendToProduct("daisy-chain", {header: "getSettings"});
			daisyChainModeChecked = true;
		}
	}
	
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			$("#daisy-chain-waiting-for-master").addClass("hidden");
			$("#daisy-chain-close-button").removeClass("disabled");
			if (assistantStep == 4) {
				$("#daisy-chain-assistant-button").removeClass("disabled");
			}
		}
		if (data.content.status == "disconnected") {
			$("#daisy-chain-waiting-for-master").removeClass("hidden");
			$("#daisy-chain-close-button").addClass("disabled");
			if (assistantStep == 4) {
				$("#daisy-chain-assistant-button").addClass("disabled");
			}
		}
	}
	
});

$(document).on("daisy-chain", function(event, data) {

	if (data.header == "daisyChainSettings") {
		if (data.content.daisyChainEnabled) {
			daisyChainEnabled = true;
			$("#daisy-chain .chained, .show-when-daisy-chained").removeClass("hidden");
			$("#daisy-chain .not-chained").addClass("hidden");
			$("#daisy-chain-toggle").addClass("on");
			$(".daisy-chain-status-text").text("On");
		} else {
			daisyChainEnabled = false;
			$("#daisy-chain .chained, .show-when-daisy-chained").addClass("hidden");
			$("#daisy-chain .not-chained").removeClass("hidden");
			$("#daisy-chain-toggle").removeClass("on");
			$(".daisy-chain-status-text").text("");
		}
		if (data.content.daisyChainDisabledReason) {
			$("#daisy-chain-auto-off").removeClass("hidden");
			switch (data.content.daisyChainDisabledReason) {
				case "dspInstalled":
					reasonText = "a DSP program was installed or upgraded";
					break;
				case "equaliserChanged":
					reasonText = "speaker equaliser or crossover settings were changed";
					break;
				case "channelsChanged":
					reasonText = "speaker levels or delay settings were changed";
					break;
				case "soundPresetSelected":
					reasonText = "another sound preset was selected";
					break;
			}
			$("#daisy-chain-auto-off-reason").text(reasonText);
		} else {
			$("#daisy-chain-auto-off").addClass("hidden");
		}
	}
	
	
});

function toggleEnabled() {
	if (!daisyChainEnabled) {
		beo.wizard("#daisy-chain-wizard");
		beo.showPopupView("daisy-chain-assistant");
		showStep(0);
		skipStoringAdjustments = false;
		soundAdjustmentsStored = false;
	
		beo.sendToProduct("daisy-chain", {header: "startAssistant"});
	} else {
		beo.sendToProduct("daisy-chain", {header: "setDaisyChainEnabled", content: {enabled: false}});
	}
}

function cancelAssistant() {
	beo.hidePopupView("daisy-chain-assistant");
}

function nextStep(skipAction) {
	switch (assistantStep) {
		case 0:
			if (skipAction) {
				skipStoringAdjustments = true;
				showStep(3);
				$("#daisy-chain-assistant .no-preparation").removeClass("hidden");
				$("#daisy-chain-assistant .preparation").addClass("hidden");
				$("#daisy-chain-assistant .preparation-light").addClass("fade");
			} else {
				skipStoringAdjustments = false;
				showStep(assistantStep+1);
				$("#daisy-chain-assistant .no-preparation").addClass("hidden");
				$("#daisy-chain-assistant .preparation").removeClass("hidden");
				$("#daisy-chain-assistant .preparation-light").removeClass("fade");
			}
			break;
		case 1:
		case 2:
		case 3:
			showStep(assistantStep+1);
			break;
		case 4:
			beo.hidePopupView("daisy-chain-assistant");
			break;
	}
}

function showStep(step = null) {
	previousStep = assistantStep;
	if (step != null) assistantStep = step;
	skipToStep = null;
	switch (assistantStep) {
		case 0:
			buttonText = "Set Up This Amplifier";
			showScreen = "daisy-chain-start";
			break;
		case 1:
			if (!soundAdjustmentsStored) {
				buttonText = "Shut Down Product";
			} else {
				buttonText = "Power Is Unplugged";
			}
			if (skipStoringAdjustments) {
				$("#daisy-chain-assistant .no-preparation").removeClass("hidden");
				$("#daisy-chain-assistant .preparation").addClass("hidden");
			} else {
				soundAdjustmentsStored = true;
				$("#daisy-chain-assistant .no-preparation").addClass("hidden");
				$("#daisy-chain-assistant .preparation").removeClass("hidden");
			}
			if (skipStoringAdjustments && previousStep == 0) skipToStep = 3;
			showScreen = "daisy-chain-stored";
			break;
		case 2:
			buttonText = "Raspberry Pi Moved";
			beo.sendToProductView({header: "autoReconnect", content: {status: "daisyChainShutdown", systemID: product_information.systemID(), systemName: product_information.systemName()}});
			beo.notify({title: "Shutting down product…", message: "Wait until the shutdown is complete before unplugging.", icon: "attention", timeout: 20, id: "daisyChain"});
			beoCom.setConnectionOptions({notifications: false});
			showScreen = "daisy-chain-move-pi";
			break;
		case 3:
			buttonText = "Optical Cable Connected";
			showScreen = "daisy-chain-connect-together";
			break;
		case 4:
			buttonText = "Finish Chaining Setup";
			showScreen = "daisy-chain-power-up";
			// Start connecting here.
			if (!connected) {
				$("#daisy-chain-assistant-button").addClass("disabled");
				if (!connecting) beoCom.connectToCurrentProduct();
			} 
			break;
	}
	beo.sendToProduct("daisy-chain", {header: "assistantProgress", content: {step: assistantStep, skipStoringAdjustments: skipStoringAdjustments}});
	if (skipToStep == null) {
		$("#daisy-chain-assistant-button").text(buttonText);
		beo.wizard("#daisy-chain-wizard", "#"+showScreen, "#daisy-chain-assistant-button");
	} else {
		showStep(skipToStep);
	}
}



return {
	toggleEnabled: toggleEnabled,
	nextStep: nextStep,
	cancelAssistant: cancelAssistant
}

})();