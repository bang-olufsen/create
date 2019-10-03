var sound_preset = (function() {

soundPresets = {};
excludedSettings = [];
settingsCount = 0;
selectedSoundPreset = null;
willInstallFallbackDSP = false;

$(document).on("sound-preset", function(event, data) {
	if (data.header == "presets") {
		
		if (data.content.compactPresetList) {
			soundPresets = data.content.compactPresetList;
			
			// List presets in the UI, separating Bang & Olufsen and other presets.
			$(".sound-preset-collection").empty();
			
			bangOlufsenSoundPresetCount = 0;
			customSoundPresetCount = 0;
			for (presetID in soundPresets) {
				presetItem = createCollectionItem({
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
		
		if (data.content.selectedSoundPreset) {
			selectedSoundPreset = data.content.selectedSoundPreset;
		} else {
			selectedSoundPreset = null;
		}
		
		showSelectedPreset();
		
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
			
			for (soundAdjustment in preset.content) {
				if (preset.content[soundAdjustment].status == 0) {
					// Has settings, the extension exists, and provided a preview.
					if (preset.content[soundAdjustment].report.previewProcessor != undefined) {
						//presetPreview = executeFunctionByName(preset.content[soundAdjustment].report.previewProcessor, window, preset.content[soundAdjustment].report);
						if (functionExists(preset.content[soundAdjustment].report.previewProcessor)) {
							presetPreview = executeFunction(preset.content[soundAdjustment].report.previewProcessor, [preset.content[soundAdjustment].report, preset.presetName]);
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
							$(".sound-preset-contents").append(createMenuItem(menuOptions));
						
						
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
			
			showPopupView("sound-preset-preview-popup");
		}
		
	}
	
	if (data.header == "presetApplied" && data.content.presetID) {
	
		notify({title: soundPresets[data.content.presetID].presetName, message: "Sound preset applied", icon: "common/symbols-black/checkmark-round.svg"});
		hidePopupView("sound-preset-preview-popup");
		
		selectedSoundPreset = data.content.presetID;
		showSelectedPreset();
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
	send({target: "sound-preset", header: "selectSoundPreset", content: {presetID: presetID}});
	//showPopupView("sound-preset-preview-popup");
}

function showSelectedPreset() {
	$(".sound-preset-item.checked").removeClass("checked");
	if (selectedSoundPreset) {
		$('.sound-preset-item[data-preset-id="'+selectedSoundPreset+'"]').addClass("checked");
	}
}

function closePreview() {
	hidePopupView("sound-preset-preview-popup");
}

function applyPreset() {
	send({target: "sound-preset", header: "applySoundPreset", content: {presetID: selectedSoundPreset, excludedSettings: excludedSettings, installFallback: willInstallFallbackDSP}});
}

return {
	applyPreset: applyPreset,
	closePreview: closePreview,
	selectPreset: selectPreset,
	toggleSetting: toggleSetting,
	toggleInstallFallbackDSP: toggleInstallFallbackDSP,
	
}

})();