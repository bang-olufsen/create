var nowPlayingData = {
	currentSource: {
		extension: null,
		name: null,
		icon: null
	},
	focusedSource: {
		extension: null,
		name: null,
		icon: null
	},
	pictureView: null,
	picture: null,
	extPicture: null,
	pictureA: null,
	pictureB: null,
	pictureCounter: 0,
	pictureADimensions: [0,0],
	pictureBDimensions: [0,0],
	pictureAAspect: 1, // 1: square, <1: landscape, >1: portrait.
	pictureBAspect: 1, // 1: square, <1: landscape, >1: portrait.
	placeholderPicture: null,
	extPictureMode: "never",
	metadata: {},
	playerState: "stopped",
	transportControls: [],
	canLove: false,
	canSeek: false,
	visible: false,
	notify: false,
	scrollH1: false,
	scrollH2: false,
	reveal: false,
	queueTracks: [],
	queuePosition: 0,
	queueSource: null,
	canClearQueue: false
}


Vue.component('MiniNowPlaying', {
	template: '<div class="mini-now-playing">\
	<div id="player-bar-chevron" class="button symbol" style="-webkit-mask-image: url(common/symbols-white/chevron-thin-up.svg); mask-image: url(common/symbols-white/chevron-thin-up.svg);" onclick="now_playing.showNowPlaying();" title="Show Now Playing"></div>\
		<div id="mini-now-playing-info" v-bind:class="{notification: notify > 0, text: notify > 1}">\
			<transition name="now-playing-fade" mode="out-in">\
				<div class="symbol focused-source-icon" :key="focusedSource.icon" v-if="focusedSource.icon" v-bind:style="{maskImage: \'url(\'+focusedSource.icon+\')\'}"></div>\
			</transition>\
			<div class="now-playing-titles" v-bind:class="{\'source-only\': (focusedSource.name && !metadata.title), \'one-row\': (metadata.title && !metadata.artist), \'two-rows\': (metadata.title && metadata.artist)}">\
				<transition name="now-playing-fade" mode="out-in">\
					<div class="focused-source-name" v-if="focusedSource.name">{{ focusedSource.name }}</div>\
				</transition>\
				<h1>\
					<transition name="now-playing-fade" mode="out-in">\
						<span class="title" :key="metadata.title" v-if="metadata.title">{{ metadata.title }}&nbsp;</span>\
					</transition>\
				</h1>\
				<h2>\
					<transition name="now-playing-fade" mode="out-in">\
						<span class="artist" :key="metadata.artist" v-if="metadata.title && metadata.artist">{{ metadata.artist }}&nbsp;</span>\
					</transition>\
				</h2>\
			</div>\
	</div></div>',
	data: function() {
		return nowPlayingData;
	}
});

Vue.component('TransportControls', {
	template: '<div class="now-playing-transport">\
					<div class="symbol button" v-bind:class="{disabled: transportControls.indexOf(\'next\') == -1}" v-bind:style="{maskImage: \'url('+extensions['now-playing'].assetPath+'/symbols-black/previous-track.svg)\'}" @click="previous()"></div>\
					<div class="symbol button" v-bind:class="{disabled: !playButtonEnabled}" v-bind:style="{maskImage: \'url(\'+playButtonSymbol+\')\'}" @click="playPause()"></div>\
					<div class="symbol button" v-bind:class="{disabled: transportControls.indexOf(\'next\') == -1}" v-bind:style="{maskImage: \'url('+extensions['now-playing'].assetPath+'/symbols-black/next-track.svg)\'}" @click="next()"></div>\
				</div>',
	data: function() {
		return nowPlayingData;
	},
	methods: {
		previous: function() {
			now_playing.transport('previous');
		},
		playPause: function() {
			now_playing.transport('playPause');
		},
		next: function() {
			now_playing.transport('next');
		}
	},
	computed: {
		playButtonEnabled: function() {
			if (this.playerState != "playing") {
				return (this.transportControls.indexOf("play") != -1) ? true : false;
			} else {
				return (this.transportControls.indexOf("pause") != -1 || this.transportControls.indexOf("stop") != -1) ? true : false;
			}
		},
		playButtonSymbol: function() {
			if (this.playerState != "playing") {
				symbol = "play";
			} else {
				if (this.transportControls.indexOf("pause") != -1) {
					symbol = "pause";
				} else {
					symbol = "stop";
				}
			}
			return extensions['now-playing'].assetPath+'/symbols-black/'+symbol+'.svg';
		}
	},
});


var miniNowPlaying = new Vue({
	el: "#player-bar",
	data: nowPlayingData
});

var nowPlayingController = new Vue({
	el: "#now-playing",
	data: nowPlayingData,
	computed: {
		trackInfo: function() {
			return this.metadata.title+this.metadata.artist+this.metadata.album;
		},
		artistAlbumString: function() {
			if (this.metadata.artist) {
				if (this.metadata.album) {
					return this.metadata.artist + " — " + this.metadata.album;
				} else {
					return this.metadata.artist;
				}
			} else {
				return null;
			}
		},
		remainingQueue: function() {
			var pos = this.queuePosition;
			return this.queueTracks.filter(function(track) {
				return track.queuePosition > pos;
			});
		}
	},
	methods: {
		pictureLoaded: function(event, view) { // Determine whether the newly loaded picture should be shown.
			console.log("Picture loaded (view "+view+"): "+event.target.src);
			if (view == "a") {
				this.pictureADimensions = [event.target.naturalWidth, event.target.naturalHeight];
				var otherDimensions = this.pictureBDimensions;
			} else {
				this.pictureBDimensions = [event.target.naturalWidth, event.target.naturalHeight];
				var otherDimensions = this.pictureADimensions;
			}
			var switchView = false;
			if (event.target.src == encodeURI(this.extPicture)) {
				switch (this.extPictureMode) {
					case "always":
						switchView = true;
						break;
					case "missing":
						if (!this.picture) switchView = true;
						break;
					case "auto":
						if (!this.picture) {
							switchView = true;
						} else {
							if (event.target.naturalWidth > otherDimensions[0] &&
								event.target.naturalHeight > otherDimensions[1]) {
								switchView = true;
								console.log("Switching to a higher resolution picture.");
							}
						}
						break;
				}
			} else if (event.target.src == encodeURI(this.picture)) {
				switch (this.extPictureMode) {
					case "always":
						if (!this.extPicture) switchView = true;
						break;
					case "auto":
						if (!this.extPicture) {
							switchView = true;
						} else {
							if (event.target.naturalWidth > otherDimensions[0] &&
								event.target.naturalHeight > otherDimensions[1]) {
								switchView = true;
								console.log("Switching to a higher resolution picture.");
							}
						}
						break;
					case "missing":
					case "never":
						switchView = true;
						break;
				}
			}
			if (switchView) {
				this.pictureView = view;
			}
		},
		pictureError: function(event) {
			console.error("Error loading picture: "+event.target.src);
			var switchToPlaceholder = false;
			if (view == "a") {
				this.pictureADimensions = [0,0];
				this.pictureA = null;
				if (!this.pictureB) switchToPlaceholder = true;
			} else {
				this.pictureBDimensions = [0,0];
				this.pictureB = null;
				if (!this.pictureA) switchToPlaceholder = true;
			}
			if (switchToPlaceholder) {
				setPlaceholderArtwork();
				this.pictureView = null;
			}
		},
		time: function(seconds) {
			return Intl.DateTimeFormat(window.navigator.language, {minute: "numeric", second: "numeric"}).format(new Date(seconds * 1000)).replace(/^0?/g, '');
		},
		playQueued: function(position) {
			now_playing.playQueued(position);
		},
		queueTrackAction: function(id, holdPosition) {
			now_playing.queueTrackMenu(id);
		}
	}
});


var now_playing = (function() {

var allSources = {};
var focusedSource = null;
var currentSource = null;

$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			beo.sendToProduct("now-playing", "useExternalArtwork");
		}
	}
	
});

var loveAnimTimeout;
$(document).on("now-playing", function(event, data) {
	
	if (data.header == "useExternalArtwork") {
		if (data.content.useExternalArtwork) {
			setUseExternalArtwork(data.content.useExternalArtwork, true);
//			updateMetadata();
		}
	}

	if (data.header == "queue") {
		if (data.content.source == focusedSource) {
			// Only allow queue to come in from the focused source.
			nowPlayingController.queueSource = focusedSource;
			nowPlayingController.canClearQueue = data.content.canClear;
			if (data.content.data) {
				if (data.content.data.tracks) {
					nowPlayingController.queueTracks = data.content.data.tracks;
				}
				if (data.content.data.position != undefined) {
					nowPlayingController.queuePosition = data.content.data.position;
				}
			}
		}
	}
});

$(document).on("sources", function(event, data) {
	if (data.header == "sources") {
		
		
		clearTimeout(playButtonSymbolTimeout);
		
		if (data.content.sources != undefined) {
			allSources = data.content.sources;
			if (data.content.focusedSource != undefined) {
				focusedSource = data.content.focusedSource;
				nowPlayingController.playerState = allSources[focusedSource].playerState;
				
				nowPlayingController.canLove = (data.content.sources[focusedSource].canLove) ? true : false;
				
				if (allSources[focusedSource].metadata != undefined) {
					nowPlayingController.metadata = allSources[focusedSource].metadata;
				} else {
					nowPlayingController.metadata = {};
				}
				if (allSources[focusedSource].transportControls) {
					if (allSources[focusedSource].transportControls == "inherit") {
						if (allSources[focusedSource].parentSource) {
							nowPlayingController.transportControls = allSources[allSources[focusedSource].parentSource].transportControls;
						} else {
							nowPlayingController.transportControls = [];
						}
					} else {
						nowPlayingController.transportControls = allSources[focusedSource].transportControls;
					}
				}
				if (nowPlayingController.queueSource != focusedSource) nowPlayingController.queueSource = null;
			} else {
				nowPlayingController.metadata = {};
				focusedSource = null;
				nowPlayingController.playerState = "stopped";
				nowPlayingController.transportControls = [];
				nowPlayingController.canLove = false;
				nowPlayingController.queueSource = null; 
			}
			determinePicture();
			
			// Which source is focused.
			if (focusedSource != null) {
				sourceIcon = null;
				sourceName = null;
				fSource = (allSources[focusedSource].childSource) ? allSources[focusedSource].childSource : focusedSource;
				if (allSources[fSource].aliasInNowPlaying) {
					sourceName = allSources[fSource].aliasInNowPlaying;
				} else if (allSources[fSource].alias) {
					if (allSources[fSource].alias.icon) {
						sourceIcon = extensions.sources.assetPath+"/symbols-black/"+allSources[fSource].alias.icon;
					}
					sourceName = allSources[fSource].alias.name;
				}
				if (!sourceIcon && 
					extensions[fSource].icon && 
					extensions[fSource].assetPath) {
						sourceIcon = extensions[fSource].assetPath+"/symbols-black/"+extensions[fSource].icon;
				}
				if (!sourceName) sourceName = extensions[fSource].title;
				
				nowPlayingController.focusedSource.name = sourceName;
				nowPlayingController.focusedSource.extension = fSource;
				nowPlayingController.focusedSource.icon = sourceIcon;
				
				if (extensions[focusedSource] &&
					extensions[focusedSource].namespace &&
					window[extensions[focusedSource].namespace].reveal) {
					nowPlayingController.reveal = true;
				} else {
					nowPlayingController.reveal = false;
				}
			} else {
				nowPlayingController.focusedSource.name = null;
				nowPlayingController.focusedSource.extension = null;
				nowPlayingController.focusedSource.icon = null;
				nowPlayingController.reveal = false;
			}
		}
	}

	
});

var nowPlayingNotificationTimeout;
nowPlayingController.$watch('trackInfo', function() {
	evaluateTextScrolling();
	if (nowPlayingController.trackInfo) showNowPlayingNotification();
});
nowPlayingController.$watch('playerState', function(state) {
	if (state == "playing") showNowPlayingNotification();
});

function showNowPlayingNotification() {
	nowPlayingController.notify = 1;
	clearTimeout(nowPlayingNotificationTimeout);
	nowPlayingNotificationTimeout = setTimeout(function() {
		nowPlayingController.notify = 2;
		nowPlayingNotificationTimeout = setTimeout(function() {
			nowPlayingController.notify = 0;
		}, 5000);
	}, 700);
}


function determinePicture() {
	if (nowPlayingController.metadata.picture &&
		(nowPlayingController.metadata.picture.startsWith("http://") ||
		 nowPlayingController.metadata.picture.startsWith("https://"))) {
		picture = nowPlayingController.metadata.picture;
	} else if (nowPlayingController.metadata.picture &&
		!nowPlayingController.metadata.picture.startsWith("file://")) {
		picture = window.location.protocol+"//"+window.location.hostname+":"+nowPlayingController.metadata.picturePort+"/"+nowPlayingController.metadata.picture;
		if (!nowPlayingController.placeholderPicture) setPlaceholderArtwork();
	} else {
		picture = null;
	}
	
	
	if (!picture) {
		nowPlayingController.picture = null;
		setPlaceholderArtwork();
	} else {
		if (nowPlayingController.picture != picture) {
			if (nowPlayingController.pictureView != "a") { // Load a picture to the currently hidden view.
				nowPlayingController.pictureA = picture;
			} else {
				nowPlayingController.pictureB = picture;
			}
			nowPlayingController.picture = picture;
		}
	}
	
	extPicture = null;
	if (nowPlayingController.metadata.externalPicture) {
		switch (nowPlayingController.extPictureMode) {
			
			case "missing":
				if (!picture) extPicture = nowPlayingController.metadata.externalPicture;
				break;
			case "auto":
			case "always":
				extPicture = nowPlayingController.metadata.externalPicture;
				break;
		}
	}
	if (extPicture != nowPlayingController.extPicture) {
		if (extPicture) {
			if (nowPlayingController.pictureView != "a") {
				if (!nowPlayingController.pictureB && 
				nowPlayingController.pictureA) {
					nowPlayingController.pictureB = extPicture; // If this view is still empty, load it here instead (freshly loaded page).
				} else {
					nowPlayingController.pictureA = extPicture;
				}
			} else {
				nowPlayingController.pictureB = extPicture;
			}
		}
		nowPlayingController.extPicture = extPicture;
	}
	
	// No pictures.
	if (!picture && !extPicture) nowPlayingController.pictureView = null;
	
}

function setPlaceholderArtwork() {
	if (focusedSource &&
		extensions[focusedSource] && 
		extensions[focusedSource].assetPath && 
		extensions[focusedSource].icon) {
		nowPlayingController.placeholderPicture = extensions[focusedSource].assetPath+"/symbols-black/"+extensions[focusedSource].icon;
	} else {
		if (document.body.classList.contains("hifiberry-os")) {
			nowPlayingController.placeholderPicture = extensions["now-playing"].assetPath+"/placeholder-hifiberry.svg";
		} else {
			nowPlayingController.placeholderPicture = extensions["now-playing"].assetPath+"/placeholder.svg";
		}
	}
}


function testPlaceholderArtwork() {
	nowPlayingController.metadata.picture = null;
	nowPlayingController.picturePre = null;
	nowPlayingController.metadata.externalPicture = null;
	determinePicture();
}

var hasQueue = false;
function showNowPlaying() {
	nowPlayingController.visible = true;
	if (focusedSource && !hasQueue) {
		beo.sendToProduct(focusedSource, "getQueue");
		hasQueue = true;
	}
	evaluateTextScrolling();
	/*setTimeout(function() {
		if (document.querySelector("#now-playing-upper").scrollTop > 0) {
			document.querySelector("#now-playing-right header").classList.add("opaque");
		};
		console.log("Scroll fix");
	}, 300);*/
}

function hideNowPlaying() {
	nowPlayingController.visible = false;
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
				nowPlayingController.extPictureMode = mode;
			} else {
				beo.sendToProduct("now-playing", "useExternalArtwork", {useExternalArtwork: mode});
				console.log("Resetting album picture view...");
				nowPlayingController.picture = null;
				nowPlayingController.extPicture = null;
				nowPlayingController.pictureView = null;
				nowPlayingController.pictureA = null;
				nowPlayingController.pictureB = null;
				nowPlayingController.pictureADimensions = [0,0];
				nowPlayingController.pictureBDimensions = [0,0];
				setTimeout(function() {
					determinePicture();
				}, 1000);
			}
			break;
	}
	
}

var playButtonSymbolTimeout;
function transport(action) {
	switch (action) {
		case "playPause":
			clearTimeout(playButtonSymbolTimeout); // Change the symbol immediately for more responsive feeling in the UI.
			if (nowPlayingController.playerState == "playing") {
				nowPlayingController.playerState = "stopped";
			} else {
				nowPlayingController.playerState = "playing";
			}
			playButtonSymbolTimeout = setTimeout(function() {
				if (nowPlayingController.playerState == "playing") {
					nowPlayingController.playerState = "stopped";
				} else {
					nowPlayingController.playerState = "playing";
				}
			}, 2000);
		case "next":
		case "previous":
			beo.sendToProduct("now-playing", "transport", {action: action});
			break;
	}
}

function toggleLove() {
	beo.sendToProduct("now-playing", "toggleLove");
}

var textScrollElements = ["#now-playing-main-info h1", "#now-playing-main-info h2"];
var textScrollIntervals = [];
var textScrollTimeouts = [];
var preventTextScrolling = false;

var textScrollSetupDelay;

function evaluateTextScrolling(flag) {
	// Checks whether text overflows the fields and sets up scrolling.
	// Reset
	
	clearTimeout(textScrollSetupDelay);
	textScrollSetupDelay = setTimeout(function() {
		nowPlayingController.scrollH1 = false;
		nowPlayingController.scrollH2 = false;
		
		for (var i = 0; i < textScrollElements.length; i++) {
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
		if (preventTextScrolling == false && flag != false && nowPlayingController.visible) {
	
			clearTimeout(textScrollSetupDelay);
			textScrollSetupDelay = setTimeout(function() {
				// timeout to prevent funny things happening when all labels have not yet received new text.
				// Get widths
	
				// iterate through elements
				var elementsToScroll = [];
				var longestDuration = 0;
				for (var i = 0; i < textScrollElements.length; i++) {
					containerWidth = document.querySelector(textScrollElements[i]).offsetWidth;
					containerWidthOverflow = document.querySelector(textScrollElements[i]).scrollWidth;
					if (containerWidthOverflow > containerWidth) {
						duration = containerWidthOverflow * 30 + 3000;
						if (duration > longestDuration) longestDuration = duration;
						elementsToScroll.push({index: i, width: containerWidthOverflow});
					}
				}
				
				for (i in elementsToScroll) {
					createTextScroller(elementsToScroll[i].index, elementsToScroll[i].width, longestDuration);
				}
			}, 500);
	
		}
	}, 500);
}

function createTextScroller(i, textWidth, intervalDelay) {
	// initial run
	textScrollTimeouts[i] = setTimeout(function() {
		document.querySelector(textScrollElements[i]).style.transitionDuration = ((textWidth) * 0.03 + "s");
		if (i == 0) nowPlayingController.scrollH1 = true;
		if (i == 1) nowPlayingController.scrollH2 = true;
		document.querySelector(textScrollElements[i]).style.transform = ("translateX(-" + (textWidth + 30) + "px)");
		// the interval takes over subsequent runs
		//intervalDelay = textWidth * 30 + 3000;
		textScrollIntervals[i] = setInterval(function() {
			if (i == 0) nowPlayingController.scrollH1 = false;
			if (i == 1) nowPlayingController.scrollH2 = false;
			document.querySelector(textScrollElements[i]).style.transitionDuration = "0s";
			document.querySelector(textScrollElements[i]).style.transform = ("translateX(0)");
			setTimeout(function() {
				document.querySelector(textScrollElements[i]).style.transitionDuration = ((textWidth) * 0.03 + "s");
				if (i == 0) nowPlayingController.scrollH1 = true;
				if (i == 1) nowPlayingController.scrollH2 = true;
				document.querySelector(textScrollElements[i]).style.transform = ("translateX(-" + (textWidth + 30) + "px)");
			}, 20);
		}, intervalDelay);
	}, 2000);
}

$(document).on("ui", function(event, data) {
	
	
	if (data.header == "windowResized") {
		evaluateTextScrolling();
	}
	
});


function revealSource() {
	if (nowPlayingController.reveal) {
		revealed = window[extensions[focusedSource].namespace].reveal();
		if (revealed) {
			hideNowPlaying();
		}
	}
}

function playQueued(position) {
	if (focusedSource) {
		beo.sendToProduct(focusedSource, "playQueued", {position: position});
	}
}

function clearQueue() {
	if (focusedSource) {
		beo.sendToProduct(focusedSource, "clearQueue");
	}
}

function queueTrackMenu(queueID) {
	queueTrack = null;
	for (t in nowPlayingController.remainingQueue) {
		if (nowPlayingController.remainingQueue[t].queueID == queueID) queueTrack = nowPlayingController.remainingQueue[t];
	}
	beo.ask("queue-track-menu", [queueTrack.name, queueTrack.artist], [
		function() {
			if (focusedSource) {
				beo.sendToProduct(focusedSource, "modifyQueue", {operation: "playNext", data: {id: queueID}});
			}
		},
		function() {
			if (focusedSource) {
				beo.sendToProduct(focusedSource, "modifyQueue", {operation: "remove", data: {id: queueID}});
			}
		},
		function() {
			if (focusedSource) {
				revealed = window[extensions[focusedSource].namespace].reveal(queueTrack.path);
				if (revealed) {
					hideNowPlaying();
				}
			}
		}
	]);
}


interactDictionary = {
	actions: {
		playPause: {
			name: "Play or Pause",
			icon: "extensions/now-playing/symbols-black/play-pause.svg",
			once: true,
			illegalWith: ["actions/now-playing/playPause"]
		},
		pause: {
			name: "Pause",
			icon: "extensions/now-playing/symbols-black/pause.svg",
			once: true,
			illegalWith: ["actions/now-playing/playPause"]
		},
		next: {
			name: "Next Track",
			icon: "extensions/now-playing/symbols-black/next-track.svg"
		},
		previous: {
			name: "Previous Track",
			icon: "extensions/now-playing/symbols-black/previous-track.svg"
		}
	}
}


return {
	showNowPlaying: showNowPlaying,
	hideNowPlaying: hideNowPlaying,
	transport: transport,
	toggleLove: toggleLove,
	testPlaceholderArtwork: testPlaceholderArtwork,
	setUseExternalArtwork: setUseExternalArtwork,
	evaluateTextScrolling: evaluateTextScrolling,
	setDisableInternalArtwork: function(disable) {disableInternalArtwork = disable},
	interactDictionary: interactDictionary,
	revealSource: revealSource,
	playQueued: playQueued,
	clearQueue: clearQueue,
	queueTrackMenu: queueTrackMenu
}

})();