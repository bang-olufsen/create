var setup = (function() {


$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			send({target: "setup", header: "getSetupStatus"});
		}
	}
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "setup") {
			$(".setup-navigation").addClass("start-finish");
		} else {
			$(".setup-navigation").removeClass("start-finish");
		}
	}
	
});

$(document).on("setup", function(event, data) {
	if (data.header == "setupStatus") {
		if (data.content.setupFlow.length == 0) {
			// No setup flow, restore UI state.
			if (data.content.selectedExtension && data.content.selectedExtension != "setup") {
				restoreState(data.content.selectedExtension);
			} else {
				restoreState();
			}
		} else {
			
		}
	}
});

function generateDotBackground() {
	
	// Regenerate a random background pattern.
	$("#setup .background").empty();
	colours = ["red", "yellow", "green", "blue"];
	for (var i = 0; i < 20; i++) {
		randomColour = colours[Math.round(Math.random()*3)];
		//hRandom = 16*(Math.round(Math.random()*5)+1);
		hRandom = Math.round(Math.random()*80)+10;
		vRandom = Math.round(Math.random()*80)+10;
		$("#setup .background").append('<img class="create-dot" src="'+$("#setup").attr("data-asset-path")+'/create-dot-animate-'+randomColour+'.svg" style="top: '+vRandom+'%; left: '+hRandom+'%;">');
	}
	
}

})();