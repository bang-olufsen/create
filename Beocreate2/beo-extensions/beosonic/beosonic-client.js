
beosonic = (function() {


$(document).on("general", function(event, data) {
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "sound") {
			
		}
		
		if (data.content.extension == "beosonic") {
			updatePresetList();
		}
		
		if (data.content.extension != "beosonic" && arrangingPresets) editPresets(false);
	}
});


$(document).on("beosonic", function(event, data) {
	if (data.header == "beosonicSettings") {
		if (selectedExtension == "beosonic") {
			if (data.content.settings.beosonicDistance != undefined &&
				data.content.settings.beosonicAngle != undefined) {
				beosonicDistance = data.content.settings.beosonicDistance;
				beosonicAngle = data.content.settings.beosonicAngle;
				updateBeosonicUI();
				
				
			}
			if (data.content.settings.loudness != undefined) {
				if (!data.content.settings.loudness) {
					$(".loudness-slider span").attr("data-content", "Off");
				} else {
					$(".loudness-slider span").attr("data-content", data.content.settings.loudness);
				}
				$(".loudness-slider").slider("value", data.content.settings.loudness);
			}
		}
		
		$(".beosonic-menu-preset").removeClass("selected");
		$("#beosonic-presets .menu-item").removeClass("checked");
		if (data.content.settings.selectedPreset) {
			currentPreset = data.content.settings.selectedPreset;
			$('.beosonic-menu-preset[data-beosonic-preset="'+currentPreset+'"]').addClass("selected");
			$('#beosonic-presets .menu-item[data-beosonic-preset="'+currentPreset+'"]').addClass("checked");
		} else {
			currentPreset = null;
		}
		
		
		if (data.content.canDoToneControl) {
			if (!data.content.canDoToneControl.toneControls) {
				// No ToneTouch or loudness.
				$("#beosonic-dot").addClass("disabled");
			} 
			if (data.content.canDoToneControl.toneControls >= 2) {
				// Enable ToneTouch.
				$("#beosonic-dot").removeClass("disabled");
			}
			if (data.content.canDoToneControl.toneControls >= 4) {
				// Enable loudness.
				
			}
		}
		
		if (data.content.presets) {
			beosonicPresets = data.content.presets;
			if (data.content.settings.presetOrder) {
				presetOrder = data.content.settings.presetOrder;
				updatePresetList();
			}
			
			if (data.content.presetSaved) {
				beo.notify({title: beosonicPresets[data.content.presetSaved].presetName, message: "Listening mode saved", icon: "common/symbols-black/checkmark-round.svg"});
			}
		}
		
	}
	
	if (data.header == "beosonicPresets") {
		beosonicPresets = data.content.presets;
		if (data.content.selectedPreset) {
			currentPreset = data.content.selectedPreset;
		} else {
			currentPreset = null;
		}
		if (data.content.presetOrder) {
			presetOrder = data.content.presetOrder;
			updateQuickPresets();
		}
	}
	
	if (data.header == "savingPreset") {
		if (newPresetName) {
			if (data.content.exists) {
				if (beosonicPresets[data.content.exists].readOnly) {
					// Can't replace system preset. Choose new name.
					savePreset(null, data.content.exists);
				} else {
					// Ask to replace.
					beo.ask("replace-beosonic-prompt");
				}
			} else {
				// Ask which sound adjustments to include.
				selectAdjustmentsToInclude();
			}
		}
	}
	
	if (data.header == "renamingPreset") {
		if (data.content.exists) {
			renamePreset(data.content.exists);
		}
	}
});


// BEOSONIC

var beosonicAngle = 0;
var beosonicDistance = 0;
var beosonicStartDistance = null;
var beosonicStartAngle = null;
var beosonicDragOffset = [0,0];
var beosonicAreaDimensions = [0,0];

var beosonicDrag = new Beodrag("#beosonic-dot", {
	touchImmediately: true,
	start: function(event, position, target) {
		beosonicRect = document.getElementById("beosonic-control").getBoundingClientRect();
		beosonicDragOffset = [beosonicRect.x, beosonicRect.y];
		beosonicAreaDimensions = [document.getElementById("beosonic-area").offsetWidth, document.getElementById("beosonic-area").offsetHeight];
		beosonicStartDistance = beosonicDistance;
		beosonicStartAngle = beosonicAngle;
		document.querySelector("#beosonic-control").classList.add("drag");
	},
	move: function(event, position, target) {
		x = ((position.elementX-beosonicDragOffset[0])/beosonicAreaDimensions[0])*100;
		y = ((position.elementY-beosonicDragOffset[1])/beosonicAreaDimensions[1])*100;
		beosonicDistance = Math.distance(x, y, 50, 50);
		if (beosonicDistance > 50) beosonicDistance = 50;
		beosonicAngle = parseInt(Math.angle(x, y, 50, 50));
		//console.log(beosonicAngle, beosonicDistance);
		sendFilter();
		updateBeosonicUI();
	},
	end: function(event, position, target) {
		document.querySelector("#beosonic-control").classList.remove("drag");
		if (beosonicDistance < 2) {
			beosonicDistance = 0;
			changedFromPreset = (beosonicStartDistance == 0) ? false : true;
			updateBeosonicUI();
			
		} else {
			changedFromPreset = (beosonicStartDistance != beosonicDistance || beosonicStartAngle != beosonicAngle) ? true : false;
		}
		sendFilter(changedFromPreset);
		if (changedFromPreset) {
			currentPreset = null;
			updatePresetList();
		}
		
	}
}, document.querySelector("#beosonic"));




function updateBeosonicUI() {
	//console.log(beosonicAngle);
	x = beosonicDistance*Math.cos(Math.radians(beosonicAngle-90));
	y = beosonicDistance*Math.sin(Math.radians(beosonicAngle-90));
	
	// Dot & glow:
	$("#beosonic-glow, #beosonic-dot").css("left", x+50+"%").css("top", 50-y+"%");
	
	
	// Feeling labels:
	if (beosonicDistance == 0) {
		opacity = [1,1,1,1];
		opacityDiag = [0.0,0.0,0.0,0.0];
		$("#beosonic-area").css("box-shadow", "0 3px 15px rgba(0, 0, 0, 0.1)");
	} else {
		$("#beosonic-area").css("box-shadow", "0 3px 15px rgba(0, 0, 0, 0.1), "+x+"px "+(y*-1)+"px "+(10+(beosonicDistance/50)*40)+"px hsl("+Math.round(beosonicAngle-105)+", 65%, 50%)");
		opacityEffect = beosonicDistance/50;
		[offset, quadrant] = getOffsetAndQuadrant(beosonicDistance, beosonicAngle); // For main labels.
		
		o = [ // Opacity:
			1, // Current
			1-0.75*opacityEffect, // Opposite
			(offset > 0) ? 0.5+(offset*0.5)+(0.75-0.75*opacityEffect) : 0.5+(offset*0.25)+(0.75-0.75*opacityEffect), // Neighbour CCW
			(offset > 0) ? 0.25+(0.25-offset*0.25)+(0.75-0.75*opacityEffect) : 0.5+(-offset*0.5)+(0.75-0.75*opacityEffect) // Neighbour CW
		];
		if (quadrant == 0) {
			opacity = [o[1], o[0], o[3], o[2]]; // Top, bottom, left, right
		} else if (quadrant == 90) {
			opacity = [o[2], o[3], o[1], o[0]];
		} else if (quadrant == 180) {
			opacity = [o[0], o[1], o[2], o[3]];
		} else if (quadrant == 270) {
			opacity = [o[3], o[2], o[0], o[1]];
		}
		
		[offsetDiag, quadrantDiag] = getOffsetAndQuadrant(beosonicDistance, beosonicAngle, -45); // For diagonal labels.
		oDiag = [ // Opacity:
			0.0+0.75*opacityEffect, // Current
			0.0-0.25*opacityEffect, // Opposite
			(offsetDiag > 0) ? 0.0+(0.75*offsetDiag)*opacityEffect : 0.0+(offsetDiag*0.25)*opacityEffect, // Neighbour CCW
			(offsetDiag > 0) ? 0.0+(-offsetDiag*0.25)*opacityEffect : 0.0+(0.75*-offsetDiag)*opacityEffect // Neighbour CW
		];
		if (quadrantDiag == 0) {
			opacityDiag = [oDiag[1], oDiag[0], oDiag[3], oDiag[2]]; // NW, SE, SW, NE
		} else if (quadrantDiag == 90) {
			opacityDiag = [oDiag[2], oDiag[3], oDiag[1], oDiag[0]];
		} else if (quadrantDiag == 180) {
			opacityDiag = [oDiag[0], oDiag[1], oDiag[2], oDiag[3]];
		} else if (quadrant == 270) {
			opacityDiag = [oDiag[3], oDiag[2], oDiag[0], oDiag[1]];
		}
	}
	$(".beosonic-label.top").css("opacity", opacity[0]);
	$(".beosonic-label.bottom").css("opacity", opacity[1]);
	$(".beosonic-label.left").css("opacity", opacity[2]);
	$(".beosonic-label.right").css("opacity", opacity[3]);
	
	$(".beosonic-label.nw").css("opacity", opacityDiag[0]);
	$(".beosonic-label.se").css("opacity", opacityDiag[1]);
	$(".beosonic-label.sw").css("opacity", opacityDiag[2]);
	$(".beosonic-label.ne").css("opacity", opacityDiag[3]);
	//console.log(beosonicAngle, offset);
}

function getOffsetAndQuadrant(distance, angle, withOffset = 0) {
	angle += withOffset;
	if (angle > 360) angle -= 360;
	if (angle < 0) angle += 360;
	quadrant = 0; // 0, 90, 180, 270
	if (angle < 45 || angle >= 315) { // Warm.
		offset = ((angle > 180) ? angle-360 : angle)/45;
		quadrant = 0;
	} else if (angle < 135 && angle >= 45) { // Energetic.
		offset = (angle-90)/45;
		quadrant = 90;
	} else if (angle < 225 && angle >= 135) { // Bright.
		offset = (angle-180)/45;
		quadrant = 180;
	} else if (angle < 315 && angle >= 225) { // Relaxed.
		offset = (angle-270)/45;
		quadrant = 270;
	}
	return [offset, quadrant];
}

function beosonicTest(angle, distance) {
	beosonicAngle = angle;
	beosonicDistance = distance;
	updateBeosonicUI();
}

var filterSendTimeout = null;
var filterLastSent = 0;
function sendFilter(changedFromPreset = null) {

	timestamp = new Date().getTime();
	if (timestamp - filterLastSent < 100) { // Allow sending 10 times per second.
		clearTimeout(filterSendTimeout);
		filterSendTimeout = setTimeout(function() {
			beo.sendToProduct("beosonic", {header: "beosonicSettings", content: {beosonicDistance: beosonicDistance, beosonicAngle: beosonicAngle, changedFromPreset: changedFromPreset}});
			filterLastSent = new Date().getTime();
		}, 100 - (timestamp - filterLastSent));
	} else {
		beo.sendToProduct("beosonic", {header: "beosonicSettings", content: {beosonicDistance: beosonicDistance, beosonicAngle: beosonicAngle, changedFromPreset: changedFromPreset}});
		filterLastSent = timestamp;
	}
}




currentPreset = null;
presetOrder = [];
beosonicPresets = {};
function updatePresetList(moveFrom, moveTo) {
	if (moveFrom != undefined && moveTo != undefined) { // Move presets around.
		presetToMove = presetOrder[moveFrom];
		presetOrder.splice(moveFrom, 1);
		presetOrder.splice(moveTo, 0, presetToMove);
		beo.sendToProduct("beosonic", {header: "arrangePresets", content: {presetOrder: presetOrder}});
	}
	$("#beosonic-presets").empty();
	for (i in presetOrder) {
		
		if (i == 4) {
			$("#beosonic-presets").append("<hr>");
		}
		$("#beosonic-presets").append(beo.createMenuItem({
			label: beosonicPresets[presetOrder[i]].presetName,
			onclick: "beosonic.presetAction('"+presetOrder[i]+"');",
			data: {"data-beosonic-preset": presetOrder[i]},
			checkmark: "left",
			iconRight: (!beosonicPresets[presetOrder[i]].readOnly) ? "common/symbols-black/more.svg" : null,
			classes: (arrangingPresets) ? [] : ["hide-icon-right"],
			checked: (currentPreset == presetOrder[i]) ? true : false
		}));
	}
	if (presetOrder.length > 1) {
		$("#beosonic-preset-instruction").removeClass("hidden");
		$("#beosonic-edit-presets-button").removeClass("disabled");
	} else {
		$("#beosonic-preset-instruction").addClass("hidden");
		if (presetOrder.length == 0 || beosonicPresets[presetOrder[0]].readOnly) {
			$("#beosonic-edit-presets-button").addClass("disabled");
		} else {
			$("#beosonic-edit-presets-button").removeClass("disabled");
		}
	}
	if (presetOrder.length > 4) {
		$("#beosonic-quick-access-note").removeClass("hidden");
	} else {
		$("#beosonic-quick-access-note").addClass("hidden");
	}
	
}

function updateQuickPresets() {
	$(".beosonic-quick-presets").empty();
	for (i in presetOrder) {
		
		if (i < 4) { // Update presets to Sound menu.
			$(".beosonic-quick-presets").append('<div class="beosonic-menu-preset '+ ((currentPreset == presetOrder[i]) ? "selected" : "") +'" data-beosonic-preset="'+presetOrder[i]+'" onclick="beosonic.presetAction(\''+presetOrder[i]+'\');">'+beosonicPresets[presetOrder[i]].presetName+'</div>');
		}
	}
}

var beosonicPresetSort = new Beodrag("#beosonic-presets .menu-item", {
	arrange: true,
	pre: function(event, position, target) {
		target.classList.add("drag"); // When item is held down long enough.
	},
	start: function(event, position, target) {
		target.classList.add("drag");
	},
	move: function(event, position, target) {
		// Move is handled by the internal "arranger" feature in Beodrag.
	},
	end: function(event, position, target, curPos = null, newPos = null) {
		if (newPos != null) {
			setTimeout(function() {
				updatePresetList(curPos, newPos);
			}, 300);
		}
		target.classList.remove("drag");
	},
	cancel: function(event, position, target) {
		target.classList.remove("drag");
	}
}, document.querySelector("#beosonic"));


var arrangingPresets = false;

function editPresets(editing) {
	if (editing) {
		arrangingPresets = true;
		$("#beosonic-preset-button-row").addClass("hidden");
		$("#beosonic-presets-arranged, #beosonic-preset-drag-note").removeClass("hidden");
		$("#beosonic-presets .menu-item").removeClass("hide-icon-right");
	} else {
		arrangingPresets = false;
		$("#beosonic-preset-button-row").removeClass("hidden");
		$("#beosonic-presets-arranged, #beosonic-preset-drag-note").addClass("hidden");
		$("#beosonic-presets .menu-item").addClass("hide-icon-right");
	}
}

var newPresetName = null;
function savePreset(withAdjustments, systemPresetConflict = false, preselectAdjustments = null) {
	if (!withAdjustments) {
		defaultAdjustments = (preselectAdjustments) ? preselectAdjustments : [];
		beo.startTextInput(1, "New Listening Mode", 
			(!systemPresetConflict) ? "Enter a name for this listening mode preset." : "A built-in preset with this name already exists. Please choose another name.", 
			{text: (!systemPresetConflict) ? "" : beosonicPresets[systemPresetConflict].presetName, placeholders: {text: "Preset name"}, minLength: {text: 3}, autocorrect: true, autocapitalise: true}, function(input) {
			// Validate and store input.
			if (input && input.text) {
				newPresetName = input.text;
				beo.sendToProduct("beosonic", {header: "newPreset", content: {name: input.text}});
			}
		});
	} else {
		beo.sendToProduct("beosonic", {header: "newPreset", content: {name: newPresetName, withAdjustments: withAdjustments}});
	}
}

function renamePreset(conflict) {
	beo.ask();
	beo.startTextInput(1, "Rename Preset", 
		(!conflict) ? "Enter a new name for this preset." : "A preset with this name already exists. Please choose another name.", 
		{text: beosonicPresets[selectedPreset].presetName, placeholders: {text: "Preset name"}, minLength: {text: 3}, autocorrect: true, autocapitalise: true}, function(input) {
		// Validate and store input.
		if (input && input.text) {
			beo.sendToProduct("beosonic", {header: "renamePreset", content: {presetID: selectedPreset, name: input.text}});
		}
	});
}

function replaceExisting(confirmed) {
	beo.ask();
	if (confirmed) {
		selectAdjustmentsToInclude();
	}
}

var availableAdjustments = ["beosonic", "channels", "equaliser"];
var selectedAdjustments = [];
var defaultAdjustments = [];
function selectAdjustmentsToInclude(toggleAdjustment) {
	if (!toggleAdjustment) {
		// List adjustments.
		selectedAdjustments = ["beosonic"].concat(defaultAdjustments);
		$("#beosonic-available-adjustments").empty();
		for (a in availableAdjustments) {
			menuOptions = {
					icon: extensions[availableAdjustments[a]].assetPath+"/symbols-black/"+extensions[availableAdjustments[a]].icon,
					toggle: (selectedAdjustments.indexOf(availableAdjustments[a]) != -1) ? true : false,
					onclick: "beosonic.selectAdjustmentsToInclude('"+availableAdjustments[a]+"');",
					id: "beosonic-selected-adjustment-toggle-"+availableAdjustments[a]
				};
			beosonicPreview = null;
			if (availableAdjustments[a] == "beosonic") {
				menuOptions.label = "Beosonic";
				menuOptions.description = "Bass and treble";
				menuOptions.disabled = true;
				beosonicPreview = true;
			} else {
				if (extensions[availableAdjustments[a]] &&
					extensions[availableAdjustments[a]].namespace &&
					window[extensions[availableAdjustments[a]].namespace] &&
					window[extensions[availableAdjustments[a]].namespace].getBeosonicPreview) {
					beosonicPreview = window[extensions[availableAdjustments[a]].namespace].getBeosonicPreview();
					menuOptions.label = beosonicPreview.label;
					menuOptions.description = beosonicPreview.description;
				}
			}
			
			if (beosonicPreview) $("#beosonic-available-adjustments").append(beo.createMenuItem(menuOptions));
		}
		beo.ask("beosonic-preset-include-adjustments", [newPresetName], [function() {
			savePreset(selectedAdjustments);
		}]);
	} else {
		adjustmentIndex = selectedAdjustments.indexOf(toggleAdjustment)
		if (adjustmentIndex == -1) {
			selectedAdjustments.push(toggleAdjustment);
			$("#beosonic-selected-adjustment-toggle-"+toggleAdjustment).addClass("on");
		} else {
			selectedAdjustments.splice(adjustmentIndex, 1);
			$("#beosonic-selected-adjustment-toggle-"+toggleAdjustment).removeClass("on");
		}
	}
}

selectedPreset = null;
function presetAction(presetID) {
	if (!arrangingPresets) { // Activate preset.
		beo.sendToProduct("beosonic", {header: "applyPreset", content: {presetID: presetID}});
	} else { // Show preset options.
		if (!beosonicPresets[presetID].readOnly) {
			selectedPreset = presetID;
			beo.ask("beosonic-preset-action-prompt", [beosonicPresets[presetID].presetName]);
		}
	}
}

function deletePreset(confirmed) {
	if (confirmed) {
		beo.ask();
		beo.sendToProduct("beosonic", {header: "deletePreset", content: {presetID: selectedPreset}});
	} else {
		beo.ask("delete-beosonic-preset-prompt", [beosonicPresets[selectedPreset].presetName]);
	}
}


// LOUDNESS

$(".loudness-slider").slider({
	range: "min",
	min: 0,
	max: 10,
	value: 5,
	slide: function( event, ui ) {
			
			if (!ui.value) {
				$(".loudness-slider span").attr("data-content", "Off");
			} else {
				$(".loudness-slider span").attr("data-content", ui.value);
			}
			
			beo.send({target: "tone-controls", header: "loudness", content: {loudness: ui.value}});
		}
});

// INTERACT

interactBeosonicOption = null;
function interactSetup(stage, data) {
	switch (stage) {
		case "setup":
			if (data && data.preset != undefined) {
				interactBeosonicOption = data.preset;
			} else {
				interactBeosonicOption = null;
			}
			$("#interact-beosonic-list").empty();
			for (i in presetOrder) {
				$("#interact-beosonic-list").append(beo.createMenuItem({
					label: beosonicPresets[presetOrder[i]].presetName,
					value: i,
					checkmark: "left",
					data: {"data-option": presetOrder[i]},
					onclick: "beosonic.interactSetup('option', '"+presetOrder[i]+"');",
					checked: (interactBeosonicOption == presetOrder[i])
				}));
			}
			
			interactSetup("option", interactBeosonicOption);
			$("#select-beosonic-preset-save-button").addClass("disabled");
			beo.ask("select-beosonic-preset-setup");
			break;
		case "option":
			$("#interact-beosonic-list .menu-item, #interact-beosonic-with-value").removeClass("checked");
			$("#select-beosonic-preset-save-button").removeClass("disabled");
			interactBeosonicOption = data;
			if (data == false) {
				$("#interact-beosonic-with-value").addClass("checked");
			} else if (data) {
				$('#interact-beosonic-list .menu-item[data-option="'+data+'"]').addClass("checked");
			}
			break;
		case "save":
			beo.ask();
			window.interact.saveAction("beosonic", "selectPreset", {preset: interactBeosonicOption});
			break;
		case "preview":
			console.log(data);
			if (!data.preset) {
				return "Preset with full name, file name or index number from trigger";
			} else {
				return beosonicPresets[data.preset].presetName;
			}
			break;
	}
}


interactDictionary = {
	actions: {
		selectPreset: {
			name: "Select Listening Mode",
			icon: "extensions/beosonic/symbols-black/tonetouch.svg",
			setup: function(data) { interactSetup("setup", data) }, 
			preview: function(data) { return interactSetup("preview", data) }
		}
	}
}

return {
	beosonicTest: beosonicTest,
	presetAction: presetAction,
	editPresets: editPresets,
	savePreset: savePreset,
	renamePreset: renamePreset,
	deletePreset: deletePreset,
	replaceExisting: replaceExisting,
	selectAdjustmentsToInclude: selectAdjustmentsToInclude,
	interactDictionary: interactDictionary,
	interactSetup: interactSetup
}

})();