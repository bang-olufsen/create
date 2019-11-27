var sound_preset = (function() {

soundPresets = {};
excludedSettings = [];
settingsCount = 0;
currentSoundPreset = null;
selectedSoundPreset = null;
willInstallFallbackDSP = false;

$(document).on("sound-preset", function(event, data) {
	if (data.header == "presets") {
		
		if (data.content.compactPresetList && !_.isEqual(soundPresets, data.content.compactPresetList)) {
			soundPresets = data.content.compactPresetList;
			
			// List presets in the UI, separating Bang & Olufsen and other presets.
			$(".sound-preset-collection").empty();
			
			bangOlufsenSoundPresetCount = 0;
			customSoundPresetCount = 0;
			for (presetID in soundPresets) {
				presetItem = beo.createCollectionItem({
					classes: ["sound-preset-item"],
					label: soundPresets[presetID].presetName,
					icon: soundPresets[presetID].productImage,
					data: {"data-preset-id": presetID},
					onclick: "sound_preset.selectPreset('"+presetID+"');",
					checkmark: true
				});
				
				if (soundPresets[presetID].bangOlufsenProduct) {
					$(".bang-olufsen-sound-presets").append(presetItem);
					bangOlufsenSoundPresetCount++;
				} else {
					$(".custom-sound-presets").append(presetItem);
					customSoundPresetCount++;
				}
			}
		}
		
		if (data.content.currentSoundPreset) {
			currentSoundPreset = data.content.currentSoundPreset;
		} else {
			currentSoundPreset = null;
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
	
	if (data.header == "presetPreview") {
		if (data.content.preset) {
			preset = data.content.preset;
			selectedSoundPreset = data.content.preset.fileName;
			$(".sound-preset-information h1").text(preset.presetName);
			$(".sound-preset-product-image").css("background-image", "url("+preset.productImage+")");
			if (preset.bangOlufsenProduct) {
				$(".sound-preset-beo-logo").removeClass("hidden");
				$(".sound-preset-information h2").addClass("hidden");
			} else {
				$(".sound-preset-beo-logo").addClass("hidden");
				$(".sound-preset-information h2").removeClass("hidden");
			}
			
			if (preset.description) {
				$(".sound-preset-information p.description").text(preset.description);
			} else {
				$(".sound-preset-information p.description").text("");
			}
			
			if (data.content.currentDSPProgram) {
				$(".sound-preset-install-fallback-dsp .current-dsp-program-name").text(data.content.currentDSPProgram);
			} else {
				$(".sound-preset-install-fallback-dsp .current-dsp-program-name").text("unknown program");
			}
			
			excludedSettings = [];
			willInstallFallbackDSP = false;
			settingsCount = 0;
			$(".apply-sound-preset-button").removeClass("disabled");
			
			$(".sound-preset-contents").empty();
			$(".sound-preset-install-fallback-dsp").addClass("hidden");
			
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
								onclick: 'sound_preset.toggleSetting(\''+soundAdjustment+'\');',
								icon: $("#"+soundAdjustment).attr("data-asset-path")+"/symbols-black/"+$("#"+soundAdjustment).attr("data-icon"),
								toggle: true,
								twoRows: true,
								customMarkup: presetPreview[1],
								classes: ["sound-preset-toggle", soundAdjustment]
							};
							if (presetPreview[2] && presetPreview[2] != "") {
								//$(".sound-preset-contents").append('<p class="warning">'+presetPreview[2]+'</p>');
								menuOptions.customMarkup += '<p class="warning">'+presetPreview[2]+'</p>';
								$(".sound-preset-install-fallback-dsp").removeClass("hidden");
								$(".install-fallback-dsp-toggle").addClass("on");
								willInstallFallbackDSP = true;
							}
							$(".sound-preset-contents").append(beo.createMenuItem(menuOptions));
						
						
						}
						//$(".sound-preset-contents").append(presetPreview[1]);
					}
					settingsCount++;
				} else if (preset.content[soundAdjustment].status == 2) {
					// Has settings, the extension exists, but didn't provide preview.
					settingsCount++;
				} else {
					// Has settings, but no extension to handle it.
					
				}
			}
			
			beo.showPopupView("sound-preset-preview-popup");
		}
		
	}
	
	if (data.header == "presetApplied" && data.content.presetID) {
	
		beo.notify({title: soundPresets[data.content.presetID].presetName, message: "Sound preset applied", icon: "common/symbols-black/checkmark-round.svg"});
		beo.hidePopupView("sound-preset-preview-popup");
		
		currentSoundPreset = data.content.presetID;
		showCurrentPreset();
	}
	
	if (data.header == "presetImport") {
		switch (data.content.message) {
			case "invalidJSON":
				beo.notify({title: "Faulty preset data", message: "There was a problem with reading JSON data from the sound preset file. Make sure the data is formatted correctly and try again.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
				break;
			case "noPresetName":
				beo.notify({title: "Incomplete preset", message: "Sound preset did not contain a preset name. Please refer to documentation on sound presets.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
				break;
			case "existingPresetReadOnly":
				beo.notify({title: "Preset already exists", message: "'"+data.content.existingPresetName+"' has the same file name, but can't be replaced because it is a system preset. Rename your preset file and try again.", timeout: false, buttonTitle: "Dismiss", buttonAction: "close"});
				break;
			case "askToReplace":
				beo.ask("replace-sound-preset-prompt", [data.content.existingPresetName], null, "sound_preset.replaceExistingPreset(false);");
				break;
		}
	}
	
});

function toggleSetting(setting) {
	settingIndex = excludedSettings.indexOf(setting);
	if (settingIndex == -1) {
		excludedSettings.push(setting);
		$(".sound-preset-toggle."+setting).removeClass("on");
	} else {
		excludedSettings.splice(settingIndex, 1);
		$(".sound-preset-toggle."+setting).addClass("on");
	}
	if (settingsCount == excludedSettings.length) {
		$(".apply-sound-preset-button").addClass("disabled");
	} else {
		$(".apply-sound-preset-button").removeClass("disabled");
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
	beo.send({target: "sound-preset", header: "selectSoundPreset", content: {presetID: presetID}});
	//beo.showPopupView("sound-preset-preview-popup");
}

function showCurrentPreset() {
	$(".sound-preset-item.checked").removeClass("checked");
	if (currentSoundPreset) {
		$('.sound-preset-item[data-preset-id="'+currentSoundPreset+'"]').addClass("checked");
	}
}

function closePreview() {
	beo.hidePopupView("sound-preset-preview-popup");
	selectedSoundPreset = null;
}

function applyPreset() {
	beo.send({target: "sound-preset", header: "applySoundPreset", content: {presetID: selectedSoundPreset, excludedSettings: excludedSettings, installFallback: willInstallFallbackDSP}});
}

function optionsForSelectedPreset() {
	if (selectedSoundPreset) {
		if (soundPresets[selectedSoundPreset].readOnly) {
			beo.ask("sound-preset-options-readonly-prompt");
		} else {
			beo.ask("sound-preset-options-prompt");
		}
	}
}

function deletePreset(confirmed) {
	if (selectedSoundPreset) {
		if (!confirmed) {
			beo.ask("delete-sound-preset-prompt", [soundPresets[selectedSoundPreset].presetName]);
		} else {
			beo.send({target: "sound-preset", header: "deleteSoundPreset", content: {presetID: selectedSoundPreset}});
			closePreview();
			beo.ask();
		}
	}
}

function replaceExistingPreset(replace) {
	beo.ask();
	beo.send({target: "sound-preset", header: "replaceExistingPreset", content: {replace: replace}});
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