var daisy_chain = (function() {

daisyChainEnabled = false;
skipStoringAdjustments = false;
soundAdjustmentsStored = false;
var daisyChainSwipe;
assistantStep = 0;

$(document).on("general", function(event, data) {

	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "daisy-chain") {
			if (!daisyChainSwipe) {
				daisyChainSwipe = new Swipe(document.getElementById('daisy-chain-swipe'), {speed: 500});
			}
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
			$("#daisy-chain .chained").removeClass("hidden");
			$("#daisy-chain .not-chained").addClass("hidden");
			$("#daisy-chain-toggle").addClass("on");
		} else {
			daisyChainEnabled = false;
			$("#daisy-chain .chained").addClass("hidden");
			$("#daisy-chain .not-chained").removeClass("hidden");
			$("#daisy-chain-toggle").removeClass("on");
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
		beo.showPopupView("daisy-chain-assistant");
		daisyChainSwipe.setup({
			startSlide: 0,
			draggable: true,
			continuous: false,
			disableScroll: false,
			stopPropagation: false,
			callback: function(index, elem, dir) {
				$("#daisy-chain-assistant-button").addClass("disabled");
			},
			transitionEnd: function(index, elem) {
				previousAssistantStep = assistantStep;
				assistantStep = index;
				switch (assistantStep) {
					case 0:
						buttonText = "Set Up This Amplifier";
						$("#daisy-chain-assistant-button").removeClass("disabled");
						if (!skipStoringAdjustments && soundAdjustmentsStored) daisyChainSwipe.slide(1);
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
						$("#daisy-chain-assistant-button").removeClass("disabled");
						if (skipStoringAdjustments && previousAssistantStep == 0) daisyChainSwipe.slide(3);
						break;
					case 2:
						beo.sendToProductView({header: "autoReconnect", content: {status: "daisyChainShutdown", systemID: product_information.systemID(), systemName: product_information.systemName()}});
						beo.notify({title: "Shutting down product…", message: "Wait until the shutdown is complete before unplugging.", icon: "attention", timeout: 20, id: "daisyChain"});
						noConnectionNotifications = true;
						
						buttonText = "Raspberry Pi Moved";
						$("#daisy-chain-assistant-button").removeClass("disabled");
						console.log(skipStoringAdjustments, previousAssistantStep);
						if (skipStoringAdjustments && previousAssistantStep == 3) daisyChainSwipe.slide(0);
						break;
					case 3:
						buttonText = "Optical Cable Connected";
						$("#daisy-chain-assistant-button").removeClass("disabled");
						break;
					case 4:
						buttonText = "Finish Chaining Setup";
						// Start connecting here.
						if (connected) {
							$("#daisy-chain-assistant-button").removeClass("disabled");
						} else if (!connecting) {
							beoCom.connectToCurrentProduct();
						}
						break;
				}
				$("#daisy-chain-assistant-button").text(buttonText);
				beo.sendToProduct("daisy-chain", {header: "assistantProgress", content: {step: assistantStep, skipStoringAdjustments: skipStoringAdjustments}});
			}
		});
		skipStoringAdjustments = false;
		soundAdjustmentsStored = false;
		daisyChainSwipe.slide(0);
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
				daisyChainSwipe.slide(3);
				$("#daisy-chain-assistant .no-preparation").removeClass("hidden");
				$("#daisy-chain-assistant .preparation").addClass("hidden");
				$("#daisy-chain-assistant .preparation-light").addClass("fade");
			} else {
				skipStoringAdjustments = false;
				daisyChainSwipe.next();
				$("#daisy-chain-assistant .no-preparation").addClass("hidden");
				$("#daisy-chain-assistant .preparation").removeClass("hidden");
				$("#daisy-chain-assistant .preparation-light").removeClass("fade");
			}
			break;
		case 1:
		case 2:
		case 3:
			daisyChainSwipe.next();
			break;
		case 4:
			beo.hidePopupView("daisy-chain-assistant");
//			beo.showExtension("channels");
			break;
	}
	
}



return {
	toggleEnabled: toggleEnabled,
	nextStep: nextStep,
	cancelAssistant: cancelAssistant
}

})();