var room_compensation = (function() {
	
	measurementSwipe = null;

$(document).on("general", function(event, data) {
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "room-compensation") {
			if (!measurementSwipe) {
				measurementSwipe = new Swipe(document.getElementById('room-compensation-measurement-swipe'), {speed: 500});
			}
		}
	}
});
	
$(document).on("room-compensation", function(event, data) {
	
	
	
});
	
function startMeasurement() {
	beo.showPopupView("room-compensation-measurement-assistant");
	measurementSwipe.setup({
		startSlide: 0,
		draggable: true,
		continuous: false,
		disableScroll: false,
		stopPropagation: false,
		callback: function(index, elem, dir) {
			//$("#daisy-chain-assistant-button").addClass("disabled");
		},
		transitionEnd: function(index, elem) {
			
		}
	});
}

function cancelMeasurement() {
	beo.hidePopupView("room-compensation-measurement-assistant");
}
	
return {
	startMeasurement: startMeasurement,
	cancelMeasurement: cancelMeasurement
}
	
})();