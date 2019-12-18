var now_playing = (function() {

var systemVolume = null;
var adjustingSystemVolume = false;
var canStartSources = false;
var focusedSource = null;
var cacheIndex = 0;
var playerState = "stopped";

var useExternalArtwork = null;
var disableInternalArtwork = false;


$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			//if ($("#now-playing").hasClass("visible")) {
				beo.send({target: "now-playing", header: "getData", content: {cacheIndex: cacheIndex}});
			//}
		}
	}
	
});

var loveAnimTimeout;
$(document).on("now-playing", function(event, data) {
	
	if (data.header == "useExternalArtwork") {
		if (data.content.useExternalArtwork) setUseExternalArtwork(data.content.useExternalArtwork, true);
	}
	
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
			
			allSources[data.content.extension].metadata = data.content.metadata;
			
			if (data.content.useExternalArtwork) setUseExternalArtwork(data.content.useExternalArtwork, true);
			
			if (data.content.metadata.album) {
				$(".artwork-img").attr("alt", data.content.metadata.album);
				$("#artwork-wrap-inner").attr("data-album", data.content.metadata.album);
			} else {
				
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
			
			// Album covers.
			port = data.content.metadata.picturePort;
			if (data.content.metadata.picture && !disableInternalArtwork) {
				internalURL = data.content.metadata.picture;
			} else {
				internalURL = null;
			}
			
			if (data.content.metadata.externalPicture) {
				externalURL = data.content.metadata.externalPicture;
			} else {
				externalURL = null;
			}
			determineArtworkToShow(internalURL, externalURL, port);
			
			clearTimeout(loveAnimTimeout);
			$("#love-button").removeClass("love-in-progress");
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
	//beo.send({target: "now-playing", header: "showingNowPlaying", content: {cacheIndex: cacheIndex}});
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

var artworkDragStartPosition;
$( ".main-artwork" ).draggable({
//	cursorAt: { top: 0, left: 0 },
	//delay: 500,
	scroll: false,
	helper: function( event ) {
	return $( "<div class='ui-widget-header' style='display: none;'></div>" );
	},
	start: function( event, ui ) {
		$("#now-playing").addClass("no-animation");
	},
	stop: function( event, ui ) {
		$("#now-playing").removeClass("no-animation");
		$(".now-playing-artwork-wrap").css("transform", "");
		//$("#now-playing-control-area").css("transform", "");
		offset = ui.position.top - artworkDragStartPosition.top;
		if (offset > 40) hideNowPlaying();
		artworkDragStartPosition = null;
	},
	drag: function( event, ui ) {
		if (artworkDragStartPosition) {
			offset = ui.position.top - artworkDragStartPosition.top;
			if (offset < 0) {
				visibleOffset = offset/6;
			} else if (offset >= 0 && offset < 50) {
				visibleOffset = offset/2;
			} else {
				visibleOffset = 25+(offset-50)/4;
			}
			$(".now-playing-artwork-wrap").css("transform", "translateY("+visibleOffset+"px)");
			//$("#now-playing-control-area").css("transform", "translateY("+visibleOffset+"px)");
		} else {
			artworkDragStartPosition = ui.position;
		}
	}
});

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
			beo.send({target: "now-playing", header: "transport", content: {action: action}});
			break;
	}
}


function toggleLove() {
	beo.send({target: "now-playing", header: "toggleLove"});
	$("#love-button").addClass("love-in-progress");
	clearTimeout(loveAnimTimeout);
	loveAnimTimeout = setTimeout(function() {
		$("#love-button").removeClass("love-in-progress");
	}, 3000);
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
	if (hide || $(".artwork-wrap-inner").hasClass("show-name")) {
		$(".artwork-wrap-inner").removeClass("show-name")
	} else {
		//$("#artwork-wrap-inner").addClass("show-name")
	}
}

var artworkChangeTimeout;
var currentPicture = "";
var hasPicture = false;
var currentArtworkView = "a";
var hiddenArtworkView = "b";

function loadArtwork(url, port, testExternal) {
	evaluateExternalArtwork = false;
	if (!url || url.indexOf("file:///") == -1) {
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
			if (!testExternal) hasPicture = true;
		} else {
			// Load appropriately branded placeholder artwork.
			if ($("body").hasClass("hifiberry-os")) {
				src = $("#now-playing").attr("data-asset-path")+"/placeholder-hifiberry.png";
			} else {
				src = $("#now-playing").attr("data-asset-path")+"/placeholder.png";
			}
			hasPicture = false;
		}
		if (src != currentPicture) {
			clearTimeout(artworkChangeTimeout);
			if (!testExternal) currentPicture = src;
			pictureInTargetView = $(".artwork-img-"+hiddenArtworkView).attr("src");
			$(".artwork-img-"+hiddenArtworkView).attr("src", src);
			if (!testExternal) {
				console.log("Loading artwork to view "+hiddenArtworkView.toUpperCase()+"...");
			} else {
				console.log("Loading external artwork to view "+hiddenArtworkView.toUpperCase()+" to compare...");
			}
			if (!url) {
				$(".artwork-img-"+hiddenArtworkView).addClass("placeholder");
				$(".artwork-bg-"+hiddenArtworkView).css("background-image", "none");
			} else {
				$(".artwork-img-"+hiddenArtworkView).removeClass("placeholder");
				$(".artwork-bg"+hiddenArtworkView).css("background-image", "url(" + src + ")");
			}
			if (pictureInTargetView == currentPicture) artworkLoaded(hiddenArtworkView);
		}
	} else {
		// In case of a file URL, wait for one second for the actual artwork. Otherwise load default artwork.
		hasPicture = false;
		artworkChangeTimeout = setTimeout(function() {
			loadArtwork();
		}, 1000);
	}
}

var evaluateExternalArtwork = false;
var currentInternalPicture = null;
var currentExternalPicture = null;
function determineArtworkToShow(internalURL, externalURL, port) {
	
	if (internalURL != currentInternalPicture || (!internalURL && !externalURL)) { // Always load internal artwork first, or if neither image is available.
		loadArtwork(internalURL, port);
		if (internalURL != null && internalURL.indexOf("file:///") != -1) internalURL = null; // Treat file URLs as no URL.
		currentInternalPicture = internalURL;
	} else if (internalURL && currentPicture != internalURL) {
		loadArtwork(internalURL, port);
	}
	
	// If external artwork is set to "never", don't do anything.
	// If no picture, load external artwork ("missing" mode).
	// If current picture file is smaller than the picture view, load and check external artwork size. If larger, switch ("auto" mode).
	// Load external artwork always ("always" mode).
	
	switch (useExternalArtwork) {
		case "missing":
			if (!internalURL && externalURL && (currentExternalPicture != externalURL || externalURL != currentPicture)) {
				loadArtwork(externalURL);
				currentExternalPicture = externalURL;
			}
			break;
		case "auto":
			if (externalURL && currentExternalPicture != externalURL) {
				if (!internalURL) {
					loadArtwork(externalURL);
					currentExternalPicture = externalURL;
				} else {
					artworkWidth = (currentArtworkView == "a") ? artworkDimensionsA[0] : artworkDimensionsB[0];
					if ($("#main-artwork-"+currentArtworkView).innerWidth() * window.devicePixelRatio > artworkWidth) {
						// Image view is larger than the image.
						loadArtwork(externalURL, null, true);
						evaluateExternalArtwork = hiddenArtworkView;
						currentExternalPicture = externalURL;
					}
				}
			}
			break;
		case "always":
			if (externalURL && (currentExternalPicture != externalURL || externalURL != currentPicture)) {
				loadArtwork(externalURL);
				currentExternalPicture = externalURL;
			}
			break;
			
	}
	
}

function switchArtwork(view) {
	show = view;
	hide = (show == "a") ? "b" : "a";
	if (noAnimation) $(".now-playing-artwork-wrap").addClass("no-animation");
	$("#now-playing-artwork-wrap-"+show).addClass("visible incoming");
	$("#now-playing-artwork-wrap-"+hide).removeClass("visible").addClass("outgoing");
	setTimeout(function() {
		$(".now-playing-artwork-wrap").removeClass("incoming outgoing");
	}, 500);
	previousSrc = $(".artwork-img-"+show).attr("src");
	currentArtworkView = show;
	hiddenArtworkView = hide;
}

function testArtworkSwap() {
	view = (currentArtworkView == "a") ? "b" : "a";
	switchArtwork(view);
	return view;
}

function artworkLoaded(view) {
	shouldSwitch = true;
	noAnimation = false;
	if (view == "a") {
		artworkDimensionsA[0] = $("#main-artwork-a").get(0).naturalWidth;
		artworkDimensionsA[1] = $("#main-artwork-a").get(0).naturalHeight;
		artworkAspectRatioA = $("#main-artwork-a").get(0).naturalWidth / $("#main-artwork-a").get(0).naturalHeight;
	} else {
		artworkDimensionsB[0] = $("#main-artwork-b").get(0).naturalWidth;
		artworkDimensionsB[1] = $("#main-artwork-b").get(0).naturalHeight;
		artworkAspectRatioB = $("#main-artwork-b").get(0).naturalWidth / $("#main-artwork-b").get(0).naturalHeight;
	}
	resizeArtwork();
	if (evaluateExternalArtwork == view) {
		// If the downloaded image is equal size or smaller than the current one, don't switch them.
		hiddenViewDimension = (view == "a") ? artworkDimensionsA[0] : artworkViewDimensionsB[0];
		currentViewDimension = (view == "a") ? artworkDimensionsB[0] : artworkViewDimensionsA[0];
		if (hiddenViewDimension <= currentViewDimension) {
			shouldSwitch = false;
			console.log("External artwork is not higher-resolution.");
		} else {
			noAnimation = true;
			console.log("Switching to higher-resolution downloaded artwork in view "+view.toUpperCase()+".");
		}
		evaluateExternalArtwork = false;
	}
	if (shouldSwitch) switchArtwork(view, noAnimation);
}

$("#main-artwork-a").on('load', function() {
	artworkLoaded("a");
});
$("#main-artwork-b").on('load', function() {
	artworkLoaded("b");
});
$("#main-artwork-a").on('error', function() {
	if (evaluateExternalArtwork != "b") {
		loadArtwork();
	} else {
		evaluateExternalArtwork = false;
	}
});
$("#main-artwork-b").on('error', function() {
	if (evaluateExternalArtwork != "a") {
		loadArtwork();
	} else {
		evaluateExternalArtwork = false;
	}
});

function loadSmallSampleArtwork() {
	loadArtwork("extensions/now-playing/partiravecmoi-small.jpg");
}

artworkCycle = 0;
function loadNonSquareArtwork() {
	switch (artworkCycle) {
		case 0:
			loadArtwork("extensions/now-playing/partiravecmoi.jpg");
			album = "Partir Avec Moi – square";
			break;
		case 1:
			loadArtwork("extensions/now-playing/landscape-cover.png");
			album = "Turquoise – landscape";
			break;
		case 2:
			loadArtwork("extensions/now-playing/portrait-cover.png");
			album = "Waxflower – portrait";
			break;
	}
	artworkCycle = (artworkCycle < 2) ? artworkCycle+1 : 0;
	return album;
}

window.onresize = function() {
	resizeArtwork();
};

var windowAspectRatio = 1;
var artworkAspectRatioA = 1; // wide > 1 < tall
var artworkAspectRatioB = 1;
var artworkDimensionsA = [0,0];
var artworkDimensionsB = [0,0];
function resizeArtwork() {
	containerAspectRatio = $(".artwork-wrap-inner").innerWidth() / $(".artwork-wrap-inner").innerHeight();
	
	if (containerAspectRatio >= artworkAspectRatioA) { // Container is wider
		$("#main-artwork-a").css("max-width", "auto").css("max-height", "100%").css("width", "auto").css("height", "100%");
		$("#artwork-wrap-inner-a").css("flex-direction", "column");
	} else {
		$("#main-artwork-a").css("max-width", "100%").css("max-height", "auto").css("height", "auto").css("width", "100%");
		$("#artwork-wrap-inner-a").css("flex-direction", "row");
	}
	
	if (containerAspectRatio >= artworkAspectRatioB) { // Container is wider
		$("#main-artwork-b").css("max-width", "auto").css("max-height", "100%").css("width", "auto").css("height", "100%");
		$("#artwork-wrap-inner-b").css("flex-direction", "column");
	} else {
		$("#main-artwork-b").css("max-width", "100%").css("max-height", "auto").css("height", "auto").css("width", "100%");
		$("#artwork-wrap-inner-b").css("flex-direction", "row");
	}
	
}



function setUseExternalArtwork(mode, updateOnly) {
	switch (mode) {
		case "never":
		case "missing":
		case "auto":
		case "always":
			if (updateOnly) {
				$(".external-artwork-settings .menu-item").removeClass("checked");
				$(".external-artwork-settings .menu-item#external-artwork-"+mode).addClass("checked");
				useExternalArtwork = mode;
			} else {
				if (!updateOnly) beo.send({target: "now-playing", header: "useExternalArtwork", content: {useExternalArtwork: mode}});
			}
			break;
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
	
	changed = false;
	if (previousFirstRow != newFirstRow || previousSecondRow != newSecondRow) changed = true;
	
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
			if (changed) evaluateTextScrolling();
		} else { // Both rows have text, show them.
			$(".now-playing-titles .first-row").text(newFirstRow).attr("data-content", newFirstRow);
			$(".now-playing-titles .second-row").text(newSecondRow).attr("data-content", newSecondRow);
			$(".now-playing-titles").removeClass("logo one-row");
			$("#player-bar-info-area .focused-source").addClass("icon-only");
			clearTimeout(sourceNameTimeout);
			if (changed) evaluateTextScrolling();
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
	switchArtwork: switchArtwork,
	loadSmallSampleArtwork: loadSmallSampleArtwork,
	loadNonSquareArtwork: loadNonSquareArtwork,
	testArtworkSwap: testArtworkSwap,
	toggleLove: toggleLove,
	functionRow: functionRow,
	setUseExternalArtwork: setUseExternalArtwork,
	setDisableInternalArtwork: function(disable) {disableInternalArtwork = disable}
}

})();