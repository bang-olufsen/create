tone_controls = (function() {


$(document).on("tone-controls", function(event, data) {
	if (data.header == "toneControlSettings") {
		if (data.content.settings.toneTouchXY) {
			toneTouchXY = data.content.settings.toneTouchXY;
			setToneTouchFieldColours(toneTouchXY[0], toneTouchXY[1]);
			$("#tone-touch-dot").css("left", toneTouchXY[0]+"%").css("top", 100-toneTouchXY[1]+"%");
		}
		if (data.content.settings.toneTouchAmbience != undefined) {
			
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
	
	if (data.header == "canDoToneControl") {
		if (data.content.canDoToneControl.ambience) {
			// Enable ambience control in ToneTouch.
			
		} else {
		
		}
		
		if (!data.content.canDoToneControl.toneControls) {
			// No ToneTouch or loudness.
			$("#tone-touch-dot").addClass("disabled");
		} 
		if (data.content.canDoToneControl.toneControls >= 2) {
			// Enable ToneTouch.
			$("#tone-touch-dot").removeClass("disabled");
		}
		if (data.content.canDoToneControl.toneControls >= 4) {
			// Enable loudness.
			
		}
	}
	
});



// TONETOUCH

/*

X = treble
Y = bass

   WARM   EXCITED
       100
    ┌---┬---┐
    | 1 | 2 |
  0 ├---O---┤ 100
    | 3 | 4 |
    └---┴---┘
        0
RELAXED   BRIGHT

*/


var toneTouchXY = [50,50];

var toneTouchDragStartPosition = null;
var toneTouchDragOffset = null;
var toneTouchAreaDimensions = [];
var previousToneTouchXY = [];
var toneTouchOffLabelTimeout = null;


$( "#tone-touch-dot" ).draggable({
//	cursorAt: { top: 0, left: 0 },
	//delay: 500,
	scroll: false,
	helper: function( event ) {
	return $( "<div class='ui-widget-header' style='display: none;'></div>" );
	},
	start: function( event, ui ) {
		
	},
	stop: function( event, ui ) {
		
		if ((previousToneTouchXY[0] != 50 || previousToneTouchXY[1] != 50) && Math.distance(toneTouchXY[0], toneTouchXY[1], 50, 50) < 5) {
			// Snap to center
			$("#tone-touch-dot").css("left", "50%").css("top", "50%");
			toneTouchXY = [50,50];
			
			setToneTouchFieldColours(toneTouchXY[0], toneTouchXY[1]);
			
			if (toneTouchDotDiameter == defaultToneTouchDotDiameter) {
				clearTimeout(toneTouchOffLabelTimeout);
				$("#tone-touch-dot span").text("Off");
				$("#tone-touch-dot").removeClass("number").addClass("text");
				toneTouchOffLabelTimeout = setTimeout(function() {
					$("#tone-touch-dot").removeClass("text");
				}, 2000);
			}
		}
		toneTouchDragStartPosition = null;
	},
	drag: function( event, ui ) {
		if (toneTouchDragStartPosition) {
			toneTouchXY[0] = ((ui.position.left-toneTouchDragOffset[0])/toneTouchAreaDimensions[0])*100;
			toneTouchXY[1] = 100-((ui.position.top-toneTouchDragOffset[1])/toneTouchAreaDimensions[1])*100;
			
			// Prevent dragging out of bounds.
			if (toneTouchXY[0] < 0) {
				toneTouchXY[0] = 0;
			} else if (toneTouchXY[0] > 100) {
				toneTouchXY[0] = 100;
			}
			if (toneTouchXY[1] < 0) {
				toneTouchXY[1] = 0;
			} else if (toneTouchXY[1] > 100) {
				toneTouchXY[1] = 100;
			}
			
			setToneTouchFieldColours(toneTouchXY[0], toneTouchXY[1]);
			sendFilter();
			//if (toneTouchXY[0] > 45 && toneTouchXY[0] < 55 && toneTouchXY[1] > 45 && toneTouchXY[1] < 55) {
			$("#tone-touch-dot").css("left", toneTouchXY[0]+"%").css("top", 100-toneTouchXY[1]+"%");
			
		} else {
			previousToneTouchXY = toneTouchXY.slice(0);
			toneTouchDragStartPosition = ui.position;
			toneTouchDragOffset = [$("#tone-touch-area").offset().left, $("#tone-touch-area").offset().top];
			toneTouchAreaDimensions = [document.getElementById("tone-touch-area").offsetWidth, document.getElementById("tone-touch-area").offsetHeight];
			clearTimeout(toneTouchOffLabelTimeout);
			$("#tone-touch-dot").removeClass("text");
		}
		
	}
});

var filterSendTimeout = null;
var filterLastSent = 0;
function sendFilter() {

	timestamp = new Date().getTime();
	if (timestamp - filterLastSent < 100) { // Allow sending 10 times per second.
		clearTimeout(filterSendTimeout);
		filterSendTimeout = setTimeout(function() {
			beo.sendToProduct("tone-controls", {header: "toneTouchSettings", content: {toneTouchXY: toneTouchXY}});
			filterLastSent = new Date().getTime();
		}, 100 - (timestamp - filterLastSent));
	} else {
		beo.sendToProduct("tone-controls", {header: "toneTouchSettings", content: {toneTouchXY: toneTouchXY}});
		filterLastSent = timestamp;
	}
}


var toneTouchFieldDefaultOpacity = [0.1, 0.12, 
									0.18, 0.2];

function setToneTouchFieldColours(x, y) {
	opacity =  [0,0,
				0,0];
				
	oneBased = [1+(x-50)/50, 1+(y-50)/50];
	
	if (oneBased[0] > 1) {
		opacity[0] = getToneTouchFieldOpacity(toneTouchFieldDefaultOpacity[0], oneBased, [true, false], [0.3, 0]);
		opacity[1] = getToneTouchFieldOpacity(toneTouchFieldDefaultOpacity[1], oneBased, [false, false], [0, 0]);
		opacity[2] = getToneTouchFieldOpacity(toneTouchFieldDefaultOpacity[2], oneBased, [true, true], [0.3, 0]);
		opacity[3] = getToneTouchFieldOpacity(toneTouchFieldDefaultOpacity[3], oneBased, [false, true], [0.8, 0]);
	} else {
		opacity[0] = getToneTouchFieldOpacity(toneTouchFieldDefaultOpacity[0], oneBased, [true, false], [0, 0]);
		opacity[1] = getToneTouchFieldOpacity(toneTouchFieldDefaultOpacity[1], oneBased, [false, false], [0.3, 0]);
		opacity[2] = getToneTouchFieldOpacity(toneTouchFieldDefaultOpacity[2], oneBased, [true, true], [0.8, 0]);
		opacity[3] = getToneTouchFieldOpacity(toneTouchFieldDefaultOpacity[3], oneBased, [false, true], [0.3, 0]);
	}
	
	//console.log(opacity);
	// Set background opacity.
	
	$("#tone-touch-field-1").css("background-color", "rgba(0,0,0,"+opacity[0]+")");
	$("#tone-touch-field-2").css("background-color", "rgba(0,0,0,"+opacity[1]+")");
	$("#tone-touch-field-3").css("background-color", "rgba(0,0,0,"+opacity[2]+")");
	$("#tone-touch-field-4").css("background-color", "rgba(0,0,0,"+opacity[3]+")");
}

function getToneTouchFieldOpacity(originalOpacity, oneBased, invert, reduceBy) {
	substractFrom = [0,0];
	if (invert[0] == true) {
		opacityX = (2-oneBased[0])-(reduceBy[0]*(2-oneBased[0]-1));
	} else {
		opacityX = oneBased[0]-(reduceBy[0]*(oneBased[0]-1));
	}
	
	if (invert[1] == true) {
		opacityY = (2-oneBased[1])-(reduceBy[1]*(2-oneBased[1]-1));
	} else {
		opacityY = oneBased[1]-(reduceBy[1]*(oneBased[1]-1));
	}
	
	return originalOpacity*opacityX*opacityY;
}


var toneTouchGestureLastScale = 0;
var defaultToneTouchDotDiameter = 60; // px. Set this to same as the default size in CSS.
var toneTouchDotDiameter = defaultToneTouchDotDiameter;
// ToneTouch spaciousness
function toneTouchGesture(stage, targetTouches) {
	switch (stage) {
		case 0: // End.
			if (toneTouchDotDiameter < defaultToneTouchDotDiameter || toneTouchDotDiameter == defaultToneTouchDotDiameter) {
				toneTouchDotDiameter = defaultToneTouchDotDiameter;
				setToneTouchDotDiameter(defaultToneTouchDotDiameter);
				if (toneTouchXY[0] == 50 && toneTouchXY[1] == 50) {
					$("#tone-touch-dot span").text("Off");
					$("#tone-touch-dot").removeClass("number").addClass("text");
				}
			} else if (toneTouchDotDiameter > 150) {
				setToneTouchDotDiameter(150);
				toneTouchDotDiameter = 150;
			}
			
			
			clearTimeout(toneTouchOffLabelTimeout);
			toneTouchOffLabelTimeout = setTimeout(function() {
				$("#tone-touch-dot").removeClass("text number");
			}, 2000);
			
			
			break;
		case 1:	// Start.
			clearTimeout(graphTooltipHideTimeout);
			toneTouchGestureLastScale = Math.distance(targetTouches[0].pageX,targetTouches[0].pageY,targetTouches[1].pageX,targetTouches[1].pageY);
			break;
		case 2: // Move.
			newScale = Math.distance(targetTouches[0].pageX,targetTouches[0].pageY,targetTouches[1].pageX,targetTouches[1].pageY);
			scaleDelta = (newScale-toneTouchGestureLastScale)*10;
			$("#tone-touch-dot").removeClass("text").addClass("number");
			
			if (toneTouchDotDiameter < defaultToneTouchDotDiameter) {
				toneTouchDotDiameter = toneTouchDotDiameter+scaleDelta/30;
				$("#tone-touch-dot span").text(0);
			} else if (toneTouchDotDiameter > 150) {
				toneTouchDotDiameter = toneTouchDotDiameter+scaleDelta/30;
				$("#tone-touch-dot span").text(10);
			} else {
				toneTouchDotDiameter = toneTouchDotDiameter+scaleDelta/10;
				$("#tone-touch-dot span").text(Math.ceil((toneTouchDotDiameter-defaultToneTouchDotDiameter)/10));
			}
			setToneTouchDotDiameter(toneTouchDotDiameter);
			toneTouchGestureLastScale = newScale;
			//console.log(toneTouchDotDiameter);
			break;
	}
}

function setToneTouchDotDiameter(theDiameter) {
	$("#tone-touch-dot").css("width", theDiameter+"px").css("height", theDiameter+"px");
	$("#tone-touch-dot").css("margin-left", "-"+theDiameter/2+"px").css("margin-top", "-"+theDiameter/2+"px");
	$("#tone-touch-scale-area").css("left", -100+theDiameter/2+"px").css("top", -100+theDiameter/2+"px");
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

})();