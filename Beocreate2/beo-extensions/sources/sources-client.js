var sources = (function() {

startableSources = {};
allSources = {};
currentSource = null;
focusedSource = null;

$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			send({target: "sources", header: "getSources"});
		}
	}
	
	if (data.header == "activatedExtension") {
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
			showActiveSources();
			updateDisabledSources();
			updateAliases();
		}
	}
	
	if (data.header == "startableSources") {
		
		if (data.content != undefined) {
			
			startableSources = data.content;
			if (now_playing && now_playing.enableSourceStart) now_playing.enableSourceStart(getStartableSources());
			
		}
	}
	
	if (data.header == "configuringSystem") {
		notify({title: "Setting up sources...", icon: "attention", timeout: false, id: "sources"});
	}
	
	if (data.header == "systemConfigured") {
		notify(false, "sources");
	}
	
	if (data.header == "defaultAliases") {
		if (aliasSource && data.content.aliases) {
			$(".default-aliases").empty();
			for (alias in data.content.aliases) {
				
				$(".default-aliases").append(createMenuItem({
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
			ask("set-source-alias-prompt", [extensions[aliasSource].title], [
				function() {
					defaultText = (allSources[aliasSource].alias) ? allSources[aliasSource].alias.name : extensions[aliasSource].title;
					startTextInput(1, "Set Alias", "Enter the display name for "+extensions[aliasSource].title+".", {placeholders: {text: "Alias"}, text: defaultText}, function(input) {
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
		icon = null;
		name = null;
		if (allSources[currentSource].alias) {
			if (allSources[currentSource].alias.icon) {
				icon = extensions.sources.assetPath+"/symbols-black/"+allSources[currentSource].alias.icon;
			}
			name = allSources[currentSource].alias.name;
		}
		if (!icon && 
			extensions[currentSource].icon && 
			extensions[currentSource].assetPath) {
				icon = extensions[currentSource].assetPath+"/symbols-black/"+extensions[currentSource].icon;
		}
		if (!name) name = extensions[currentSource].title;
		if (icon) {
			$(".active-source-icon").each(function() {
				$(this).css("-webkit-mask-image", "url("+icon+")").css("mask-image", "url("+icon+")");
			});
			$(".active-source-icon").removeClass("hidden");
		} else {
			$(".active-source-icon").addClass("hidden");
		}
		$(".active-source-name").text(name);
		$('.source-menu-item[data-extension-id="'+currentSource+'"]').removeClass("hide-icon-right");
		setTimeout(function() {
			$(".active-source").addClass("visible");
		}, 50);
	} else {
		$(".active-source").removeClass("visible");
	}
	
	// Which source is focused.
	if (focusedSource != null) {
		icon = null;
		name = null;
		if (allSources[currentSource].alias) {
			if (allSources[currentSource].alias.icon) {
				icon = extensions.sources.assetPath+"/symbols-black/"+allSources[currentSource].alias.icon;
			}
			name = allSources[currentSource].alias.name;
		}
		if (!icon && 
			extensions[focusedSource].icon && 
			extensions[focusedSource].assetPath) {
				icon = extensions[focusedSource].assetPath+"/symbols-black/"+extensions[focusedSource].icon;
		}
		if (!name) name = extensions[focusedSource].title;
		if (icon) {
			$(".focused-source-icon").each(function() {
				$(this).css("-webkit-mask-image", "url("+icon+")").css("mask-image", "url("+icon+")");
			});
			$(".focused-source-icon").removeClass("hidden");
		} else {
			$(".focused-source-icon").addClass("hidden");
		}
		$(".focused-source-name").text(name);
		setTimeout(function() {
			$(".focused-source").addClass("visible");
		}, 50);
	} else {
		$(".focused-source").removeClass("visible");
	}
}

function updateDisabledSources() {
	// Move disabled and enabled sources to their own sections.
	disabledSources = 0;
	for (source in allSources) {
		if (allSources[source].enabled == true) {
			if ($('.disabled-sources .menu-item[data-extension-id="'+source+'"]')) {
				$(".enabled-sources").append($('.disabled-sources .menu-item[data-extension-id="'+source+'"]').detach());
			}
		} else {
			if ($('.enabled-sources .menu-item[data-extension-id="'+source+'"]')) {
				$(".disabled-sources").append($('.enabled-sources .menu-item[data-extension-id="'+source+'"]').detach());
				disabledSources++;
			}
		}
	}
	if (disabledSources) {
		$(".disabled-sources-header").removeClass("hidden");
	} else {
		$(".disabled-sources-header").addClass("hidden");
	}
	
}

function updateAliases() {
	for (extension in allSources) {
		if (allSources[extension].alias && allSources[extension].alias.icon) {
			icon = extensions.sources.assetPath+"/symbols-black/"+allSources[extension].alias.icon;
		} else {
			icon = extensions[extension].assetPath+"/symbols-black/"+extensions[extension].icon;
		}
		$('.menu-item[data-extension-id="'+extension+'"] .menu-icon:not(.right)').css("-webkit-mask-image", "url("+icon+")").css("mask-image", "url("+icon+")");
		if (allSources[extension].alias && allSources[extension].alias.name) {
			$('.menu-item[data-extension-id="'+extension+'"] .menu-label').text(allSources[extension].alias.name);
			$("#"+extension+" .source-alias-control .menu-value").text(allSources[extension].alias.name).removeClass("button");
		} else {
			$('.menu-item[data-extension-id="'+extension+'"] .menu-label').text(extensions[extension].title);
			$("#"+extension+" .source-alias-control .menu-value").text("Set...").addClass("button");
		}
	}
}

function getStartableSources() {
	if (Object.keys(startableSources).length == 0) {
		return false;
	} else {
		return startableSources;
	}
}


function showStartableSources() {
	$(".startable-sources").empty();
	for (source in startableSources) {
		
		$(".startable-sources").append(createMenuItem({
			label: startableSources[source].origin,
			//value: $("#"+startableSources[source].extension).attr("data-menu-title"),
			icon: $("#"+startableSources[source].extension).attr("data-asset-path")+"/symbols-black/"+$("#"+startableSources[source].extension).attr("data-icon"),
			onclick: "startSource('"+source+"');"
		}));
	}
	ask("startable-sources-prompt");
}

function startSource(sourceID) {
	send({target: "sources", header: "startSource", content: {sourceID: sourceID}});
	ask();
}

var aliasSource = null;
function setAlias(extension, alias, defaultAlias) {
	if (!alias && !defaultAlias) {
		aliasSource = extension;
		send({target: "sources", header: "getDefaultAliases"});
	} else {
		if (!alias) { // Remove alias.
			send({target: "sources", header: "setAlias", content: {extension: extension, alias: null}});
		} else {
			send({target: "sources", header: "setAlias", content: {extension: extension, alias: alias, defaultAlias: defaultAlias}});
		}
		ask();
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

return {
	showStartableSources: showStartableSources,
	getStartableSources: getStartableSources,
	setAlias: setAlias,
	testSetActive: testSetActive
}

})();