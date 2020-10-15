var speaker_preset = (function() {

speakerPresets = {};
excludedSettings = [];
settingsCount = 0;
currentSpeakerPreset = null;
selectedSpeakerPreset = null;
willInstallFallbackDSP = false;

$(document).on("speaker-preset", function(event, data) {
	if (data.header == "presets") {
		
		if (data.content.compactPresetList && !_.isEqual(speakerPresets, data.content.compactPresetList)) {
			speakerPresets = data.content.compactPresetList;
			
			// List presets in the UI, separating Bang & Olufsen and other presets.
			$(".speaker-preset-collection").empty();
			
			bangOlufsenSpeakerPresetCount = 0;
			customSpeakerPresetCount = 0;
			for (presetID in speakerPresets) {
				presetItem = beo.createCollectionItem({
					classes: ["speaker-preset-item"],
					label: speakerPresets[presetID].presetName,
					icon: speakerPresets[presetID].productImage,
					//onclickSecondary: "console.log('Favourited "+presetID+".');",
					//secondarySymbol: "common/symbols-black/star.svg",
					data: {"data-preset-id": presetID},
					onclick: "speaker_preset.selectPreset('"+presetID+"');",
					checkmark: true
				});
				
				if (speakerPresets[presetID].bangOlufsenProduct) {
					$(".bang-olufsen-speaker-presets").append(presetItem);
					bangOlufsenSpeakerPresetCount++;
				} else {
					$(".custom-speaker-presets").append(presetItem);
					customSpeakerPresetCount++;
				}
			}
		}
		
		if (data.content.currentSpeakerPreset) {
			currentSpeakerPreset = data.content.currentSpeakerPreset;
		} else {
			currentSpeakerPreset = null;
		}
		
		if (data.content.action) {
			switch (data.content.action) {
				case "presetRemoved":
					beo.notify({title: "Preset removed", icon: "common/symbols-black/checkmark-round.svg"});
					break;
			}
		}
		
		showCurrentPreset();
		
	}
	
	if (data.header == "currentPresetName") {
		if (data.content.presetName) {
			$(".current-speaker-preset-name").text(data.content.presetName);
		} else {
			$(".current-speaker-preset-name").text("");
		}
	}
	
	if (data.header == "presetPreview") {
		if (data.content.preset) {
			preset = data.content.preset;
			selectedSpeakerPreset = data.content.preset.fileName;
			$(".speaker-preset-information h1").text(preset.presetName);
			$(".speaker-preset-product-image").css("background-image", "url("+preset.productImage+")");
			if (preset.bangOlufsenProduct) {
				$(".speaker-preset-beo-logo").removeClass("hidden");
				$(".speaker-preset-information h2").addClass("hidden");
			} else {
				$(".speaker-preset-beo-logo").addClass("hidden");
				$(".speaker-preset-information h2").removeClass("hidden");
			}
			
			if (preset.description) {
				$(".speaker-preset-information p.description").text(preset.description);
			} else {
				$(".speaker-preset-information p.description").text("");
			}
			
			if (data.content.currentDSPProgram) {
				$(".speaker-preset-install-fallback-dsp .current-dsp-program-name").text(data.content.currentDSPProgram);
			} else {
				$(".speaker-preset-install-fallback-dsp .current-dsp-program-name").text("unknown program");
			}
			
			excludedSettings = [];
			willInstallFallbackDSP = (data.content.installDefaultDSP) ? true : false;
			settingsCount = 0;
			$(".apply-speaker-preset-button").removeClass("disabled");
			
			$(".speaker-preset-contents").empty();
			$(".speaker-preset-install-fallback-dsp").addClass("hidden");
			
			if (product_information && product_information.clearPresetPreview) {
				product_information.clearPresetPreview();
			}
			
			for (soundAdjustment in preset.content) {
				if (preset.content[soundAdjustment].status == 0) {
					// Has settings, the extension exists, and provided a preview.
					if (preset.content[soundAdjustment].report.previewProcessor != undefined) {
						//presetPreview = executeFunctionByName(preset.content[soundAdjustment].report.previewProcessor, window, preset.content[soundAdjustment].report);
						if (beo.functionExists(preset.content[soundAdjustment].report.previewProcessor)) {
							presetPreview = beo.executeFunction(preset.content[soundAdjustment].report.previewProcessor, [preset.content[soundAdjustment].report, preset.presetName]);
							menuOptions = {
								label: presetPreview[0],
								onclick: 'speaker_preset.toggleSetting(\''+soundAdjustment+'\');',
								icon: extensions[soundAdjustment].assetPath+"/symbols-black/"+extensions[soundAdjustment].icon,
								toggle: true,
								twoRows: true,
								customMarkup: presetPreview[1],
								classes: ["speaker-preset-toggle", soundAdjustment]
							};
							if (presetPreview[2] && presetPreview[2] != "") {
								//$(".speaker-preset-contents").append('<p class="warning">'+presetPreview[2]+'</p>');
								menuOptions.customMarkup += '<p class="warning">'+presetPreview[2]+'</p>';
								willInstallFallbackDSP = true;
							}
							$(".speaker-preset-contents").append(beo.createMenuItem(menuOptions));
						
						
						}
						//$(".speaker-preset-contents").append(presetPreview[1]);
					}
					settingsCount++;
				} else if (preset.content[soundAdjustment].status == 2) {
					// Has settings, the extension exists, but didn't provide preview.
					settingsCount++;
				} else {
					// Has settings, but no extension to handle it.
					
				}
			}
			
			if (willInstallFallbackDSP) {
				$(".speaker-preset-install-fallback-dsp").removeClass("hidden");
				$(".install-fallback-dsp-toggle").addClass("on");
			}
			
			beo.showPopupView("speaker-preset-preview-popup");
		}
		
	}
	
	if (data.header == "presetApplied" && data.content.presetID) {
	
		beo.notify({title: speakerPresets[data.content.presetID].presetName, message: "Speaker preset in use", icon: "common/symbols-black/checkmark-round.svg"});
		beo.hidePopupView("speaker-preset-preview-popup");
		
		currentSpeakerPreset = data.content.presetID;
		showCurrentPreset();
	}
	
	if (data.header == "presetImport") {
		switch (data.content.message) {
			case "invalidJSON":
				beo.notify({title: "Faulty preset data", message: "There was a problem with reading JSON data from the speaker preset file. Make sure the data is formatted correctly and try again.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
				break;
			case "noPresetName":
				beo.notify({title: "Incomplete preset", message: "Speaker preset did not contain a preset name. Please refer to documentation on speaker presets.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
				break;
			case "existingPresetReadOnly":
				beo.notify({title: "Preset already exists", message: "'"+data.content.existingPresetName+"' has the same file name, but can't be replaced because it is a system preset. Rename your preset file and try again.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
				break;
			case "askToReplace":
				beo.ask("replace-speaker-preset-prompt", [data.content.existingPresetName], null, "speaker_preset.replaceExistingPreset(false);");
				break;
		}
	}
	
});

function toggleSetting(setting) {
	settingIndex = excludedSettings.indexOf(setting);
	if (settingIndex == -1) {
		excludedSettings.push(setting);
		$(".speaker-preset-toggle."+setting).removeClass("on");
	} else {
		excludedSettings.splice(settingIndex, 1);
		$(".speaker-preset-toggle."+setting).addClass("on");
	}
	if (settingsCount == excludedSettings.length) {
		$(".apply-speaker-preset-button").addClass("disabled");
	} else {
		$(".apply-speaker-preset-button").removeClass("disabled");
	}
}

function toggleInstallFallbackDSP() {
	if (willInstallFallbackDSP) {
		$(".install-fallback-dsp-toggle").removeClass("on");
		willInstallFallbackDSP = false;
	} else {
		willInstallFallbackDSP = true;
		$(".install-fallback-dsp-toggle").addClass("on");
	}
}

function selectPreset(presetID) {
	beo.send({target: "speaker-preset", header: "selectSpeakerPreset", content: {presetID: presetID}});
	//beo.showPopupView("speaker-preset-preview-popup");
}

function showCurrentPreset() {
	$(".speaker-preset-item.checked").removeClass("checked");
	if (currentSpeakerPreset) {
		$('.speaker-preset-item[data-preset-id="'+currentSpeakerPreset+'"]').addClass("checked");
	}
}

function closePreview() {
	beo.hidePopupView("speaker-preset-preview-popup");
	selectedSpeakerPreset = null;
}

function applyPreset() {
	beo.send({target: "speaker-preset", header: "applySpeakerPreset", content: {presetID: selectedSpeakerPreset, excludedSettings: excludedSettings, installDefault: willInstallFallbackDSP}});
}

function optionsForSelectedPreset() {
	if (selectedSpeakerPreset) {
		if (speakerPresets[selectedSpeakerPreset].readOnly) {
			beo.ask("speaker-preset-options-readonly-prompt");
		} else {
			beo.ask("speaker-preset-options-prompt");
		}
	}
}

function deletePreset(confirmed) {
	if (selectedSpeakerPreset) {
		if (!confirmed) {
			beo.ask("delete-speaker-preset-prompt", [speakerPresets[selectedSpeakerPreset].presetName]);
		} else {
			beo.send({target: "speaker-preset", header: "deleteSpeakerPreset", content: {presetID: selectedSpeakerPreset}});
			closePreview();
			beo.ask();
		}
	}
}

function replaceExistingPreset(replace) {
	beo.ask();
	beo.send({target: "speaker-preset", header: "replaceExistingPreset", content: {replace: replace}});
}

return {
	applyPreset: applyPreset,
	closePreview: closePreview,
	selectPreset: selectPreset,
	optionsForSelectedPreset: optionsForSelectedPreset,
	toggleSetting: toggleSetting,
	toggleInstallFallbackDSP: toggleInstallFallbackDSP,
	deletePreset: deletePreset,
	replaceExistingPreset: replaceExistingPreset
}

})();