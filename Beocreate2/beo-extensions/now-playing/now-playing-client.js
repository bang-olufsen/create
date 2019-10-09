var now_playing = (function() {

var systemVolume = null;
var adjustingSystemVolume = false;
var canStartSources = false;
var currentSource = null;
var cacheIndex = 0;


$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			if ($("#now-playing").hasClass("visible")) {
				send({target: "now-playing", header: "showingNowPlaying", content: {cacheIndex: cacheIndex}});
			}
		}
	}
	
});

$(document).on("now-playing", function(event, data) {

	
	if (data.header == "metadata") {
		if (data.content.metadata != undefined) {
			/*
			Contents:
			content.cacheIndex = a number that increments every time metadata changes on the sound system, used to check if metadata needs to be sent.
			content.metadata.picture = URL or base64-encoded image data. 
				- false: remove picture
				- true: use previous picture
			content.metadata.artist
			content.metadata.album
			content.metadata.title
			*/
			/*if (data.content.metadata.title) {
				$(".now-playing-title").text(data.content.metadata.title);
			}
			if (data.content.metadata.artist) {
				$(".now-playing-artist").text(data.content.metadata.artist);
			}*/
			if (data.content.metadata.album) {
				$(".artwork-img").attr("alt", data.content.metadata.album);
				$("#artwork-wrap-inner").attr("data-album", data.content.metadata.album);
			}
			if (data.content.metadata.title != undefined) {
				artistAlbum = false
				if (data.content.metadata.artist) {
					artistAlbum = data.content.metadata.artist;
					if (data.content.metadata.album) {
						//artistAlbum += " — "+data.content.metadata.album;
					} else {
						toggleShowAlbumName(true);
					}
				}
				topText(data.content.metadata.title, artistAlbum);
			}
			
			if (data.content.metadata.picture != undefined) {
				if (data.content.metadata.picture != false && data.content.metadata.picture != true) {
					$(".artwork-bg").css("background-image", "url(" + data.content.metadata.picture + ")");
					$(".artwork-img").attr("src", data.content.metadata.picture).removeClass("placeholder");
				} else if (data.content.metadata.picture != true) {
					$(".artwork-bg").css("background-image", "none");
					$(".artwork-img").attr("src", $("#now-playing").attr("data-asset-path")+"/placeholder.png").addClass("placeholder");
				}
			}
			if (data.content.cacheIndex) cacheIndex = data.content.cacheIndex;
		} else {
			topText(false, false);
			toggleShowAlbumName(true);
			$(".artwork-bg").css("background-image", "none");
			$(".artwork-img").attr("src", $("#now-playing").attr("data-asset-path")+"/placeholder.png").addClass("placeholder");
			$(".artwork-img").attr("alt", "").attr("data-album", "");
			$("#artwork-wrap-inner").attr("data-album", "");
		}
	}
	
	if (data.header == "playerState") {
		if (data.content.state == "playing") {
			$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/pause.svg");
		} else {
			$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/play.svg");
			enableSourceStart();
		}
	}
	
});

$(document).on("sources", function(event, data) {
	if (data.header == "activeSources") {
		
		if (data.content.activeSources != undefined) {
			
			if (data.content.currentSource != undefined) {
				currentSource = data.content.currentSource;
				if (activeSources[currentSource].transportControls) {
					$("#now-playing-transport").removeClass("disabled");
				} else {
					$("#now-playing-transport").addClass("disabled").removeClass("play-only");
					$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/pause.svg");
				}
			} else {
				currentSource = null;
				$("#now-playing-transport").addClass("disabled");
				toggleShowAlbumName(true);
				enableSourceStart();
			}
		}
	}

	
});

function enableSourceStart(startableSources) {
	if (startableSources != undefined) canStartSources = (startableSources != false) ? true : false;
	if (!currentSource) {
		if (!canStartSources) {
			$("#now-playing-transport").removeClass("play-only");
			$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/play.svg");
		} else {
			$("#now-playing-transport").addClass("play-only");
			//$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/play-menu.svg");
			$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/play.svg");
		}
	}
}


function showNowPlaying() {
	$("#now-playing").removeClass("hidden");
	send({target: "now-playing", header: "showingNowPlaying", content: {cacheIndex: cacheIndex}});
	setTimeout(function() {
		$(".player-bar").addClass("shifted");
		$("#now-playing").addClass("visible");
		evaluateTextScrolling();
	}, 20);
}

function hideNowPlaying() {
	$("#now-playing").removeClass("visible");
	$(".player-bar").removeClass("shifted");
	setTimeout(function() {
		$("#now-playing").addClass("hidden");
	}, 600);
}


function transport(action) {
	switch (action) {
		case "playPause":
		case "next":
		case "previous":
			send({target: "now-playing", header: "transport", content: {action: action}});
			break;
	}
}

function playButtonPress() {
	if (currentSource) {
		transport("playPause");
	} else if (canStartSources) {
		if (sources && sources.showStartableSources) sources.showStartableSources();
	}
}

function toggleShowAlbumName(hide) {
	if (hide || $("#artwork-wrap-inner").hasClass("show-name")) {
		$("#artwork-wrap-inner").removeClass("show-name")
	} else {
		//$("#artwork-wrap-inner").addClass("show-name")
	}
}


// MANAGE AND SWITCH TOP TEXT AND BANG & OLUFSEN LOGO

var previousFirstRow = "";
var previousSecondRow = "";
var topTextActionName = null;
var tempTopTextTimeout;
var topTextNotifyTimeout;
var newFirstRow = "";
var newSecondRow = "";

function topText(firstRow, secondRow, temp) {
	/* Value interpretation
    text: change text to this
    true: use previous text
    false | null: clear text
	
    temp:
    If true, the text is temporary. Whatever was displayed before the temporary display will be returned after the temporary text display ends. If any text is sent as "non-temporary" whilst the temporary text is being displayed, it will be stored in the "previous" values and displayed after the temporary text display ends.
    */
	if (firstRow == true) {
		newFirstRow = previousFirstRow;
	} else if (firstRow == false || firstRow == null) {
		newFirstRow = "";
	} else {
		newFirstRow = firstRow;
	}

	if (secondRow == true) {
		newSecondRow = previousSecondRow;
	} else if (secondRow == false || secondRow == null) {
		newSecondRow = "";
	} else {
		newSecondRow = secondRow;
	}

	if (!temp) {
		previousFirstRow = newFirstRow;
		previousSecondRow = newSecondRow;
	} else if (temp == true) {
		//clearTimeout(tempTopTextTimeout);
		tempTopTextTimeout = null;
	}


	if (!tempTopTextTimeout) {



		if (newFirstRow == "" && newSecondRow == "") { // Both rows are empty, show Bang & Olufsen logo.
			$("#top-text").addClass("logo").removeClass("one-row");
			evaluateTextScrolling(false);
		} else if (newFirstRow != "" && newSecondRow == "") { // Second row is empty, hide it.
			$("#top-text h1").text(newFirstRow).attr("data-content", newFirstRow);
			//$("#top-text .second-row").text(newSecondRow).attr("data-content", newSecondRow);
			$("#top-text").addClass("one-row").removeClass("logo");
			evaluateTextScrolling();
		} else { // Both rows have text, show them.
			$("#top-text h1").text(newFirstRow).attr("data-content", newFirstRow);
			$("#top-text h2").text(newSecondRow).attr("data-content", newSecondRow);
			$("#top-text").removeClass("logo one-row");
			evaluateTextScrolling();
			clearTimeout(topTextNotifyTimeout);
			/*topTextNotifyTimeout = setTimeout(function() {
				tabBarNotify("now-playing", newFirstRow, newSecondRow);
			}, 100);*/
		}

		if (temp == true) {
			tempTopTextTimeout = setTimeout(function() {

				tempTopTextTimeout = null;
				topText(previousFirstRow, previousSecondRow);
			}, 2000);
		}
	}
}


var textScrollElements = ["#top-text h1", "#top-text h2"];
var textScrollCompareElements = ["#top-text .h1-wrap", "#top-text .h2-wrap"];
var textScrollIntervals = [];
var textScrollTimeouts = [];
var preventTextScrolling = false;

var textScrollSetupDelay;

function evaluateTextScrolling(flag) {
	// Checks whether text overflows the fields and sets up scrolling.
	// Reset
	for (var i = 0; i < textScrollElements.length; i++) {
		$(textScrollElements[i]).removeClass("scrolling-text");
		$(textScrollElements[i]).css("-webkit-transition-duration", "0s");
		$(textScrollElements[i]).css("-webkit-transform", "translateX(0)");

		clearTimeout(textScrollTimeouts[i]);
		clearInterval(textScrollIntervals[i]);
	}
	if (flag == 2) {
		preventTextScrolling = true;
	} else if (flag == 1) {
		preventTextScrolling = false;
	}
	if (preventTextScrolling == false && flag != false && $("#now-playing").hasClass("visible")) {

		clearTimeout(textScrollSetupDelay);
		textScrollSetupDelay = setTimeout(function() {
			// timeout to prevent funny things happening when all labels have not yet received new text.
			// Get widths

			// iterate through elements
			for (var i = 0; i < textScrollElements.length; i++) {
				textContainerWidth = $(textScrollCompareElements[i]).width();
				textWidth = $(textScrollElements[i])[0].scrollWidth;
				
				if (textWidth > textContainerWidth) {
					createTextScroller(i, textWidth);
				}
			}
		}, 500);

	}
}

function createTextScroller(i, textWidth) {
	// initial run
	textScrollTimeouts[i] = setTimeout(function() {
		$(textScrollElements[i]).css("transition-duration", (textWidth) * 0.03 + "s");
		$(textScrollElements[i]).addClass("scrolling-text");
		$(textScrollElements[i]).css("transform", "translateX(-" + (textWidth + 30) + "px)");
		// the interval takes over subsequent runs
		intervalDelay = textWidth * 30 + 3000;
		textScrollIntervals[i] = setInterval(function() {
			$(textScrollElements[i]).removeClass("scrolling-text");
			$(textScrollElements[i]).css("transition-duration", "0s");
			$(textScrollElements[i]).css("transform", "translateX(0)");
			setTimeout(function() {
				$(textScrollElements[i]).css("transition-duration", (textWidth) * 0.03 + "s");
				$(textScrollElements[i]).addClass("scrolling-text");
				$(textScrollElements[i]).css("transform", "translateX(-" + (textWidth + 30) + "px)");
			}, 20);
		}, intervalDelay);
	}, 3000);
}

$(document).on("ui", function(event, data) {
	
	
	if (data.header == "windowResized") {
		evaluateTextScrolling();
	}
	
});


return {
	showNowPlaying: showNowPlaying,
	hideNowPlaying: hideNowPlaying,
	toggleShowAlbumName: toggleShowAlbumName,
	playButtonPress: playButtonPress,
	transport: transport,
	enableSourceStart: enableSourceStart
}

})();