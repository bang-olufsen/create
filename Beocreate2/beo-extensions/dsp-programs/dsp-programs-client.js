var dsp_programs = (function() {

var programs = {};
var currentProgram = {};
var previewedDSPProgram = null;
var muteUnknown = false;
var autoUpgrade = false;
var dspConnected = false;
var dspResponding = false;
var dspUpgrade = false;


$(document).on("dsp-programs", function(event, data) {
	if (data.header == "programPreview") {
		
		$(".dsp-program-metadata").empty();
		if (data.content.metadata) {
			metadata = data.content.metadata;
			$(".no-volume-control-register").removeClass("hidden");
			$(".no-sample-rate").removeClass("hidden");
			$(".no-checksum").removeClass("hidden");
			if (metadata.sampleRate) $(".no-sample-rate").addClass("hidden");
			if (metadata.checksum) $(".no-checksum").addClass("hidden");
			if (metadata.volumeControlRegister) $(".no-volume-control-register").addClass("hidden");
			
			for (item in metadata) {
				
				menuOptions = {
					label: item,
					value: metadata[item].value[0],
					static: true
				};
				$(".dsp-program-metadata").append(beo.createMenuItem(menuOptions));
				
			}
			
			$(".no-dsp-metadata").addClass("hidden");
			$(".dsp-program-metadata-wrap").removeClass("hidden");
			$("#dsp-program-preview-popup footer .reinstall").removeClass("disabled");
		} else {
			$(".no-dsp-metadata").removeClass("hidden");
			$(".dsp-program-metadata-wrap").addClass("hidden");
			$("#dsp-program-preview-popup footer .reinstall").addClass("disabled");
		}
		
		$("#dsp-program-preview-popup footer .reinstall, #dsp-program-preview-popup footer .upgrade, #dsp-program-preview-popup footer .install").addClass("hidden");
		$(".dsp-upgrade-text").addClass("hidden");
		
		if (data.content.current) {
			$("#dsp-program-preview-popup footer .reinstall").removeClass("hidden");
		} else {
			if (data.content.id == dspUpgrade) {
				$("#dsp-program-preview-popup footer .upgrade").removeClass("hidden");
				$(".dsp-upgrade-text").removeClass("hidden");
			} else {
				$("#dsp-program-preview-popup footer .install").removeClass("hidden");
			}
		}
		
		previewedDSPProgram = data.content.id;
		
		if (data.content.name) {
			$(".dsp-program-information h1").text(data.content.name);
		} else {
			$(".dsp-program-information h1").text("Unknown Program");
		}
		if (data.content.version) {
			$(".dsp-program-information p").text(beo.translatedString("Version", "version", "dsp-programs")+" "+data.content.version);
		} else {
			$(".dsp-program-information p").text("");
		}
		
		beo.showPopupView("dsp-program-preview-popup");
	}
	
	if (data.header == "showCurrent") {
		currentProgram = data.content;
		if (data.content.name) {
			// Current program.
			$("#dsp-programs .current-dsp-program-name").text(data.content.name);
		} else {
			$("#dsp-programs .current-dsp-program-name").text("Unknown Program");
		}
		if (data.content.version) {
			// Current program.
			$("#dsp-programs .current-dsp-program-version").text("Version "+data.content.version);
		} else {
			$("#dsp-programs .current-dsp-program-version").text("");
		}
		if (data.content.dspConnected != undefined) {
			dspConnected = data.content.dspConnected;
		}
		if (data.content.dspResponding != undefined) {
			dspResponding = data.content.dspResponding;
		}
		if (dspConnected && dspResponding) {
			$("#dsp-error-wrap").addClass("hidden");
			$("#current-dsp-program-wrap").removeClass("hidden");
		} else {
			if (!dspConnected) {
				$("#dsp-problem-description").text("unable to connect");
			} else if (!dspResponding) {
				$("#dsp-problem-description").text("not responding");
			}
			$("#dsp-error-wrap").removeClass("hidden");
			$("#current-dsp-program-wrap").addClass("hidden");
		}
	}
	
	if (data.header == "status") {
		
		if (data.content.dspConnected != undefined) {
			dspConnected = data.content.dspConnected;
		}
		if (data.content.dspResponding != undefined) {
			dspResponding = data.content.dspResponding;
		}
		if (dspConnected && dspResponding) {
			$("#dsp-error-wrap").addClass("hidden");
			$("#current-dsp-program-wrap").removeClass("hidden");
		} else {
			if (!dspConnected) {
				$("#dsp-problem-description").text("unable to connect");
			} else if (!dspResponding) {
				$("#dsp-problem-description").text("not responding");
			}
			$("#dsp-error-wrap").removeClass("hidden");
			$("#current-dsp-program-wrap").addClass("hidden");
		}
	}
	
	if (data.content && data.content.dspUpgrade != undefined) {
		dspUpgrade = data.content.dspUpgrade;
		if (!dspUpgrade) {
			$(".dsp-program-item.upgrade .menu-value").text("").removeClass("button");
		}
	}
	
	if (data.header == "allPrograms") {
		if (data.content.programs) {
			$(".dsp-program-list").empty();
			programs = data.content.programs;
			for (program in programs) {
					menuOptions = {
						label: programs[program].name,
						onclick: "dsp_programs.getPreview('"+program+"');",
						classes: ["dsp-program-item"],
						data: {"data-dsp-program-id": program},
						icon: extensions['dsp-programs'].assetPath+"/symbols-black/dsp-file.svg"
					}
					// Show version if a program of the same name is loaded or otherwise exists, to differentiate them.
					showVersion = false;
					if (currentProgram.name && currentProgram.name == programs[program].name) {
						showVersion = true;
					} else {
						nameCount = -1;
						for (prg in programs) {
							if (programs[prg].name == programs[program].name) nameCount++;
						}
						if (nameCount) showVersion = true;
					}
					if (showVersion && programs[program].version) menuOptions.value = "Version "+programs[program].version;
					
					if (program == dspUpgrade) {
						menuOptions.classes.push("upgrade");
						menuOptions.value = "Upgrade";
						menuOptions.valueAsButton = true;
					}
					$(".dsp-program-list").append(beo.createMenuItem(menuOptions));
			}
		}
	}
	
	if (data.header == "flashEEPROM") {
		if (data.content.status == "flashing") {
			beo.notify({title: "Installing DSP program...", message: "Writing to memory...", icon: "attention", timeout: false});
		}
		if (data.content.status == "fail") {
			beo.notify({title: "DSP program installation failed", message: "Please try again. If the problem persists, contact support.", icon: "common/symbols-colour/warning-yellow.svg", timeout: false, buttonAction: "close", buttonTitle: "Close"});
		}
	}
	
	if (data.header == "checkEEPROM") {
		if (data.content.status == "checking") {
			beo.notify({title: "Installing DSP program...", message: "Checking memory...", icon: "attention", timeout: false});
		}
		if (data.content.status == "success") {
			beo.notify({title: "DSP program installed", icon: "common/symbols-black/checkmark-round.svg"});
		}
		if (data.content.status == "fail") {
			beo.notify({title: "DSP program installation failed", message: "Program was succesfully written, but didn't persist in memory. Please try installing the program again. If the problem persists, contact support.", icon: "common/symbols-colour/warning-yellow.svg", timeout: false, buttonAction: "close", buttonTitle: "Close"});
		}
	}
	
	if (data.header == "storeAdjustments") {
		if (data.content.status == "storing") {
			beo.notify({title: "Storing sound adjustments...", message: "This will take a moment", icon: "attention", timeout: false});
		}
		if (data.content.status == "finish") {
			beo.notify({title: "Adjustments stored", icon: "common/symbols-black/checkmark-round.svg"});
		}
		if (data.content.status == "fail") {
			beo.notify({title: "Storing sound adjustments failed", message: "Please try again. If the problem persists, contact support.", icon: "common/symbols-colour/warning-yellow.svg", timeout: false, buttonAction: "close", buttonTitle: "Close"});
		}
	}
	
	if (data.header == "settings") {
		if (data.content.muteUnknownPrograms) {
			muteUnknown = true;
			$("#mute-unknown-enabled-toggle").addClass("on");
		} else {
			muteUnknown = false;
			$("#mute-unknown-enabled-toggle").removeClass("on");
		}
		
		if (data.content.autoUpgrade) {
			autoUpgrade = true;
			$("#auto-upgrade-dsp-toggle").addClass("on");
		} else {
			autoUpgrade = false;
			$("#auto-upgrade-dsp-toggle").removeClass("on");
		}
	}
	
	if (data.header == "configuringSigmaTCP") {
		
		if (data.content.status) {
			if (data.content.status == "start") {
				beo.notify({title: "Configuring system...", icon: "attention", timeout: false});
			} else if (data.content.status == "finish") {
				beo.notify();
			}
		}
	}
	
	if (data.header == "configuringSystem") {
		beo.notify({title: "Setting up...", message: "Please wait...", icon: "attention", timeout: false});
		noConnectionNotifications = true;
		maxConnectionAttempts = 10;
	}
	
	if (data.header == "systemConfigured") {
		beo.notify(false);
	}

});


function getPreview(program) {
	if (!program) program = null;
	beo.send({target: "dsp-programs", header: "getProgramPreview", content: {program: program}});
}

function closePreview() {
	beo.hidePopupView("dsp-program-preview-popup");
}

function reinstallProgram(confirmed) {
	if (!confirmed) {
		beo.ask("reinstall-dsp-program-prompt");
	} else {
		beo.ask();
		beo.hidePopupView("dsp-program-preview-popup");
		beo.send({target: "dsp-programs", header: "installProgram"});
	}
}

function installProgram(confirmed) {
	if (!confirmed) {
		beo.ask("install-dsp-program-prompt");
	} else {
		beo.ask();
		beo.hidePopupView("dsp-program-preview-popup");
		beo.send({target: "dsp-programs", header: "installProgram", content: {program: previewedDSPProgram}});
	}
}

function jumpToSoundPresets() {
	beo.showExtension("sound-preset");
}

function toggleMuteUnknown(confirmed) {
	if (muteUnknown) {
		if (!confirmed) {
			beo.ask("disable-mute-unknown-programs-prompt");
		} else {
			beo.ask();
			beo.send({target: "dsp-programs", header: "muteUnknown", content: {muteUnknown: false}});
		}
	} else {
		// When enabling, just do it.
		beo.send({target: "dsp-programs", header: "muteUnknown", content: {muteUnknown: true}});
	}
}

function toggleAutoUpgrade() {
	if (autoUpgrade) {
		beo.send({target: "dsp-programs", header: "autoUpgrade", content: {autoUpgrade: false}});
	} else {
		beo.send({target: "dsp-programs", header: "autoUpgrade", content: {autoUpgrade: true}});
	}
}

function storeAdjustments(confirmed) {
	if (!confirmed) {
		beo.ask("store-sound-adjustments-prompt");
	} else {
		beo.ask();
		beo.send({target: "dsp-programs", header: "storeAdjustments"});
	}
}

return {
	jumpToSoundPresets: jumpToSoundPresets,
	getPreview: getPreview,
	closePreview: closePreview,
	storeAdjustments, storeAdjustments,
	reinstallProgram: reinstallProgram,
	installProgram: installProgram,
	toggleMuteUnknown: toggleMuteUnknown,
	toggleAutoUpgrade: toggleAutoUpgrade
};

})();