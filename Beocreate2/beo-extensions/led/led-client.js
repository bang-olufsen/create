var led = (function() {

	calibratedWhite = [255,255,255];
	
	
	$(document).on("led", function(event, data) {
		if (data.header == "calibratedWhite") {
			
			if (data.content.white != undefined && data.content.white.length == 3) {
				calibratedWhite = data.content.white;
				$(".led-colour-slider.red").slider("value", calibratedWhite[0]);
				$(".led-colour-slider.green").slider("value", calibratedWhite[1]);
				$(".led-colour-slider.blue").slider("value", calibratedWhite[2]);
			}
		}
	
		
	});
	
	$(".led-colour-slider").slider({
		range: "min",
		min: 0,
		max: 255,
		value: 255,
		slide: function( event, ui ) {
				
				if ($(event.target).hasClass("red")) {
					calibratedWhite[0] = ui.value;
				}
				if ($(event.target).hasClass("green")) {
					calibratedWhite[1] = ui.value;
				}
				if ($(event.target).hasClass("blue")) {
					calibratedWhite[2] = ui.value;
				}
				
				send({target: "led", header: "calibratedWhite", content: {white: calibratedWhite}});
				
			}
	});

})();