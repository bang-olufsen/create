var sources = (function() {

startableSources = {};
activeSources = {};
currentSource = null;

$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			send({target: "sources", header: "getActiveSources"});
		}
	}
	
});

$(document).on("sources", function(event, data) {
	if (data.header == "activeSources") {
		
		if (data.content.activeSources != undefined) {
			
			activeSources = data.content.activeSources;
			if (data.content.currentSource != undefined) {
				currentSource = data.content.currentSource;
			} else {
				currentSource = null;
			}
			showActiveSources();
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