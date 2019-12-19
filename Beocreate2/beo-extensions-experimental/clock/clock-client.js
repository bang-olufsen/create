var clock = (function() {
	
	var currentTime = null;
	
	$(document).on("general", function(event, data) {
		if (data.header == "connection") {
			if (data.content.status == "connected") {
				
			}
		}
		
	});
	
	
	$(document).on("clock", function(event, data) {
		
		if (data.header == "currentTime") {
			currentTime = new Date(data.content.timeJSON);
			if (data.content.locale) {
				locale = window.navigator.language.substr(0, 2)+"-"+data.content.locale;
			} else {
				locale = window.navigator.language;
			}
			//locale = "fi-FI"; // To test any locale.
			
			time = currentTime.toLocaleTimeString(locale, {hour: "numeric", minute: "numeric"})
			$(".current-time:not(.short)").text(time);
			if (time.indexOf(" ") != -1) {
				$(".current-time.short").text(time.split(" ")[0]);
				$(".current-time.short").attr("data-extras", time.split(" ")[1]);
				$(".current-time.short").addClass("show-extras");
			} else {
				$(".current-time.short").text(time);
				$(".current-time.short").removeClass("show-extras");
			}
			
			//$(".current-date-long").text(currentTime.toLocaleString(locale, {weekday: "long"})+" "+currentTime.getDate()+". "+currentTime.toLocaleString(window.navigator.language, {month: "long"})+" "+currentTime.getFullYear());
			$(".current-date-long").text(currentTime.toLocaleDateString(locale, {weekday: "long", day: "numeric", year: "numeric", month: "long"}));
		}
		
	});
	
})();