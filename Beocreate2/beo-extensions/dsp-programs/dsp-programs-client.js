var dsp_programs = (function() {

var programs = {};
var previewedDSPProgram = null;
var muteUnknown = false;


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
				$(".dsp-program-metadata").append(createMenuItem(menuOptions));
				
			}
			
			$(".no-dsp-metadata").addClass("hidden");
			$(".dsp-program-metadata-wrap").removeClass("hidden");
			$("#dsp-program-preview-popup footer .reinstall").removeClass("disabled");
		} else {
			$(".no-dsp-metadata").removeClass("hidden");
			$(".dsp-program-metadata-wrap").addClass("hidden");
			$("#dsp-program-preview-popup footer .reinstall").addClass("disabled");
		}
		
		if (data.content.current) {
			$("#dsp-program-preview-popup footer .reinstall").removeClass("hidden");
			$("#dsp-program-preview-popup footer .install").addClass("hidden");
		} else {
			$("#dsp-program-preview-popup footer .install").removeClass("hidden");
			$("#dsp-program-preview-popup footer .reinstall").addClass("hidden");
		}
		
		previewedDSPProgram = data.content.id;
		
		if (data.content.name) {
			$(".dsp-program-information h1").text(data.content.name);
		} else {
			$(".dsp-program-information h1").text("Unknown Program");
		}
		if (data.content.version) {
			$(".dsp-program-information p").text(translatedString("Version", "version", "dsp-programs")+" "+data.content.version);
		} else {
			$(".dsp-program-information p").text("");
		}
		
		showPopupView("dsp-program-preview-popup");
	}
	
	if (data.header == "showCurrent") {
		if (data.content.name) {
			$("#dsp-programs .current-dsp-program-name").text(data.content.name);
		} else {
			$("#dsp-programs .current-dsp-program-name").text("Unknown Program");
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
						icon: $("#dsp-programs").attr("data-asset-path")+"/symbols-black/dsp-file.svg"
					}
					$(".dsp-program-list").append(createMenuItem(menuOptions));
			}
		}
	}
	
	if (data.header == "flashEEPROM") {
		if (data.content.status == "flashing") {
			notify({title: "Installing DSP program...", message: "Writing to memory...", icon: "attention", timeout: false});
		}
		if (data.content.status == "fail") {
			notify({title: "DSP program installation failed", message: "Please try again. If the problem persists, contact support.", icon: "common/symbols-colour/warning-yellow.svg", timeout: false, buttonAction: "close", buttonTitle: "Close"});
		}
	}
	
	if (data.header == "checkEEPROM") {
		if (data.content.status == "checking") {
			notify({title: "Installing DSP program...", message: "Checking memory...", icon: "attention", timeout: false});
		}
		if (data.content.status == "success") {
			notify({title: "DSP program installed", icon: "common/symbols-black/checkmark-round.svg"});
		}
		if (data.content.status == "fail") {
			notify({title: "DSP program installation failed", message: "Program was succesfully written, but didn't persist in memory. Please try installing the program again. If the problem persists, contact support.", icon: "common/symbols-colour/warning-yellow.svg", timeout: false, buttonAction: "close", buttonTitle: "Close"});
		}
	}
	
	if (data.header == "muteUnknownPrograms") {
		if (data.content.muteUnknown) {
			muteUnknown = true;
			$("#mute-unknown-enabled-toggle").addClass("on");
		} else {
			muteUnknown = false;
			$("#mute-unknown-enabled-toggle").removeClass("on");
		}
	}
});


function getPreview(program) {
	if (!program) program = null;
	send({target: "dsp-programs", header: "getProgramPreview", content: {program: program}});
}

function closePreview() {
	hidePopupView("dsp-program-preview-popup");
}

function reinstallProgram() {
	hidePopupView("dsp-program-preview-popup");
	send({target: "dsp-programs", header: "installProgram"});
}

function installProgram(confirmed) {
	if (!confirmed) {
		ask("install-dsp-program-prompt");
	} else {
		ask();
		hidePopupView("dsp-program-preview-popup");
		send({target: "dsp-programs", header: "installProgram", content: {program: previewedDSPProgram}});
	}
}

function jumpToSoundPresets() {
	showExtension("sound-preset");
}

function toggleMuteUnknown(confirmed) {
	if (muteUnknown) {
		if (!confirmed) {
			ask("disable-mute-unknown-programs-prompt");
		} else {
			ask();
			send({target: "dsp-programs", header: "muteUnknown", content: {muteUnknown: false}});
		}
	} else {
		// When enabling, just do it.
		send({target: "dsp-programs", header: "muteUnknown", content: {muteUnknown: true}});
	}
}

return {
	jumpToSoundPresets: jumpToSoundPresets,
	getPreview: getPreview,
	closePreview: closePreview,
	reinstallProgram: reinstallProgram,
	installProgram: installProgram,
	toggleMuteUnknown: toggleMuteUnknown
};

})();