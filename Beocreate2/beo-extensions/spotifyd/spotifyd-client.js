var spotifyd = (function() {


$(document).on("spotifyd", function(event, data) {
	if (data.header == "configuration") {
		
		
		if (data.content.version) {
			$(".spotifyd-version").text(data.content.version);
			$(".spotifyd-version-container").removeClass("hidden");
		} else {
			$(".spotifyd-version-container").addClass("hidden");
		}
	}

	
	
});


})();