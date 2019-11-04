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
		}
	}
	
	if (data.header == "startableSources") {
		
		if (data.content != undefined) {
			
			startableSources = data.content;
			if (now_playing && now_playing.enableSourceStart) now_playing.enableSourceStart(getStartableSources());
			
		}
	}
	
});

function showActiveSources() {
	$(".source-menu-item").addClass("hide-icon-right");
	// Current, playing source.
	if (currentSource != null) {
		if (extensions[currentSource].icon && extensions[currentSource].assetPath) {
			$(".active-source-icon").each(function() {
				$(this).css("-webkit-mask-image", "url("+extensions[currentSource].assetPath+"/symbols-black/"+extensions[currentSource].icon+")").css("mask-image", "url("+extensions[currentSource].assetPath+"/symbols-black/"+extensions[currentSource].icon+")");
			});
			$(".active-source-icon").removeClass("hidden");
		} else {
			$(".active-source-icon").addClass("hidden");
		}
		$(".active-source-name").text(extensions[currentSource].title);
		$('.source-menu-item[data-extension-id="'+currentSource+'"]').removeClass("hide-icon-right");
		setTimeout(function() {
			$(".active-source").addClass("visible");
		}, 50);
	} else {
		$(".active-source").removeClass("visible");
	}
	
	// Which source is focused.
	if (focusedSource != null) {
		if (extensions[focusedSource].icon && extensions[focusedSource].assetPath) {
			$(".focused-source-icon").each(function() {
				$(this).css("-webkit-mask-image", "url("+extensions[focusedSource].assetPath+"/symbols-black/"+extensions[focusedSource].icon+")").css("mask-image", "url("+extensions[focusedSource].assetPath+"/symbols-black/"+extensions[focusedSource].icon+")");
			});
			$(".focused-source-icon").removeClass("hidden");
		} else {
			$(".focused-source-icon").addClass("hidden");
		}
		$(".focused-source-name").text(extensions[focusedSource].title);
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

return {
	showStartableSources: showStartableSources,
	getStartableSources: getStartableSources,
}

})();