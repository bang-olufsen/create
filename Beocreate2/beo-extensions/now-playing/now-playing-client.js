var now_playing = (function() {

var systemVolume = null;
var adjustingSystemVolume = false;
var canStartSources = false;
var focusedSource = null;
var cacheIndex = 0;
var playerState = "stopped";


$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			//if ($("#now-playing").hasClass("visible")) {
				send({target: "now-playing", header: "showingNowPlaying", content: {cacheIndex: cacheIndex}});
			//}
		}
	}
	
});

var loveAnimTimeout;
$(document).on("now-playing", function(event, data) {

	
	if (data.header == "metadata") {
		if (data.content.metadata != undefined && Object.keys(data.content.metadata).length > 0) {
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
				artistAlbum = false;
				if (data.content.metadata.artist) {
					artistAlbum = data.content.metadata.artist;
					if (data.content.metadata.album) {
						//artistAlbum += " — "+data.content.metadata.album;
					} else {
						toggleShowAlbumName(true);
					}
				}
				setNowPlayingTitles(data.content.metadata.title, artistAlbum);
			}
			
			if (data.content.metadata.picture != undefined) {
				if (data.content.metadata.picture != false && data.content.metadata.picture != true) {
					loadArtwork(data.content.metadata.picture, data.content.metadata.picturePort);
				} else if (data.content.metadata.picture != true) {
					loadArtwork();
				}
			} else {
				loadArtwork();
			}
			
			if (data.content.metadata.loved) {
				$("#love-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/heart-filled.svg");
				$("#love-button").addClass("beat-anim");
				/*loveAnimTimeout = setTimeout(function() {
					$("#love-button").removeClass("beat-anim");
				}, 1000);*/
			} else {
				$("#love-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/heart.svg");
				$("#love-button").removeClass("beat-anim");
				//clearTimeout(loveAnimTimeout);
			}
			if (data.content.cacheIndex) cacheIndex = data.content.cacheIndex;
		} else {
			setNowPlayingTitles(false, false);
			toggleShowAlbumName(true);
			loadArtwork();
			$(".artwork-img").attr("alt", "").attr("data-album", "");
			$("#artwork-wrap-inner").attr("data-album", "");
		}
	}
	
	if (data.header == "playerState") {
		clearTimeout(playButtonSymbolTimeout);
		playerState = data.content.state;
		if (data.content.state == "playing") {
			$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/pause.svg");
		} else {
			$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/play.svg");
			enableSourceStart();
		}
	}
	
});

$(document).on("sources", function(event, data) {
	if (data.header == "sources") {
		
		if (data.content.sources != undefined) {
			
			if (data.content.focusedSource != undefined) {
				focusedSource = data.content.focusedSource;
				if (data.content.sources[focusedSource].transportControls) {
					$("#now-playing-transport").removeClass("disabled");
				} else {
					$("#now-playing-transport").addClass("disabled").removeClass("play-only");
					$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/pause.svg");
				}
				if (data.content.sources[focusedSource].canLove) {
					functionRow("love", true);
				} else {
					functionRow("love", false);
				}
			} else {
				focusedSource = null;
				$("#now-playing-transport").addClass("disabled");
				functionRow("love", false);
				toggleShowAlbumName(true);
				enableSourceStart();
			}
		}
	}

	
});

function enableSourceStart(startableSources) {
	if (startableSources != undefined) canStartSources = (startableSources != false) ? true : false;
	if (!focusedSource) {
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
	resizeArtwork();
	//send({target: "now-playing", header: "showingNowPlaying", content: {cacheIndex: cacheIndex}});
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

var functionRowVisible = false;
var functionRowItems = {
	love: {visible: false}
}
var functionRowTimeout;

function functionRow(item, show) {
	
	if (functionRowItems[item]) {
		functionRowItems[item].visible = (show) ? true : false;
		
		visibleItems = 0;
		for (functionItem in functionRowItems) {
			if (functionRowItems[functionItem].visible == true) visibleItems++;
		}
		clearTimeout(functionRowTimeout);
		if (visibleItems == 0) {
			functionRowVisible = false;
			$("#now-playing-function-row").removeClass("visible");
			functionRowTimeout = setTimeout(function() {
				for (functionItem in functionRowItems) {
					$("#now-playing-function-row .function-item-"+functionItem).addClass("hidden");
				}
			}, 500);
		} else {
			functionRowVisible = true;
			$("#now-playing-function-row").addClass("visible");
			for (functionItem in functionRowItems) {
				if (functionRowItems[functionItem].visible) {
					$("#now-playing-function-row .function-item-"+functionItem).removeClass("hidden");
				} else {
					$("#now-playing-function-row .function-item-"+functionItem).addClass("hidden");
				}
			}
		}
	}
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

function toggleLove() {
	send({target: "now-playing", header: "toggleLove"});
}

var playButtonSymbolTimeout;
function playButtonPress() {
	if (focusedSource) {
		// Change the symbol immediately to improve responsiveness. But change it to the real symbol after two seconds if nothing has happened.
		if (playerState == "playing") {
			$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/play.svg");
		} else {
			$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/pause.svg");
		}
		clearTimeout(playButtonSymbolTimeout);
		playButtonSymbolTimeout = setTimeout(function() {
			if (playerState == "playing") {
				$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/pause.svg");
			} else {
				$(".play-button").attr("src", $("#now-playing").attr("data-asset-path")+"/symbols-white/play.svg");
			}
		}, 2000);
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

var artworkChangeTimeout;
var previousSrc = "";

function loadArtwork(url, port) {
	if (!url || url.indexOf("file:///") == -1) { // Don't try loading file URLs
		if (url) {
			if (url.indexOf("http") == 0) {
				// Remote url, use as is.
				imageURL = url;
			} else {
				if (port) {
					imageURL = window.location.protocol+"//"+window.location.hostname+":"+port+"/"+url;
				} else {
					imageURL = url;
				}
			}
			src = imageURL;
		} else {
			// Load appropriately branded placeholder artwork.
			if ($("body").hasClass("hifiberry-os")) {
				src = $("#now-playing").attr("data-asset-path")+"/placeholder-hifiberry.png";
			} else {
				src = $("#now-playing").attr("data-asset-path")+"/placeholder.png";
			}
		}
		if (src != previousSrc) {
			$("#main-artwork").removeClass("visible");
			clearTimeout(artworkChangeTimeout);
			previousSrc = src;
			artworkChangeTimeout = setTimeout(function() {
				$(".artwork-img").attr("src", src);
				if (!url) {
					$(".artwork-img").addClass("placeholder");
					$(".artwork-bg").css("background-image", "none");
				} else {
					$(".artwork-img").removeClass("placeholder");
					$(".artwork-bg").css("background-image", "url(" + src + ")");
				}
			}, 250);
		}
	} else {
		// In case of a file URL, wait for one second for the actual artwork. Otherwise load default artwork.
		artworkChangeTimeout = setTimeout(function() {
			loadArtwork();
		}, 1000);
	}
}

function artworkLoaded() {
	$("#main-artwork").addClass("visible");
}

function loadSmallSampleArtwork() {
	loadArtwork("extensions/now-playing/partiravecmoi-small.jpg");
}

window.onresize = function() {
	resizeArtwork();
};

var windowAspectRatio = 1;
var artworkAspectRatio = 1; // wide > 1 < tall
function resizeArtwork() {
	containerAspectRatio = $("#artwork-wrap-inner").innerWidth() / $("#artwork-wrap-inner").innerHeight();
	
	if (containerAspectRatio >= artworkAspectRatio) { // Container is wider
		$("#main-artwork").css("max-width", "auto").css("max-height", "100%").css("width", "auto").css("height", "100%");
		$("#artwork-wrap-inner").css("flex-direction", "column");
	} else {
		$("#main-artwork").css("max-width", "100%").css("max-height", "auto").css("height", "auto").css("width", "100%");
		$("#artwork-wrap-inner").css("flex-direction", "row");
	}
	
	//$("#main-artwork").css("max-width", container[0]+"px").css("max-height", container[1]+"px")
}

$("#main-artwork").on('load', function() {
	artworkAspectRatio = $(this).get(0).naturalWidth / $(this).get(0).naturalHeight;
	resizeArtwork();
});


// MANAGE AND SWITCH TOP TEXT AND BANG & OLUFSEN LOGO

var previousFirstRow = "";
var previousSecondRow = "";
var topTextActionName = null;
var tempTopTextTimeout;
var topTextNotifyTimeout;
var newFirstRow = "";
var newSecondRow = "";
var sourceNameTimeout;

function setNowPlayingTitles(firstRow, secondRow, temp) {
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
			$(".now-playing-titles").addClass("logo").removeClass("one-row");
			clearTimeout(sourceNameTimeout);
			sourceNameTimeout = setTimeout(function() {
				$("#player-bar-info-area .focused-source").removeClass("icon-only");
			}, 550);
			evaluateTextScrolling(false);
		} else if (newFirstRow != "" && newSecondRow == "") { // Second row is empty, hide it.
			$(".now-playing-titles .first-row").text(newFirstRow).attr("data-content", newFirstRow);
			//$("#top-text .second-row").text(newSecondRow).attr("data-content", newSecondRow);
			$(".now-playing-titles").addClass("one-row").removeClass("logo");
			$("#player-bar-info-area .focused-source").addClass("icon-only");
			clearTimeout(sourceNameTimeout);
			evaluateTextScrolling();
		} else { // Both rows have text, show them.
			$(".now-playing-titles .first-row").text(newFirstRow).attr("data-content", newFirstRow);
			$(".now-playing-titles .second-row").text(newSecondRow).attr("data-content", newSecondRow);
			$(".now-playing-titles").removeClass("logo one-row");
			$("#player-bar-info-area .focused-source").addClass("icon-only");
			clearTimeout(sourceNameTimeout);
			evaluateTextScrolling();
			clearTimeout(topTextNotifyTimeout);
			/*topTextNotifyTimeout = setTimeout(function() {
				tabBarNotify("now-playing", newFirstRow, newSecondRow);
			}, 100);*/
		}

		if (temp == true) {
			tempTopTextTimeout = setTimeout(function() {

				tempTopTextTimeout = null;
				setNowPlayingTitles(previousFirstRow, previousSecondRow);
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
		//resizeArtwork();
	}
	
});


return {
	showNowPlaying: showNowPlaying,
	hideNowPlaying: hideNowPlaying,
	toggleShowAlbumName: toggleShowAlbumName,
	playButtonPress: playButtonPress,
	transport: transport,
	enableSourceStart: enableSourceStart,
	loadArtwork: loadArtwork,
	artworkLoaded: artworkLoaded,
	loadSmallSampleArtwork: loadSmallSampleArtwork,
	toggleLove: toggleLove,
	functionRow: functionRow
}

})();