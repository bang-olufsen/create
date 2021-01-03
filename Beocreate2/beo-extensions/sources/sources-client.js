var sources = (function() {

allSources = {};
currentSource = null;
focusedSource = null;
sourceOrder = [];

$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			beo.send({target: "sources", header: "getSources"});
		}
	}
	
	if (data.header == "activatedExtension") {
		if (data.content.extension != "sources" && arrangingSources) {
			toggleArrange();
		}
		if (allSources[data.content.extension]) {
			if (allSources[data.content.extension].alias) {
				$("#"+data.content.extension+" .source-alias-control .menu-value").text(allSources[data.content.extension].alias.name).removeClass("button");
			} else {
				$("#"+data.content.extension+" .source-alias-control .menu-value").text("Set...").addClass("button");
			}
		}
	}
	
});

$(document).on("sources", function(event, data) {

	
	if (data.header == "sources") {
		
		if (data.content.sources != undefined) {
			
			allSources = data.content.sources;
			if (data.content.currentSource != undefined) {
				currentSource = data.content.currentSource;
			} else {
				currentSource = null;
			}
			if (data.content.focusedSource != undefined) {
				focusedSource = data.content.focusedSource;
			} else {
				focusedSource = null;
			}
			if (data.content.sourceOrder) {
				sourceOrder = data.content.sourceOrder;
				orderChanged = true;
			} else {
				orderChanged = false;
			}
			showActiveSources();
			updateSourceOrder(orderChanged);
			updateAliases();
		}
	}

	
	if (data.header == "configuringSystem") {
		beo.notify({title: "Setting up sources...", icon: "attention", timeout: false, id: "sources"});
	}
	
	if (data.header == "systemConfigured") {
		beo.notify(false, "sources");
	}
	
	if (data.header == "defaultAliases") {
		if (aliasSource && data.content.aliases) {
			$(".default-aliases").empty();
			for (alias in data.content.aliases) {
				
				$(".default-aliases").append(beo.createMenuItem({
					label: data.content.aliases[alias].name,
					icon: extensions.sources.assetPath+"/symbols-black/"+data.content.aliases[alias].icon,
					onclick: "sources.setAlias('"+aliasSource+"', '"+alias+"', true);"
				}));
			}
			if (allSources[aliasSource].alias) {
				$(".remove-source-alias").removeClass("hidden");
			} else {
				$(".remove-source-alias").addClass("hidden");
			}
			beo.ask("set-source-alias-prompt", [extensions[aliasSource].title], [
				function() {
					defaultText = (allSources[aliasSource].alias) ? allSources[aliasSource].alias.name : extensions[aliasSource].title;
					beo.startTextInput(1, "Set Alias", "Enter the display name for "+extensions[aliasSource].title+".", {placeholders: {text: "Alias"}, text: defaultText}, function(input) {
						if (input && input.text) {
							setAlias(aliasSource, input.text);
						} else {
							aliasSource = null;
						}
					});
				},
				function() {setAlias(aliasSource, null, true)}], function() {
				aliasSource = null;
			});
		}
	}
	
});

function showActiveSources() {
	$(".source-menu-item").addClass("hide-icon-right");
	// Current, playing source.
	if (currentSource != null) {
		cSource = (allSources[currentSource].childSource) ? allSources[currentSource].childSource : currentSource;
		$('.source-menu-item[data-extension-id="'+cSource+'"]').removeClass("hide-icon-right");
	}
	
	// Which source is focused.
	/*if (focusedSource != null) {
		sourceIcon = null;
		sourceName = null;
		fSource = (allSources[focusedSource].childSource) ? allSources[focusedSource].childSource : focusedSource;
		if (allSources[fSource].aliasInNowPlaying) {
			sourceName = allSources[fSource].aliasInNowPlaying;
		} else if (allSources[fSource].alias) {
			if (allSources[fSource].alias.icon) {
				sourceIcon = extensions.sources.assetPath+"/symbols-black/"+allSources[fSource].alias.icon;
			}
			sourceName = allSources[fSource].alias.name;
		}
		if (!sourceIcon && 
			extensions[fSource].icon && 
			extensions[fSource].assetPath) {
				sourceIcon = extensions[fSource].assetPath+"/symbols-black/"+extensions[fSource].icon;
		}
		if (!sourceName) sourceName = extensions[fSource].title;
		if (sourceIcon) {
			beo.setSymbol(".focused-source-icon", sourceIcon);
			$(".focused-source-icon").removeClass("hidden");
		} else {
			$(".focused-source-icon").addClass("hidden");
		}
		$(".focused-source-name").text(sourceName);
		setTimeout(function() {
			$(".focused-source").addClass("visible");
		}, 50);
	} else {
		$(".focused-source:not(.source-select)").removeClass("visible");
		$(".focused-source.source-select .focused-source-name").text("No Source");
		$(".focused-source.source-select .focused-source-icon").addClass("hidden");
	}*/
}

var previousDisabled = 0;
function updateSourceOrder(force) {
	// Move disabled and enabled sources to their own sections, preserving user order.
		disabledSources = 0;
		for (source in allSources) {
			if (allSources[source].enabled != true) disabledSources++;
		}
		if (previousDisabled != disabledSources || force) {
			for (s in sourceOrder) {
				source = sourceOrder[s];
				if (allSources[source]) {
					if (allSources[source].enabled == true || arrangingSources) {
						if ($('.disabled-sources .menu-item[data-extension-id="'+source+'"]').length > 0) {
							$(".enabled-sources").append($('.disabled-sources .menu-item[data-extension-id="'+source+'"]').detach());
						} else {
							$(".enabled-sources").append($('.enabled-sources .menu-item[data-extension-id="'+source+'"]').detach());
						}
					} else {
						if ($('.enabled-sources .menu-item[data-extension-id="'+source+'"]').length > 0) {
							$(".disabled-sources").append($('.enabled-sources .menu-item[data-extension-id="'+source+'"]').detach());
						} else {
							$(".disabled-sources").append($('.disabled-sources .menu-item[data-extension-id="'+source+'"]').detach());
						}
					}
				}
			}
			previousDisabled = disabledSources;
			if (disabledSources && !arrangingSources) {
				$(".disabled-sources-header").removeClass("hidden");
			} else {
				$(".disabled-sources-header").addClass("hidden");
			}
		}
}

var arrangingSources = false;
var sourceArrangeDrag = null;
var sourcesArranged = false;
function toggleArrange() {
	if (!arrangingSources) {
		arrangingSources = true;
		sourcesArranged = false;
		if (!sourceArrangeDrag) {
			sourceArrangeDrag = new Beodrag(".enabled-sources .menu-item", {
				arrange: true,
				preventClick: true,
				pre: function(event, position, target) {
					target.classList.add("drag"); // When item is held down long enough.
				},
				start: function(event, position, target) {
					target.classList.add("drag");
				},
				move: function(event, position, target) {
					// Move is handled by the internal "arranger" feature in Beodrag.
				},
				end: function(event, position, target, moveFrom = null, moveTo = null, elements) {
					if (moveFrom != null) {
						sourcesArranged = true;
						setTimeout(function() {
							sourceToMove = sourceOrder[moveFrom];
							sourceOrder.splice(moveFrom, 1);
							sourceOrder.splice(moveTo, 0, sourceToMove);
							for (var e = 0; e < elements.length; e++) {
								elements[e].style.transition = "none";
								elements[e].style.transform = null;
								elements[e].style.transition = null;
							}
							console.log(sourceOrder);
							updateSourceOrder(true);
						}, 300);
					}
					target.classList.remove("drag");
				},
				cancel: function(event, position, target) {
					target.classList.remove("drag");
				}
			}, document.querySelector("#sources"));
		} else {
			sourceArrangeDrag.setOptions({enabled: true});
		}
		$("#toggle-source-arrange-button").text("Sources Arranged").toggleClass("black grey");
		updateSourceOrder(true); // Moves all sources to "enabled" section.
		$(".enabled-sources .menu-item").removeClass("chevron");
	} else {
		arrangingSources = false;
		sourceArrangeDrag.setOptions({enabled: false});
		$("#toggle-source-arrange-button").text("Arrange Sources...").toggleClass("black grey");
		updateSourceOrder(true);
		$(".enabled-sources .menu-item, .disabled-sources .menu-item").addClass("chevron");
		if (sourcesArranged) {
			beo.sendToProduct("sources", {header: "arrangeSources", content: {sourceOrder: sourceOrder}});
		}
	}
}


function updateAliases() {
	for (extension in allSources) {
		if (allSources[extension].alias && allSources[extension].alias.icon) {
			icon = extensions.sources.assetPath+"/symbols-black/"+allSources[extension].alias.icon;
		} else {
			icon = extensions[extension].assetPath+"/symbols-black/"+extensions[extension].icon;
		}
		beo.setSymbol('.menu-item[data-extension-id="'+extension+'"] .menu-icon:not(.right)', icon);
		if (allSources[extension].alias && allSources[extension].alias.name) {
			$('.menu-item[data-extension-id="'+extension+'"] .menu-label').text(allSources[extension].alias.name);
			$("#"+extension+" .source-alias-control .menu-value").text(allSources[extension].alias.name).removeClass("button");
		} else {
			$('.menu-item[data-extension-id="'+extension+'"] .menu-label').text(extensions[extension].title);
			$("#"+extension+" .source-alias-control .menu-value").text("Set...").addClass("button");
		}
	}
}



function showStartableSources() {
	$(".startable-sources").empty();
	for (source in allSources) {
		if (allSources[source].parentSource) {
			if (allSources[allSources[source].parentSource].startable) {
				allSources[source].startable = true;
			}
		}
	}
	for (s in sourceOrder) {
		source = sourceOrder[s];
		if (allSources[source].startable) {
			menuOptions = {
				label: extensions[source].title,
				//value: $("#"+startableSources[source].extension).attr("data-menu-title"),
				icon: extensions[source].assetPath+"/symbols-black/"+extensions[source].icon,
				onclick: "sources.startSource('"+source+"');"
			}
			if (source == currentSource) {
				menuOptions.iconRight = "common/symbols-black/volume.svg";
			} else {
				//menuOptions.value = "Play";
				//menuOptions.valueAsButton = true;
			}
			if (allSources[source].metadata.title) {
				trackInfoString = "<strong>"+allSources[source].metadata.title+"</strong>";
				if (allSources[source].metadata.artist) trackInfoString += " — "+allSources[source].metadata.artist;
				menuOptions.customMarkup = "<p>"+trackInfoString+"</p>";
			}
			$(".startable-sources").append(beo.createMenuItem(menuOptions));
		}
	}
	beo.ask("startable-sources-prompt");
}

function startSource(sourceID) {
	beo.send({target: "sources", header: "startSource", content: {sourceID: sourceID}});
	beo.ask();
}

var aliasSource = null;
function setAlias(extension, alias, defaultAlias) {
	if (!alias && !defaultAlias) {
		aliasSource = extension;
		beo.send({target: "sources", header: "getDefaultAliases"});
	} else {
		if (!alias) { // Remove alias.
			beo.send({target: "sources", header: "setAlias", content: {extension: extension, alias: null}});
		} else {
			beo.send({target: "sources", header: "setAlias", content: {extension: extension, alias: alias, defaultAlias: defaultAlias}});
		}
		beo.ask();
	}
}

function testSetActive(extension, active) {
	if (allSources[extension]) {
		if (active) {
			currentSource = extension;
			focusedSource = extension;
		} else {
			currentSource = null;
			focusedSource = null;
		}
		allSources[extension].active = active;
		showActiveSources();
	}
}

// INTERACT

interactSourceOption = null;
function interactSetup(type, stage, data) {
	switch (stage) {
		case "setup":
			if (data && data.source) {
				interactSourceOption = data.source;
			} else {
				interactSourceOption = null;
			}
			$(".interact-source-list").empty();
			for (extension in allSources) {
				if (extensions[extension]) {
					$(".interact-source-list").append(beo.createMenuItem({
						label: extensions[extension].title,
						iconRight: extensions[extension].assetPath+"/symbols-black/"+extensions[extension].icon,
						checkmark: "left",
						data: {"data-option": extension},
						onclick: "sources.interactSetup('"+type+"', 'option', '"+extension+"');"
					}));
				}
			}
			interactSetup(type, "option", interactSourceOption);
			if (data) $("#source-"+type+"-save-button").addClass("disabled");
			beo.ask("source-"+type+"-setup");
			break;
		case "option":
			$(".interact-source-list .menu-item").removeClass("checked");
			$("#source-"+type+"-save-button").removeClass("disabled");
			interactSourceOption = data;
			if (!data) {
				$("#source-"+type+"-any").addClass("checked");
			} else {
				$("#source-"+type+"-any").removeClass("checked");
				$('.interact-source-list .menu-item[data-option="'+data+'"]').addClass("checked");
			}
			break;
		case "save":
			beo.ask();
			if (type == "activated") window.interact.saveTrigger("sources", "sourceActivated", {source: interactSourceOption});
			if (type == "deactivated") window.interact.saveTrigger("sources", "sourceDeactivated", {source: interactSourceOption});
			break;
		case "preview":
			if (data.source) {
				console.log(extensions[data.source].title);
				return extensions[data.source].title;
			} else {
				if (type == "activated") return "Any source when leaving standby";
				if (type == "deactivated") return "Any source when going to standby"
			}
			break;
	}
}

interactDictionary = {
	triggers: {
		sourceActivated: {
			name: "Source Started", 
			icon: "extensions/now-playing/symbols-black/play.svg", 
			setup: function(data) { interactSetup("activated", "setup", data) }, 
			preview: function(data) { return interactSetup("activated", "preview", data) },
			illegalWith: ["actions/now-playing/stop", "actions/now-playing/playPause"]
		},
		sourceDeactivated: {
			name: "Source Stopped", 
			icon: "extensions/now-playing/symbols-black/stop.svg", 
			setup: function(data) { interactSetup("deactivated", "setup", data) }, 
			preview: function(data) { return interactSetup("deactivated", "preview", data) },
			illegalWith: ["actions/now-playing/stop", "actions/now-playing/playPause"]
		}
	}
}

return {
	showStartableSources: showStartableSources,
	startSource: startSource,
	setAlias: setAlias,
	toggleArrange: toggleArrange,
	testSetActive: testSetActive,
	interactSetup: interactSetup,
	interactDictionary: interactDictionary
}

})();