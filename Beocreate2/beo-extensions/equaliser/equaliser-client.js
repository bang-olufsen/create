var equaliser = (function() {

var Fs = null;
var eqGraph = null;
var eqPreviewGraphSpeaker = null;
var eqPreviewGraphSoundDesign = null;
var dBScale = 15;
var displayQ = "oct";
var showAllChannels = true;
var uiSettingsLoaded = false;
var groupAB = false;
var groupCD = false;
var groupLR = false;
var equaliserMode = null // 0 for speaker equaliser, 1 for sound design.
var channelsToUse = "abcd";

var dspFilters = {
	a: [],
	b: [],
	c: [],
	d: [],
	l: [],
	r: []
};
var uiFilters = {
	a: [],
	b: [],
	c: [],
	d: [],
	l: [],
	r: []
};
var canControlEqualiser = {
  "a": 0,
  "b": 0,
  "c": 0,
  "d": 0,
  "l": 0,
  "r": 0
};
var disabledTemporarily = {
  "a": false,
  "b": false,
  "c": false,
  "d": false,
  "l": false,
  "r": false
};

const channelColours = {a: "red", b: "yellow", c: "green", d: "blue", l: "grey", r: "red"};
const graphColours = ["#FF3E46", "#FFAA46", "#2CD5C4", "#2C7FE4"];
const graphColoursSoundDesign = ["#999999", "#FF3E46"];

if (!eqGraph) eqGraph = new Beograph("equaliser-graph-container", {colours: graphColours, labels: {frequency: true, gain: true}});

if (!eqPreviewGraphSpeaker) eqPreviewGraphSpeaker = new Beograph("speaker-equaliser-preview", {resolution: 128, colours: graphColours, showZero: false, grid: false});
if (!eqPreviewGraphSoundDesign) eqPreviewGraphSoundDesign = new Beograph("sound-design-preview", {resolution: 128, colours: graphColoursSoundDesign, showZero: false, grid: false});

$(document).on("general", function(event, data) {
	if (data.header == "activatedExtension") {
		if (data.content.extension == "equaliser") {
			if (data.content.deepMenu == null) {
				beo.sendToProduct("equaliser", {header: "getPreviews"});
			}
			if (data.content.deepMenu == "equaliser-editor") {
				beo.sendToProduct("equaliser", {header: "getSettings"});
			}
		}
	}
	
});

const mathPI = Math.PI;

$(document).on("equaliser", function(event, data) {
	
	if (data.header == "previews" && data.content.filterResponses) {
		if (data.content.Fs) {
			Fs = data.content.Fs;
			eqPreviewGraphSpeaker.setOptions({Fs: Fs});
			eqPreviewGraphSoundDesign.setOptions({Fs: Fs});
			eqGraph.setOptions({Fs: Fs});
		}
		eqPreviewGraphSpeaker.store([0], {data: data.content.filterResponses.a.master, colour: 0});
		eqPreviewGraphSpeaker.store([1], {data: data.content.filterResponses.b.master, colour: 1});
		eqPreviewGraphSpeaker.store([2], {data: data.content.filterResponses.c.master, colour: 2});
		eqPreviewGraphSpeaker.store([3], {data: data.content.filterResponses.d.master, colour: 3}, true);
		
		eqPreviewGraphSoundDesign.store([0], {data: data.content.filterResponses.l.master, colour: 0});
		eqPreviewGraphSoundDesign.store([1], {data: data.content.filterResponses.r.master, colour: 1}, true);
	}
	
	if (data.header == "settings") {
		
		if (data.content.Fs) {
			Fs = data.content.Fs;
			eqGraph.setOptions({Fs: Fs});
		}
			
		
		if (data.content.canControl) canControlEqualiser = data.content.canControl;
		
		if (data.content.uiSettings) {
			
			if (data.content.uiSettings.dBScale != undefined) selectScale(data.content.uiSettings.dBScale, true);
		
			if (data.content.uiSettings.showAllChannels != undefined) {
				if (data.content.uiSettings.showAllChannels) {
					showAllChannels = true;
					$("#equaliser-show-all-channels-toggle").addClass("on");
				} else {
					showAllChannels = false;
					$("#equaliser-show-all-channels-toggle").removeClass("on");
				}
			}
			
			if (data.content.uiSettings.displayQ != undefined) selectQDisplay(data.content.uiSettings.displayQ, true);
			
			if (data.content.uiSettings.groupAB != undefined) groupAB = data.content.uiSettings.groupAB;
			if (data.content.uiSettings.groupCD != undefined) groupCD = data.content.uiSettings.groupCD;
			if (data.content.uiSettings.groupLR != undefined) groupLR = data.content.uiSettings.groupLR;
			
			uiSettingsLoaded = true;
		}
		newFilterIndex = (data.content.newFilterIndex != undefined) ? data.content.newFilterIndex : null;
		if (data.content.channels) {
			for (channel in data.content.channels) {
				if (channelsToUse.indexOf(channel) != -1) {
					loadFiltersForChannel(channel, data.content.channels[channel], newFilterIndex);
				}
			}
			selectChannel(); // Will automatically draw filters when ready.
		}
		groupChannels(false, true);
	}
	
	if (data.header == "setFilterProto") {
		
		if (data.content.added != undefined) {
			console.log("Added filter at index: "+data.content.added+".");
		}
		if (data.content.updated != undefined) {
			console.log("Updated filter at index: "+data.content.updated+".");
		}
	}
});


function showEqualiser(theEqualiser) {
	if (theEqualiser == "speaker-equaliser") {
		$("#equaliser-editor").addClass("speaker-equaliser").removeClass("sound-design");
		$(".equaliser-sound-design-listening-mode").addClass("hidden");
		if (equaliserMode != 0) {
			selectedFilter = 0;
			selectedChannel = "a";
			beo.showMenuTab("equaliser-ch-a", true);
			equaliserMode = 0;
			channelsToUse = "abcd";
			eqGraph.setOptions({colours: graphColours});
			$("#equaliser-add-filter-crossover-group").removeClass("hidden");
		}
	} else if (theEqualiser == "sound-design") {
		$(".equaliser-sound-design-listening-mode").removeClass("hidden");
		$("#equaliser-editor").removeClass("speaker-equaliser").addClass("sound-design");
		if (equaliserMode != 1) {
			selectedFilter = 0;
			selectedChannel = "l";
			beo.showMenuTab("equaliser-ch-l", true);
			equaliserMode = 1;
			channelsToUse = "lr";
			eqGraph.setOptions({colours: graphColoursSoundDesign});
			eqGraph.store([2, 3], {clearData: true});
			$("#equaliser-add-filter-crossover-group").addClass("hidden");
		}
	}
	beo.showDeepMenu("equaliser-editor");
}

function loadFiltersForChannel(channel, filtersToLoad, newFilterIndex = null) {
	if (canControlEqualiser[channel]) {
		dspFilters[channel] = filtersToLoad;
		channelIndex = channelsToUse.indexOf(channel);
		if (channel != selectedChannel) {
			show = (showAllChannels) ? true : false;
			faded = true;
		} else {
			show = true;
			faded = false;
		}
		eqGraph.store([channelIndex], {colour: channelIndex, clearData: true, faded: faded, show: show});
		uiFilters[channel] = [];
		if (dspFilters[channel].length == 0) {
			eqGraph.store([channelIndex], {coefficients: [1,0,0,1,0,0]});
		} else {
			for (var i = 0; i < dspFilters[channel].length; i++) {
				gainAtFc = calculateFilter(channel, i);
				filter = dspFilters[channel][i];
				
				if (filter.a1 != undefined &&
					filter.a2 != undefined &&
					filter.b0 != undefined &&
					filter.b1 != undefined &&
					filter.b2 != undefined) {
					// We have coefficients. Expects A0 to always be 1.
					positionUIFilter(true, channel, i, "coeffs", filter, null, newFilterIndex);
				} else if (filter.type != undefined) {
					// Parametric filter. Generate coefficients based on filter type.
					
					switch (filter.type) {
						case "peak":
							if (filter.frequency != undefined &&
							 	filter.Q != undefined && 
							 	filter.gain != undefined) {
								positionUIFilter(true, channel, i, "peak", filter, gainAtFc, newFilterIndex);
							}
							break;
						case "lowShelf":
							if (filter.frequency != undefined &&
							 	filter.Q != undefined && 
							 	filter.gain != undefined) {
								positionUIFilter(true, channel, i, "lowShelf", filter, gainAtFc, newFilterIndex);
							}
							break;
						case "highShelf":
							if (filter.frequency != undefined &&
							 	filter.Q != undefined && 
							 	filter.gain != undefined) {
								positionUIFilter(true, channel, i, "highShelf", filter, gainAtFc, newFilterIndex);
							}
							break;
						case "lowPass":
							if (filter.frequency != undefined) {
								positionUIFilter(true, channel, i, "lowPass", filter, gainAtFc, newFilterIndex);
							}
							break;
						case "highPass":
							if (filter.frequency != undefined) {
								positionUIFilter(true, channel, i, "highPass", filter, gainAtFc, newFilterIndex);
							}
							break;
					}
				}
			}
		}
	}
}

var autoSelectFilter = null;
function positionUIFilter(add, channel, index, type, filter, gainAtFc = null, newFilterIndex = null) {
	if (type == "coeffs") {
		bypass = (filter.bypass) ? true : false;
		newIndex = uiFilters[channel].push({type: "coeffs", index: index, bypass: bypass, frequency: null, gain: null, separateRight: false}) -1;
		if (newFilterIndex == index) autoSelectFilter = newIndex;
	} else {
		newIndex = null;
		hasHighPass = false;
		hasLowPass = false;
		separateRight = false;
		if (!add) {
			tempIndex = index;
			filter = dspFilters[channel][uiFilters[channel][tempIndex].index];
			index = uiFilters[channel][tempIndex].index;
			gainAtFc = uiFilters[channel][tempIndex].gainAtFc;
			uiFilters[channel].splice(tempIndex, 1);
		}
		for (var f = 0; f < uiFilters[channel].length; f++) {
			if (uiFilters[channel][f].type == "highPass") hasHighPass = true;
			if (uiFilters[channel][f].type == "lowPass") hasLowPass = true;
			
			if (filter.groupID != undefined && 
				typeof uiFilters[channel][f].index == "object") {
				if (filter.groupID == uiFilters[channel][f].groupID) {
					uiFilters[channel][f].index.push(index);
					newIndex = -1;
					uiFilters[channel][f].gainAtFc += gainAtFc;
					if (newFilterIndex == index) autoSelectFilter = f;
				}
			}
		}
		
		
		if (newIndex != -1) {
			if (filter.groupID != undefined) {
				index = [index];
			}
			if (filter.type == "highPass") {
				newIndex = 0;
				if (hasLowPass) {
					uiFilters[channel][0].separateRight = true; // Will move to position 1.
				} else {
					separateRight = true;
				}
			} else if (filter.type == "lowPass") {
				separateRight = true;
				if (hasHighPass) {
					newIndex = 1;
					uiFilters[channel][0].separateRight = false;
				} else {
					newIndex = 0;
				}
			} else {
				if (hasHighPass && hasLowPass) {
					startF = 2;
				} else if (hasHighPass || hasLowPass) {
					startF = 1;
				} else {
					startF = 0;
				} // Keeps the leftmost positions off-limits if high-pass or low-pass filters exist.
				for (var f = startF; f < uiFilters[channel].length; f++) {
					if (uiFilters[channel][f].frequency &&
						filter.frequency < uiFilters[channel][f].frequency) {
						newIndex = f;
						break;
					}
				}
				for (var f = startF; f < uiFilters[channel].length; f++) {
					if (uiFilters[channel][f].frequency &&
						filter.frequency >= uiFilters[channel][f].frequency) {
						newIndex = f+1;
					}
				}
			}
			if (newIndex == null) newIndex = uiFilters[channel].length; // Add to the end.
			if (newFilterIndex == index) autoSelectFilter = newIndex;
			bypass = (filter.bypass) ? true : false;
			uiFilters[channel].splice(newIndex, 0, {type: filter.type, index: index, frequency: filter.frequency, gain: filter.gain, bypass: bypass, separateRight: separateRight, gainAtFc: gainAtFc, origin: filter.origin});
			if (filter.crossoverType) uiFilters[channel][newIndex].crossoverType = filter.crossoverType;
			if (filter.groupID) uiFilters[channel][newIndex].groupID = filter.groupID;
		}
	}
	return newIndex;
}

function populateFilterBar() {
	$("#equaliser-filters .ui-equaliser-item, #equaliser-filters .separator").remove();
	coeffCount = 0;
	hasHighPass = false;
	hasLowPass = false;
	for (var f = 0; f < uiFilters[selectedChannel].length; f++) {
		switch (uiFilters[selectedChannel][f].type) {
			case "coeffs":
				icon = "filter-coeffs.svg";
				coeffCount++;
				break;
			case "highPass":
				icon = "filter-high-pass.svg";
				hasHighPass = true;
				break;
			case "lowPass":
				icon = "filter-low-pass.svg";
				hasLowPass = true;
				break;
			case "highShelf":
				icon = "filter-high-shelf.svg";
				if (uiFilters[selectedChannel][f].gain > 0) icon = "filter-high-shelf-up.svg";
				if (uiFilters[selectedChannel][f].gain < 0) icon = "filter-high-shelf-down.svg";
				break;
			case "lowShelf":
				icon = "filter-low-shelf.svg";
				if (uiFilters[selectedChannel][f].gain > 0) icon = "filter-low-shelf-up.svg";
				if (uiFilters[selectedChannel][f].gain < 0) icon = "filter-low-shelf-down.svg";
				break;
			case "peak":
				icon = "filter-peak.svg";
				if (uiFilters[selectedChannel][f].gain > 0) icon = "filter-peak-up.svg";
				if (uiFilters[selectedChannel][f].gain < 0) icon = "filter-peak-down.svg";
				break;
		}
		classes = "";
		if (uiFilters[selectedChannel][f].type != "coeffs") {
			label = Math.round(uiFilters[selectedChannel][f].frequency);
		} else {
			label = "C "+coeffCount;
		}
		if (uiFilters[selectedChannel][f].bypass) classes += "bypass ";
		
		$("#equaliser-filters > #add-filter-button").before('<div class="collection-row-item button pill grey hold ui-equaliser-item '+classes+'" onclick="equaliser.selectFilter('+f+', true);" data-hold="equaliser.deleteFilter(false, '+f+', holdPosition);" data-ui-filter-index="'+f+'"><div class="collection-row-item-content"><div class="symbol" style="-webkit-mask-image: url('+extensions.equaliser.assetPath+'/symbols-black/'+icon+'); mask-image: url('+extensions.equaliser.assetPath+'/symbols-black/'+icon+');"></div><div class="collection-row-item-text">'+label+'</div></div></div>');
		if (uiFilters[selectedChannel][f].separateRight) {
			$("#equaliser-filters > #add-filter-button").before('<div class="separator"></div>');
		} 
	}
	if (hasLowPass) {
		$(".add-low-pass-menu-item").addClass("disabled");
	} else {
		$(".add-low-pass-menu-item").removeClass("disabled");
	}
	
	if (hasHighPass) {
		$(".add-high-pass-menu-item").addClass("disabled");
	} else {
		$(".add-high-pass-menu-item").removeClass("disabled");
	}
	selectFilter();
}

var filterRepositionTimeout;

function updateFilterBarAndList(reposition) {
	// Updates the icon and text for the current filter and repositions the filter if necessary.
	icon = null;
	switch (uiFilters[selectedChannel][selectedFilter].type) {
		case "highShelf":
			icon = "filter-high-shelf.svg";
			if (uiFilters[selectedChannel][selectedFilter].gain > 0) icon = "filter-high-shelf-up.svg";
			if (uiFilters[selectedChannel][selectedFilter].gain < 0) icon = "filter-high-shelf-down.svg";
			break;
		case "lowShelf":
			icon = "filter-low-shelf.svg";
			if (uiFilters[selectedChannel][selectedFilter].gain > 0) icon = "filter-low-shelf-up.svg";
			if (uiFilters[selectedChannel][selectedFilter].gain < 0) icon = "filter-low-shelf-down.svg";
			break;
		case "peak":
			icon = "filter-peak.svg";
			if (uiFilters[selectedChannel][selectedFilter].gain > 0) icon = "filter-peak-up.svg";
			if (uiFilters[selectedChannel][selectedFilter].gain < 0) icon = "filter-peak-down.svg";
			break;
	}
	if (uiFilters[selectedChannel][selectedFilter].type != "coeffs") {
		label = Math.round(uiFilters[selectedChannel][selectedFilter].frequency);
	}
	$('#equaliser-filters .ui-equaliser-item[data-ui-filter-index="'+selectedFilter+'"] .collection-row-item-text').text(label);
	if (icon) {
		beo.setSymbol('#equaliser-filters .ui-equaliser-item[data-ui-filter-index="'+selectedFilter+'"] .symbol', extensions.equaliser.assetPath+'/symbols-black/'+icon);
	}
	
	if (uiFilters[selectedChannel][selectedFilter].bypass) {
		$('#equaliser-filters .ui-equaliser-item[data-ui-filter-index="'+selectedFilter+'"]').addClass("bypass");
	} else {
		$('#equaliser-filters .ui-equaliser-item[data-ui-filter-index="'+selectedFilter+'"]').removeClass("bypass");
	}
	
	if (uiFilters[selectedChannel][selectedFilter].type != "highPass" &&
		uiFilters[selectedChannel][selectedFilter].type != "lowPass" &&
		uiFilters[selectedChannel][selectedFilter].type != "coeffs" &&
		reposition == true) {
		newFilterPosition = positionUIFilter(false, selectedChannel, selectedFilter);
		if (newFilterPosition != selectedFilter) {
			// Filter should move.
			$('#equaliser-filters .ui-equaliser-item').addClass("no-animation");
			// Prepare animations.
			$('#equaliser-filters .ui-equaliser-item').each(function(index){
				if (index != selectedFilter) {
					if (index < selectedFilter) {
						if (newFilterPosition <= index) {
							$(this).addClass("shift-left");
						}
					} else {
						if (newFilterPosition >= index) {
							$(this).addClass("shift-right");
						}
					}
				}
				// [ ] [x] [ ] [ ] [ ]
				// [ ] [ ] [ ] [x] [ ]
			});
			
			// Make DOM changes.
			filterToMove = $('#equaliser-filters .ui-equaliser-item[data-ui-filter-index="'+selectedFilter+'"]').css("transform", "").detach();
			if (newFilterPosition+1 < uiFilters[selectedChannel].length) {
				$('#equaliser-filters .ui-equaliser-item').eq(newFilterPosition).before(filterToMove);
			} else {
				$('#equaliser-filters > #add-filter-button').before(filterToMove);
			}
			$('#equaliser-filters .ui-equaliser-item').each(function(index){
				if (index == newFilterPosition) {
					moveFilterBy = selectedFilter - newFilterPosition;
					$(this).css("transform", "translateX(calc("+moveFilterBy+"00% - "+(-1*moveFilterBy)+"0px))");
				}
				$(this).attr("data-ui-filter-index", index).attr("onclick", "equaliser.selectFilter("+index+", true);").attr("data-hold", "equaliser.deleteFilter(false, "+index+", holdPosition);");
			});
			selectedFilter = newFilterPosition;
			
			setTimeout(function() {
				
				$('#equaliser-filters .ui-equaliser-item').removeClass("no-animation");
			}, 10);
			setTimeout(function() {
			// Animate.
				$('#equaliser-filters .ui-equaliser-item').removeClass("shift-left shift-right");
				$('#equaliser-filters .ui-equaliser-item[data-ui-filter-index="'+selectedFilter+'"]').css("transform", "");
			}, 20);
		}
	}
}

var selectedChannel = "a";
function selectChannel(channelTab = selectedChannel) {
	selectedChannel = channelTab.substr(-1);
	//showLinked(selectedChannel);
	for (var channelIndex = 0; channelIndex < 4; channelIndex++) {
		channel = channelsToUse.charAt(channelIndex);
		if (channel != selectedChannel) {
			show = (showAllChannels) ? true : false;
			faded = true;
		} else {
			show = true;
			faded = false;
		}
		eqGraph.store([channelIndex], {faded: faded, show: show});
	}
	if (channelsToUse == "lr") {
		chText = (selectedChannel == "l") ? "Left channel" : "Right channel";
	} else {
		chText = "Channel "+selectedChannel.toUpperCase();
	}
	if (selectedChannel == "a" || selectedChannel == "b") {
		$("#equaliser-channel-grouping span").text("A & B");
		grouped = groupAB;
		if (grouped) chText = "Channels A & B";
	}
	if (selectedChannel == "c" || selectedChannel == "d") {
		$("#equaliser-channel-grouping span").text("C & D");
		grouped = groupCD;
		if (grouped) chText = "Channels C & D";
	}
	if (selectedChannel == "l" || selectedChannel == "r") {
		$("#equaliser-channel-grouping span").text("Left & Right");
		grouped = groupLR;
		if (grouped) chText = "Left & Right";
	}
	$(".equaliser-selected-channel").text(chText);
	(grouped) ? beo.setSymbol("#equaliser-group-channels-button", "common/symbols-black/link.svg") : beo.setSymbol("#equaliser-group-channels-button", "common/symbols-black/link-unlinked.svg");
	populateFilterBar();
	if (canControlEqualiser[selectedChannel] <= dspFilters[selectedChannel].length) {
		$("#add-filter-button").addClass("disabled");
	} else {
		$("#add-filter-button").removeClass("disabled");
	}
}

var selectedFilter = 0;
var selectedFilterFcOffset = 0;
var selectedFilterF1Offset = 0;
var selectedFilterF2Offset = 0;
function selectFilter(filter = selectedFilter, fromUI) {
	if (autoSelectFilter != null) {
		filter = autoSelectFilter;
		autoSelectFilter = null;
	}
	$(".ui-equaliser-item").removeClass("red yellow green blue grey selected");
	if (uiFilters[selectedChannel].length-1 < filter) {
		filter = uiFilters[selectedChannel].length-1;
		if (filter == -1) filter = 0;
	}
	$('.ui-equaliser-item[data-ui-filter-index="'+filter+'"]').addClass(channelColours[selectedChannel]+" selected");
	
	// Scroll to the selected filter.
	if ($('.ui-equaliser-item[data-ui-filter-index="'+filter+'"]').length) {
		if ($("#equaliser-collection-scroller").scrollLeft() > $('.ui-equaliser-item[data-ui-filter-index="'+filter+'"]').position().left + $("#equaliser-collection-scroller").scrollLeft() - 15) {
			// Content moves ->
			scrollLeft = Math.floor($('.ui-equaliser-item[data-ui-filter-index="'+filter+'"]').position().left + $("#equaliser-collection-scroller").scrollLeft() - 16);
			if (scrollLeft < 3) scrollLeft = 0;
			$("#equaliser-collection-scroller").animate({scrollLeft: scrollLeft}, 500);
		} else if ($("#equaliser-collection-scroller").scrollLeft()+$("#equaliser-collection-scroller").innerWidth() < $('.ui-equaliser-item[data-ui-filter-index="'+filter+'"]').position().left + $("#equaliser-collection-scroller").scrollLeft() + 73) {
			// <- Content moves
			scrollLeft = $('.ui-equaliser-item[data-ui-filter-index="'+filter+'"]').position().left + $("#equaliser-collection-scroller").scrollLeft() - $("#equaliser-collection-scroller").innerWidth() + 89;
			$("#equaliser-collection-scroller").animate({scrollLeft: scrollLeft}, 500);
		}
	}
	
	if (filter == selectedFilter && fromUI) { // Shortcut to toggle bypass.
		toggleBypass();
	} else {
		selectedFilter = filter;
		chIndex = channelsToUse.indexOf(selectedChannel);
		if (uiFilters[selectedChannel][selectedFilter]) {
			if (typeof uiFilters[selectedChannel][selectedFilter].index == "object") {
				eqGraph.copyData([[chIndex, uiFilters[selectedChannel][selectedFilter].index[0]]], [4]);
				eqGraph.copyData([[chIndex, uiFilters[selectedChannel][selectedFilter].index[1]]], [[4, 1]]);
				filterIndex = uiFilters[selectedChannel][selectedFilter].index[0];
			} else {
				eqGraph.copyData([[chIndex, uiFilters[selectedChannel][selectedFilter].index]], [4]);
				filterIndex = uiFilters[selectedChannel][selectedFilter].index;
			}
			eqGraph.store([4], {show: true, fill: true, lineWidth: 0, faded: true, colour: chIndex});
			if (uiFilters[selectedChannel][filter].frequency) {
				updateFilterUI(true);
			} else {
				updateFilterUI(false);
			}
			if (uiFilters[selectedChannel][filter].origin &&
				uiFilters[selectedChannel][filter].origin == "roomCompensation") {
				$("#filter-from-room-compensation").removeClass("hidden");
			} else {
				$("#filter-from-room-compensation").addClass("hidden");
			}
		} else {
			eqGraph.store([4], {show: false});
			updateFilterUI(false);
		}
		eqGraph.draw();
	}
}


var bandwidthDragEdge = 0;
var graphDimensions;
var bandwidthDrag = new Beodrag("#equaliser-graph-container .graph-handle-width-drag", {
	touchImmediately: true,
	pre: function( event, position ) {
		if ($(event.target).hasClass("left")) bandwidthDragEdge = 0;
		if ($(event.target).hasClass("right")) bandwidthDragEdge = 5;
		graphDimensions = eqGraph.getDimensions();
		$("#equaliser-graph-container .graph-handle-width").addClass("drag");
	},
	end: function( event, position ) {
		$("#equaliser-graph-container .graph-handle-width").removeClass("drag");
		updateFilterUI(true);
		showGraphLabel(false);
	},
	cancel: function(event, position) {
		$("#equaliser-graph-container .graph-handle-width").removeClass("drag");
	},
	move: function( event, position ) {
		dragX = ((position.elementX + bandwidthDragEdge - graphDimensions.x)/graphDimensions.w)*100;
		if (bandwidthDragEdge == 0) {
			if (selectedFilterFcOffset-dragX < 0.6) {
				dragX = selectedFilterFcOffset - 0.6;
			}
			$("#equaliser-graph-container .graph-handle-width").css("width", (selectedFilterFcOffset-dragX)*2+"%").css("margin-left", "-"+(selectedFilterFcOffset-dragX)+"%");
			F1 = convertHz(dragX, "log", 100);
			F2 = convertHz(dragX+(selectedFilterFcOffset-dragX)*2, "log", 100);
		} else {
			if (dragX-selectedFilterFcOffset < 0.6) {
				dragX = selectedFilterFcOffset + 0.6;
			}
			$("#equaliser-graph-container .graph-handle-width").css("width", (dragX-selectedFilterFcOffset)*2+"%").css("margin-left", "-"+(dragX-selectedFilterFcOffset)+"%");
			F2 = convertHz(dragX, "log", 100);
			F1 = convertHz(dragX-(dragX-selectedFilterFcOffset)*2, "log", 100);
		}
		
		setFilter("Q", getQFromCutoff(uiFilters[selectedChannel][selectedFilter].frequency, F1, F2), true, "Q");
	}
}, document.querySelector("#equaliser-editor"));

var gainDragStartPosition = 0;
var gainFcDrag = new Beodrag("#equaliser-graph-container .graph-handle", {
	touchImmediately: true,
	pre: function( event, position ) {
		graphDimensions = eqGraph.getDimensions();
		gainDragStartPosition = ((position.elementY - graphDimensions.y)/graphDimensions.h)*100;
		$("#equaliser-graph-container .graph-handle, #equaliser-graph-container .graph-handle-width").addClass("drag");
	},
	end: function( event, position) {
		$("#equaliser-graph-container .graph-handle, #equaliser-graph-container .graph-handle-width").removeClass("drag");
		updateFilterUI(true);
		updateFilterBarAndList(true);
		showGraphLabel(false);
	},
	cancel: function(event, position) {
		$("#equaliser-graph-container .graph-handle, #equaliser-graph-container .graph-handle-width").removeClass("drag");
	},
	move: function( event, position ) {
		dragX = ((position.elementX - graphDimensions.x)/graphDimensions.w)*100;
		dragY = ((position.elementY - graphDimensions.y)/graphDimensions.h)*100;
		
		
		Fc = convertHz(dragX, "log", 100);
		if (Fc < 10) Fc = 10;
		if (Fc > 20000) Fc = 20000;
		
		switch (uiFilters[selectedChannel][selectedFilter].type) {
			case "highShelf":
			case "lowShelf":
				$("#equaliser-graph-container .graph-handle").removeClass("hidden").css("left", dragX+"%").css("top", gainDragStartPosition+(dragY-gainDragStartPosition)/2+"%");
				
				gain = Math.round(-1*((dragY-50)/50*dBScale + ((gainDragStartPosition-50)/50*dBScale))*10)/10; // Offset with existing gain.
				setFilter("frequency", Fc, false);
				setFilter("gain", gain, true, "gainAndFrequency");
				break;
			case "highPass":
			case "lowPass":
				$("#equaliser-graph-container .graph-handle").removeClass("hidden").css("left", dragX+"%");
				setFilter("frequency", Fc, true, "frequency");
				break;
			default:
				gain = Math.round(-1*((dragY-50)/50*dBScale)*10)/10;
				$("#equaliser-graph-container .graph-handle").removeClass("hidden").css("left", dragX+"%").css("top", dragY+"%");
				setFilter("frequency", Fc, false);
				setFilter("gain", gain, true, "gainAndFrequency");
				break;
		}
		
	}
}, document.querySelector("#equaliser-editor"));


// GRAPH RESIZE
if (localStorage.beocreateEqualiserGraphHeight) {
	$("#equaliser-graph-container").css("height", localStorage.beocreateEqualiserGraphHeight+"%");
}

var newGraphHeight = 0;
var graphDividerDrag = new Beodrag("#equaliser-graph-divider", {
	end: function( event, position ) {
		localStorage.beocreateEqualiserGraphHeight = newGraphHeight;
	},
	move: function( event, position ) {
		newGraphHeight = ((position.elementY - $("#equaliser-editor").offset().top) / $("#equaliser-editor").innerHeight())*100;
		if (newGraphHeight < 20) newGraphHeight = 20;
		if (newGraphHeight > 60) newGraphHeight = 60;
		$("#equaliser-graph-container").css("height", newGraphHeight+"%");
		eqGraph.draw();
	}
}, document.querySelector("#equaliser-editor"));



var controlSquareParameter = null;
var controlSquareLastPosition = [0, 0];
var deltaAlternate = false;
var dragPrecision = 1;
if ($("body").hasClass("touch")) dragPrecision = 2;

var controlSquareDrag = new Beodrag(".filter-controls .control-square-wrap", {
	touchImmediately: true,
	pre: function( event, position ) {
		
		controlSquareLastPosition = [position.pageX, position.pageY];
		$("#equaliser-graph-container .graph-handle-width").addClass("drag");
		if ($(event.target).parent().hasClass("equaliser-fc-control")) controlSquareParameter = "frequency";
		if ($(event.target).parent().hasClass("equaliser-gain-control")) controlSquareParameter = "gain";
		if ($(event.target).parent().hasClass("equaliser-q-control")) controlSquareParameter = "Q";
		deltaAlternate = 0;
	},
	end: function( event, position ) {
		$("#equaliser-graph-container .graph-handle-width").removeClass("drag");
		updateFilterUI(true);
		updateFilterBarAndList(true);
		showGraphLabel(false);
	},
	move: function( event, position ) {
		deltaX = position.pageX - controlSquareLastPosition[0];
		deltaY = position.pageY - controlSquareLastPosition[1];
		console.log(deltaY);
		
		switch (controlSquareParameter) {
			case "frequency":
				Fc = uiFilters[selectedChannel][selectedFilter].frequency;
				if (deltaX > 7 || deltaX < -7) {
					// Turbo drag.
					if (Fc > 1000) {
						Fc = Math.round(Fc + deltaX*100);
						if (Fc < 1000) Fc = 1000;
					} else if (Fc > 100) {
						Fc += Math.round(deltaX*10);
						if (Fc < 100) Fc = 100;
					} else {
						Fc += Math.round(deltaX);
					}
				} else if (deltaX > 1 || deltaX < -1) {
					// Accelerated drag.
					if (Fc > 1000) {
						Fc = Math.round(Fc + deltaX*10);
						if (Fc < 1000) Fc = 1000;
					} else if (Fc > 100) {
						Fc += Math.round(deltaX*2);
						if (Fc < 100) Fc = 100;
					} else {
						Fc += Math.round(deltaX/2);
					}
				} else {
					if (deltaAlternate >= dragPrecision) Fc += Math.round(deltaX);
				}
				
				if (Fc < 10) Fc = 10;
				if (Fc > 20000) Fc = 20000;
				setFilter("frequency", Fc, 2, "frequency");
				break;
			case "gain":
				gain = dspFilters[selectedChannel][uiFilters[selectedChannel][selectedFilter].index].gain*10;
				if (deltaY > 3) {
					// Turbo drag.
					gain += (deltaY*-5);
				} else {
					if (deltaAlternate >= dragPrecision) gain += (deltaY*-1);
				}
				setFilter("gain", gain/10, 2, "gain");
				break;
			case "Q":
				index = (typeof uiFilters[selectedChannel][selectedFilter].index == "number") ? uiFilters[selectedChannel][selectedFilter].index : uiFilters[selectedChannel][selectedFilter].index[0];
				Q = Math.round(dspFilters[selectedChannel][index].Q * 100);
				if (deltaX > 7 || deltaX < -7) {
					// Turbo drag.
					if (Q >= 100) {
						Q += deltaX*-10;
					} else if (Q >= 50) {
						Q += deltaX*-5;
					} else {
						if (deltaAlternate >= dragPrecision) Q += deltaX*-1;
					}
				} else {
					if (deltaAlternate >= dragPrecision) Q += (deltaX*-1);
				}
				if (Q < 1) Q = 1;
				setFilter("Q", Q/100, 2, "Q");
				break;
		}
		deltaAlternate++;
		if (deltaAlternate > dragPrecision) deltaAlternate = 0; // More precise dragging at slow speeds.
		controlSquareLastPosition = [position.pageX, position.pageY];
	}
}, document.querySelector("#equaliser-editor"));

function step(parameter, direction) {
	delta = (direction) ? 1 : -1;
	switch (parameter) {
		case "frequency":
			Fc = uiFilters[selectedChannel][selectedFilter].frequency;
			if (Fc >= 1000) {
				Fc = (delta == 1) ? Math.floor(Fc/100)*100 : Math.ceil(Fc/100)*100;
				Fc += + delta*100;
			} else if (Fc >= 100) {
				Fc = (delta == 1) ? Math.floor(Fc/10)*10 : Math.ceil(Fc/10)*10;
				Fc += delta*10;
			} else {
				Fc += + delta;
			}
			if (Fc < 10) Fc = 10;
			if (Fc > 20000) Fc = 20000;
			setFilter("frequency", Fc, 2, "frequency", true);
			break;
		case "gain":
			gain = dspFilters[selectedChannel][uiFilters[selectedChannel][selectedFilter].index].gain;
			gain = (delta == 1) ? Math.floor(gain*2)/2 : Math.ceil(gain*2)/2;
			gain += delta/2;
			setFilter("gain", gain, 2, "gain", true);
			break;
		case "Q":
			index = (typeof uiFilters[selectedChannel][selectedFilter].index == "number") ? uiFilters[selectedChannel][selectedFilter].index : uiFilters[selectedChannel][selectedFilter].index[0];
			Q = Math.round(dspFilters[selectedChannel][index].Q * 100);
			if (Q >= 100) {
				Q = (delta == -1) ? Math.floor(Q/10)*10 : Math.ceil(Q/10)*10;
				Q += delta*-10;
			} else if (Q >= 50) {
				Q = (delta == -1) ? Math.floor(Q/5)*5 : Math.ceil(Q/5)*5;
				Q += delta*-5;
			} else {
				Q += delta*-1;
			}
			if (Q < 1) Q = 1;
			setFilter("Q", Q/100, 2, "Q", true);
			break;
	}
}

function toggleBypass(index = null) {
	if (index == null) index = selectedFilter;
	bypass = (uiFilters[selectedChannel][index].bypass) ? false : true;
	if (bypass == false)  {
		if (typeof uiFilters[selectedChannel][index] == "object")  {
			if (uiFilters[selectedChannel][index].type == "highPass" ||
				uiFilters[selectedChannel][index].type == "lowPass") {
				// Enable one or both filters based on crossover type.
				switch (uiFilters[selectedChannel][index].crossoverType) {
					case "BW2":
					case "custom2":
						bypass = [false, true];
						break;
					default:
						bypass = [false, false];
						break;
				}
			}
		}
	}
	setFilter("bypass", bypass);
}

var graphLabelHideTimeout;
function showGraphLabel(data, autoHide, hideNow) {
	if (data) {
		labelMarkup = "";
		for (var i = 0; i < data.length; i++) {
			// Array item is row.
			if (data[i].unitFirst) {
				labelMarkup += '<div><span class="unit">'+data[i].unit+'</span><span class="value">'+data[i].value+'</span></div>';
			} else {
				labelMarkup += '<div><span class="value">'+data[i].value+'</span><span class="unit">'+data[i].unit+'</span></div>';
			}
		}
		$("#equaliser-graph-container .graph-tooltip").html(labelMarkup);
		$("#equaliser-graph-container .graph-tooltip").addClass("visible");
		$("#equaliser-graph-container .graph-tooltip").css("margin-left", "-"+ $("#equaliser-graph-container .graph-tooltip").innerWidth()/2+"px").css("margin-top", "-"+($("#equaliser-graph-container .graph-tooltip").innerHeight()+20)+"px");
		clearTimeout(graphLabelHideTimeout);
		if (autoHide) {
			graphLabelHideTimeout = setTimeout(function() {
				$("#equaliser-graph-container .graph-tooltip").removeClass("visible");
			}, 2000);
		}
	} else {
		if (hideNow) {
			$("#equaliser-graph-container .graph-tooltip").removeClass("visible");
			clearTimeout(graphLabelHideTimeout);
		} else {
			graphLabelHideTimeout = setTimeout(function() {
				$("#equaliser-graph-container .graph-tooltip").removeClass("visible");
			}, 2000);
		}
	}
}


function setFilter(parameter, value, calculateAndDraw = true, tooltip = false, tooltipAutoHide = false) {
	channel = selectedChannel; 
	uiFilter = selectedFilter;
	filterIndex = uiFilters[channel][uiFilter].index;
	duplicateToChannel = null;
	if (channel == "a" && groupAB) duplicateToChannel = "b";
	if (channel == "b" && groupAB) duplicateToChannel = "a";
	if (channel == "c" && groupCD) duplicateToChannel = "d";
	if (channel == "d" && groupCD) duplicateToChannel = "c";
	if (channel == "l" && groupLR) duplicateToChannel = "r";
	if (channel == "r" && groupLR) duplicateToChannel = "l";
	
	if (typeof filterIndex == "number") {
		switch (parameter) {
			case "gain":
				dspFilters[channel][filterIndex].gain = value;
				uiFilters[channel][uiFilter].gain = value;
				break;
			case "Q":
				dspFilters[channel][filterIndex].Q = value;
				break;
			case "frequency":
				dspFilters[channel][filterIndex].frequency = value;
				uiFilters[channel][uiFilter].frequency = value;
				break;
			case "bypass":
				dspFilters[channel][filterIndex].bypass = value;
				uiFilters[channel][uiFilter].bypass = value;
				break;
			case "coeffs":
				dspFilters[channel][filterIndex] = value;
				break;
		}
		if (duplicateToChannel) {
			dspFilters[duplicateToChannel][filterIndex] = _.clone(dspFilters[channel][filterIndex]);
			uiFilters[duplicateToChannel][uiFilter] = _.clone(uiFilters[channel][uiFilter]);
		}
		if (calculateAndDraw) {
			updateFilterUI(true, (calculateAndDraw > 1) ? null : parameter, tooltip, tooltipAutoHide);
			updateFilterBarAndList();
			gainAtFc = calculateFilter(channel, filterIndex);
			uiFilters[channel][uiFilter].gainAtFc = gainAtFc;
			channelIndex = channelsToUse.indexOf(channel);
			eqGraph.copyData([[channelIndex, filterIndex]], [4]);
			if (duplicateToChannel) {
				duplicateIndex = channelsToUse.indexOf(duplicateToChannel);
				eqGraph.copyData([channelIndex], [duplicateIndex]);
			}
			eqGraph.draw();
		}
	} else {
		// High or low-pass filter
		if (typeof value != "object") value = [value, value];
		switch (parameter) {
			case "frequency":
				dspFilters[channel][filterIndex[0]].frequency = value[0];
				dspFilters[channel][filterIndex[1]].frequency = value[1];
				uiFilters[channel][uiFilter].frequency = value[0];
				break;
			case "Q":
				dspFilters[channel][filterIndex[0]].Q = value[0];
				dspFilters[channel][filterIndex[1]].Q = value[1];
				break;
			case "bypass":
				dspFilters[channel][filterIndex[0]].bypass = value[0];
				dspFilters[channel][filterIndex[1]].bypass = value[1];
				if (value[0] == true && value[1] == true) {
					uiFilters[channel][uiFilter].bypass = true;
				} else {
					uiFilters[channel][uiFilter].bypass = false;
				}
				break;
		}
		if (duplicateToChannel) {
			dspFilters[duplicateToChannel][filterIndex[0]] = _.clone(dspFilters[channel][filterIndex[0]]);
			dspFilters[duplicateToChannel][filterIndex[1]] = _.clone(dspFilters[channel][filterIndex[1]]);
			uiFilters[duplicateToChannel][uiFilter] = _.clone(uiFilters[channel][uiFilter]);
		}
		gainAtFc = calculateFilter(channel, filterIndex[0]);
		gainAtFc += calculateFilter(channel, filterIndex[1]);
		uiFilters[channel][uiFilter].gainAtFc = gainAtFc;
		updateFilterUI(true, (calculateAndDraw > 1) ? null : parameter, tooltip, tooltipAutoHide);
		updateFilterBarAndList();
		channelIndex = channelsToUse.indexOf(channel);
		eqGraph.copyData([[channelIndex, filterIndex[0]]], [4]);
		eqGraph.copyData([[channelIndex, filterIndex[1]]], [[4, 1]]);
		if (duplicateToChannel) {
			duplicateIndex = channelsToUse.indexOf(duplicateToChannel);
			eqGraph.copyData([channelIndex], [duplicateIndex]);
		}
		eqGraph.draw();
	}
	sendFilter();
}

var filterSendTimeout = null;
var filterLastSent = 0;
function sendFilter(channel = selectedChannel, filter = selectedFilter) {
	if (typeof uiFilters[channel][filter].index == "number") {
		content = {items: [{channel: channel, index: uiFilters[channel][filter].index, filter: dspFilters[channel][uiFilters[channel][filter].index]}]};
	} else {
		content = {items: [
			{channel: channel, index: uiFilters[channel][filter].index[0], filter: dspFilters[channel][uiFilters[channel][filter].index[0]]},
			{channel: channel, index: uiFilters[channel][filter].index[1], filter: dspFilters[channel][uiFilters[channel][filter].index[1]]}
			]};
	}
	timestamp = new Date().getTime();
	if (timestamp - filterLastSent < 100) { // Allow sending 10 times per second.
		clearTimeout(filterSendTimeout);
		filterSendTimeout = setTimeout(function() {
			beo.sendToProduct("equaliser", {header: "setFilter", content: content});
			filterLastSent = new Date().getTime();
		}, 100 - (timestamp - filterLastSent));
	} else {
		beo.sendToProduct("equaliser", {header: "setFilter", content: content});
		filterLastSent = timestamp;
	}
}

function addFilter(type) {
	if (!type) {
		beo.ask("equaliser-add-filter");
	} else {
		beo.ask();
		beo.sendToProduct("equaliser", {header: "addFilter", content: {channel: selectedChannel, type: type}});
	}
}

filterToDelete = null;
function deleteFilter(confirmed, index = null) {
	if (confirmed) {
		index = (filterToDelete == null) ? selectedFilter : filterToDelete;
		filterToDelete = null;
		beo.ask();
		$('#equaliser-filters .ui-equaliser-item[data-ui-filter-index="'+index+'"]').addClass("deleted");
		setTimeout(function() {
			beo.sendToProduct("equaliser", {header: "deleteFilter", content: {channel: selectedChannel, filter: uiFilters[selectedChannel][index].index}});
		}, 500);
	} else {
		filterToDelete = index;
		beo.ask("equaliser-delete-prompt");
	}
}

function deleteAllFilters(confirmed) {
	if (confirmed) {
		beo.ask();
		$('#equaliser-filters .ui-equaliser-item').addClass("deleted");
		setTimeout(function() {
			beo.sendToProduct("equaliser", {header: "deleteAllFilters", content: {channel: selectedChannel}});
		}, 500);
	} else {
		beo.ask("equaliser-delete-all-prompt");
	}
}

var compareTimeout = null;
function compare(on, touch = false) {
	if (touch == document.documentElement.classList.contains("touch")) {
		if (on) {
			clearTimeout(compareTimeout);
			$("#equaliser-compare-prompt").text("Comparing with all filters turned off").addClass("visible");
			beo.sendToProduct("equaliser", {header: "compare", content: {channel: selectedChannel, on: true}});
			compareTimeout = setTimeout(function() {
				compareTimeout = null;
			}, 500);
		} else {
			if (compareTimeout) {
				clearTimeout(compareTimeout);
				$("#equaliser-compare-prompt").text("Press and hold the ear to compare");
				compareTimeout = setTimeout(function() {
					compareTimeout = null;
					$("#equaliser-compare-prompt").removeClass("visible");
				}, 3000);
			} else {
				$("#equaliser-compare-prompt").removeClass("visible");
			}
			beo.sendToProduct("equaliser", {header: "compare", content: {channel: selectedChannel, on: false}});
		}
	}
}

function updateFilterUI(show = true, excludeParameter, tooltip, tooltipAutoHide) {
	gainMultiplier = 1;
	uiToShow = null;
	if (uiFilters[selectedChannel][selectedFilter]) {
		index = uiFilters[selectedChannel][selectedFilter].index;
		switch (uiFilters[selectedChannel][selectedFilter].type) {
			case "coeffs":
				uiToShow = "coeffs";
				title = "Custom filter";
				break;
			case "highPass":
				uiToShow = "crossover";
				title = "Pass high frequencies";
				break;
			case "lowPass":
				uiToShow = "crossover";
				title = "Pass low frequencies";
				break;
			case "highShelf":
				uiToShow = "parametric";
				title = "High shelf filter";
				gainMultiplier = 0.5; // To show the drag handle on the graph.
				break;
			case "lowShelf":
				uiToShow = "parametric";
				title = "Low shelf filter";
				gainMultiplier = 0.5;
				break;
			case "peak":
				uiToShow = "parametric";
				title = "Peak or dip filter";
				if (dspFilters[selectedChannel][index].gain > 0) title = "Peaking filter";
				if (dspFilters[selectedChannel][index].gain < 0) title = "Dip filter";
				break;
		}
		
		$("#equaliser-filter-name").text(title);
		$(".filter-controls").addClass("hidden");
		$("#"+uiToShow+"-controls, .common-filter-controls").removeClass("hidden");
		if (uiFilters[selectedChannel][selectedFilter].bypass) {
			$("#"+uiToShow+"-controls").addClass("disabled");
			$("#equaliser-filter-enabled").removeClass("on");
			show = false;
		} else {
			$("#"+uiToShow+"-controls").removeClass("disabled");
			$("#equaliser-filter-enabled").addClass("on");
		}
		
		showBandwidthHandle = false;
		showFcGainHandle = true;
		switch (uiFilters[selectedChannel][selectedFilter].type) {
			case "coeffs":
				$("#save-equaliser-coefficients-button, #revert-equaliser-coefficients-button").addClass("disabled");
				$("#equaliser-coefficient-preview-message").addClass("hidden");
				showFcGainHandle = false;
				tempCoeffs =   {a0: 1, 
								a1: dspFilters[selectedChannel][uiFilters[selectedChannel][selectedFilter].index].a1, 
								a2: dspFilters[selectedChannel][uiFilters[selectedChannel][selectedFilter].index].a2, 
								b0: dspFilters[selectedChannel][uiFilters[selectedChannel][selectedFilter].index].b0, 
								b1: dspFilters[selectedChannel][uiFilters[selectedChannel][selectedFilter].index].b1, 
								b2: dspFilters[selectedChannel][uiFilters[selectedChannel][selectedFilter].index].b2};
				tempCoefficientsChanged = false;
				$("#coeffs-a1 .menu-value").val(tempCoeffs.a1);
				$("#coeffs-a2 .menu-value").val(tempCoeffs.a2);
				$("#coeffs-b0 .menu-value").val(tempCoeffs.b0);
				$("#coeffs-b1 .menu-value").val(tempCoeffs.b1);
				$("#coeffs-b2 .menu-value").val(tempCoeffs.b2);
				break;
			case "highPass":
			case "lowPass":
				index = index[0];
				gain = uiFilters[selectedChannel][selectedFilter].gainAtFc;
				switch (uiFilters[selectedChannel][selectedFilter].crossoverType) {
					case "BW2":
						crossoverType = "Butterworth 12 dB/oct";
						break;
					case "BW4":
						crossoverType = "Butterworth 24 dB/oct";
						break;
					case "LR4":
						crossoverType = "Linkwitz-Riley 24 dB/oct";
						break;
					case "custom2":
						crossoverType = "Custom 2nd order";
						showBandwidthHandle = true;
						break;
					case "custom4":
						crossoverType = "Custom 4th order";
						showBandwidthHandle = true;
						break;
				}
				if (showBandwidthHandle) {
					$("#crossover-fc-control").removeClass("all-borders");
					$("#crossover-q-control").removeClass("hidden");
				} else {
					$("#crossover-fc-control").addClass("all-borders");
					$("#crossover-q-control").addClass("hidden");
				}
				$(".crossover-type").text(crossoverType);
				break;
			case "highShelf":
			case "lowShelf":
			case "peak":
				gain = dspFilters[selectedChannel][filterIndex].gain;
				showBandwidthHandle = true;
				break;
		}
			
		if (!show) {
			showBandwidthHandle = false;
			showFcGainHandle = false;
		}
		if (showBandwidthHandle || showFcGainHandle) {
			colour = (equaliserMode == 0) ? graphColours[chIndex] : graphColoursSoundDesign[chIndex];
			selectedFilterFcOffset = convertHz(uiFilters[selectedChannel][selectedFilter].frequency, "linear", 100);
			// Frequency / gain.
			if (excludeParameter != "gain" && excludeParameter != "frequency") {
				$("#equaliser-graph-container .graph-handle").css("top", (50-(gain*gainMultiplier/dBScale)*50)+"%").css("color", colour);
				$("#equaliser-graph-container .graph-handle").css("left", selectedFilterFcOffset+"%").css("color", colour);
			}
			$("#equaliser-graph-container .graph-handle-width").css("color", colour).css("left", selectedFilterFcOffset+"%").css("top", (50-(gain*gainMultiplier/dBScale)*50)+"%");
			
			if (tooltip == "gain") {
				showGraphLabel([{unit: "dB", value: gain}], tooltipAutoHide);
			} else if (tooltip == "frequency") {
				showGraphLabel([{unit: "Hz", value: Math.round(Fc)}], tooltipAutoHide);
			} else if (tooltip == "gainAndFrequency") {
				showGraphLabel([{unit: "Hz", value: Math.round(Fc)}, {unit: "dB", value: Math.round(gain*10)/10}], tooltipAutoHide);
			}
			
			
			
			$("#equaliser-graph-container .graph-tooltip").css("left", selectedFilterFcOffset+"%").css("top", (50-(gain*gainMultiplier/dBScale)*50)+"%");
			
			$(".filter-frequency").text(Math.round(dspFilters[selectedChannel][index].frequency));
			$(".filter-gain").text(Math.round(dspFilters[selectedChannel][index].gain*10)/10);
			
			// Bandwidth.
			if (dspFilters[selectedChannel][index].Q) {
				if (excludeParameter != "Q") {
					F1F2 = getCutoffFrequencies(dspFilters[selectedChannel][index].frequency, dspFilters[selectedChannel][index].Q)
					selectedFilterF1Offset = convertHz(F1F2[0], "linear", 100);
					selectedFilterF2Offset = convertHz(F1F2[1], "linear", 100);
					$("#equaliser-graph-container .graph-handle-width").css("width", (selectedFilterFcOffset-selectedFilterF1Offset)*2+"%").css("margin-left", "-"+(selectedFilterFcOffset-selectedFilterF1Offset)+"%");
				}
				if (displayQ == "Q") {
					Q = dspFilters[selectedChannel][index].Q;
					$(".filter-bandwidth").text(Math.round(Q*100)/100);
					if (tooltip == "Q") showGraphLabel([{unit: "Q", value: Math.round(Q*100)/100, unitFirst: true}], tooltipAutoHide); 
				} else {
					width = getBandwidth(dspFilters[selectedChannel][index].Q).toFixed(2);
					$(".filter-bandwidth").text(width);
					if (tooltip == "Q") showGraphLabel([{unit: "oct", value: width}], tooltipAutoHide); 
				}
			}
		}
		
		$("#equaliser-no-filters-message").addClass("hidden");
	} else {
		// #nofilter
		showBandwidthHandle = false;
		showFcGainHandle = false;
		$(".filter-controls, .common-filter-controls").addClass("hidden");
		$("#equaliser-no-filters-message").removeClass("hidden");
	}
		
	if (showBandwidthHandle) {
		$("#equaliser-graph-container .graph-handle-width").removeClass("hidden");
	} else {
		$("#equaliser-graph-container .graph-handle-width").addClass("hidden");
	}
	if (showFcGainHandle) {
		$("#equaliser-graph-container .graph-handle").removeClass("hidden");
	} else {
		$("#equaliser-graph-container .graph-handle").addClass("hidden");
	}
	

}


function calculateFilter(channel, filterIndex, store = true) {
	filter = dspFilters[channel][filterIndex];
	channelIndex = channelsToUse.indexOf(channel);
	getGainAtFc = null;
	if (filter.bypass) {
		coeffs = [1,0,0,1,0,0];
	} else {
		if (filter.a1 != undefined &&
			filter.a2 != undefined &&
			filter.b0 != undefined &&
			filter.b1 != undefined &&
			filter.b2 != undefined) {
			// We have coefficients. Expects A0 to always be 1.
			coeffs = [1, filter.a1, filter.a2, filter.b0, filter.b1, filter.b2];
		} else if (filter.type != undefined) {
			// Parametric filter. Generate coefficients based on filter type.
			
			switch (filter.type) {
				case "peak":
					if (filter.frequency != undefined &&
					 	filter.Q != undefined && 
					 	filter.gain != undefined) {
						coeffs = beoDSP.peak(Fs, filter.frequency, filter.gain, filter.Q, 0);
						getGainAtFc = filter.frequency;
					}
					break;
				case "lowShelf":
					if (filter.frequency != undefined &&
					 	filter.Q != undefined && 
					 	filter.gain != undefined) {
						coeffs = beoDSP.lowShelf(Fs, filter.frequency, filter.gain, filter.Q, 0);
						getGainAtFc = filter.frequency;
					}
					break;
				case "highShelf":
					if (filter.frequency != undefined &&
					 	filter.Q != undefined && 
					 	filter.gain != undefined) {
						coeffs = beoDSP.highShelf(Fs, filter.frequency, filter.gain, filter.Q, 0);
						getGainAtFc = filter.frequency;
					}
					break;
				case "lowPass":
					if (filter.frequency != undefined) {
						if (filter.Q != undefined) {
							coeffs = beoDSP.lowPass(Fs, filter.frequency, 0, filter.Q);
						} else { // If Q is not specified, default is Butterworth.
							coeffs = beoDSP.lowPass(Fs, filter.frequency, 0);
						}
						getGainAtFc = filter.frequency;
					}
					break;
				case "highPass":
					if (filter.frequency != undefined) {
						if (filter.Q != undefined) {
							coeffs = beoDSP.highPass(Fs, filter.frequency, 0, filter.Q);
						} else { // If Q is not specified, default is Butterworth.
							coeffs = beoDSP.highPass(Fs, filter.frequency, 0);
						}
						getGainAtFc = filter.frequency;
					}
					break;
			}
		}
	}
	if (coeffs.length == 6) {
		if (store) eqGraph.store([[channelIndex, filterIndex]], {coefficients: coeffs});
	}
	if (getGainAtFc) {
		w = getGainAtFc/Fs * 2 * Math.PI;
		fi = Math.pow(Math.sin(w/2), 2);
		y = Math.log(Math.pow(b0+b1+b2, 2) - 4 * (b0*b1 + 4*b0*b2 + b1*b2) * fi + 16*b0*b2*fi*fi) - Math.log(Math.pow(1+a1+a2, 2) - 4 * (a1 + 4*a2 + a1*a2)*fi + 16*a2*fi*fi);
		y = y * 10 / Math.LN10;
		if (isNaN(y)) y = -200;
		return y;
	} else {
		return 0;
	}
}


function setCrossoverType(type) {
	index = (uiFilters[selectedChannel][selectedFilter].index);
	if (typeof index == "number") {
		index = [index];
	}
	if (!type) { // Cycle through types.
		if (index.length == 2) {
			switch (uiFilters[selectedChannel][selectedFilter].crossoverType) {
				case "custom4":
					type = "BW2";
					break;
				case "BW2":
					type = "BW4";
					break;
				case "BW4":
					type = "LR4";
					break;
				case "LR4":
					type = "custom2";
					break;
				case "custom2":
					type = "custom4";
					break;
			}
		} else {
			if (type == "custom2") {
				type = "BW2";
			} else {
				type = "custom2";
			}
		}
	}
	uiFilters[selectedChannel][selectedFilter].crossoverType = type;
	slopes = [];
	bypass = [];
	switch (type) {
		case "BW2":
		case "custom2":
			slopes[0] = 0.70710678;
			slopes[1] = 0.70710678;
			bypass[0] = false;
			bypass[1] = true;
			break;
		case "BW4":
			slopes[0] = 0.54119610;
			slopes[1] = 1.3065630;
			bypass[0] = false;
			bypass[1] = false;
			break;
		case "LR4":
		case "custom4":
			slopes[0] = 0.70710678;
			slopes[1] = 0.70710678;
			bypass[0] = false;
			bypass[1] = false;
			break;
	}
	if (index.length == 1) {
		dspFilters[selectedChannel][index].crossoverType = type;
		setFilter("Q", slopes[0], false);
		setFilter("bypass", bypass[0]);
	} else {
		dspFilters[selectedChannel][index[0]].crossoverType = type;
		dspFilters[selectedChannel][index[1]].crossoverType = type;
		setFilter("Q", slopes, false);
		setFilter("bypass", bypass);
		
	}
}

var tempCoeffs = {a0: 1, a1: 0, a2: 0, b0: 1, b1: 0, b2: 0};
var tempCoefficientsChanged = false;
function enterCoefficient(coefficient, value, eventType) {
	if (uiFilters[selectedChannel][selectedFilter].type == "coeffs") {
		if (eventType == "blur" && value == "") {
			value = (coefficient == "b0") ? "1" : "0";
			$("#coeffs-"+coefficient+" .menu-value").val(value).removeClass("invalid");
		}
		if (!isNaN(value) && value.length > 0) {
			if (tempCoeffs[coefficient] != parseFloat(value)) tempCoefficientsChanged = true;
			tempCoeffs[coefficient] = parseFloat(value);
			
			$("#coeffs-"+coefficient+" .menu-value").removeClass("invalid");
		} else {
			tempCoeffs[coefficient] = null;
			$("#coeffs-"+coefficient+" .menu-value").addClass("invalid");
		}
		invalidValues = false;
		for (coeff in tempCoeffs) {
			if (tempCoeffs[coeff] == null) invalidValues = true;
		}
		if (tempCoefficientsChanged) {
			$("#equaliser-coefficient-preview-message").removeClass("hidden");
			$("#revert-equaliser-coefficients-button").removeClass("disabled");
		}
		if (invalidValues || !tempCoefficientsChanged) {
			$("#save-equaliser-coefficients-button").addClass("disabled");
			coeffs = [1,0,0,1,0,0];
		} else {
			$("#save-equaliser-coefficients-button").removeClass("disabled");
			coeffs = [1, tempCoeffs.a1, tempCoeffs.a2, tempCoeffs.b0, tempCoeffs.b1, tempCoeffs.b2];
		}
		previewCoefficients(coeffs);
	}
}

function previewCoefficients(coeffs) {
	duplicateToChannel = null;
	if (selectedChannel == "a" && groupAB) duplicateToChannel = "b";
	if (selectedChannel == "b" && groupAB) duplicateToChannel = "a";
	if (selectedChannel == "c" && groupCD) duplicateToChannel = "d";
	if (selectedChannel == "d" && groupCD) duplicateToChannel = "c";
	if (selectedChannel == "l" && groupLR) duplicateToChannel = "r";
	if (selectedChannel == "r" && groupLR) duplicateToChannel = "l";
	channelIndex = channelsToUse.indexOf(selectedChannel);
	filterIndex = uiFilters[selectedChannel][selectedFilter].index;
	eqGraph.store([[channelIndex, filterIndex]], {coefficients: coeffs});
	eqGraph.copyData([[channelIndex, filterIndex]], [4]);
	if (duplicateToChannel) {
		duplicateIndex = channelsToUse.indexOf(duplicateToChannel);
		eqGraph.copyData([channelIndex], [duplicateIndex]);
	}
	eqGraph.draw();
}

function revertCoefficients() {
	previewCoefficients([1,0,0,1,0,0]);
	updateFilterUI();
}


function saveCoefficients() {
	tempCoeffs.samplingRate = Fs;
	setFilter("coeffs", JSON.parse(JSON.stringify(tempCoeffs)));
}


function setFilterProto(channels, index, filter) {
	beo.send({target: "equaliser", header: "setFilterProto", content: {channel: channels, index: index, filter: filter}});
}


function generateSettingsPreview(settings) {
	channelLetters = ["A", "B", "C", "D"];
	tooManyFilters = [];
	nonFlatChannels = [];
	eqNotSupported = [];
	flatChannels = [];
	unrecognisedValues = [];
	previewString = "";
	compatibilityNote = "";
	
	for (var c = 0; c < 4; c++) {
		channel = "abcd".charAt(c);
		activeFilters = 0;
		
		if (settings.validatedSettings[channel] != undefined) {
			
			for (var f = 0; f < settings.validatedSettings[channel].length; f++) {
				filter = settings.validatedSettings[channel][f];
				if (settings.compatibilityIssues[channel][f] == 4) {
					if (tooManyFilters.indexOf(channelLetters[c]) == -1) tooManyFilters.push(channelLetters[c]);
				}
				
				if (settings.compatibilityIssues[channel][f] == 4 || settings.compatibilityIssues[channel][f] == 0) {
					
					if (!filter.bypass) {
						if (filter.a1 != undefined &&
							filter.a2 != undefined &&
							filter.b0 != undefined &&
							filter.b1 != undefined &&
							filter.b2 != undefined) {
							activeFilters++;
						} else if (filter.type != undefined) {
							switch (settings.validatedSettings[channel][f].type) {
								case "highPass":
								case "lowPass":
									activeFilters++;
									break;
								default:
									if (settings.validatedSettings[channel][f].gain) {
										activeFilters++;
									}
									break;
							}
						}
					}
				}
			}
		}
		if (activeFilters == 0) {
			flatChannels.push(channelLetters[c]);
		} else {
			nonFlatChannels.push(channelLetters[c]);
		}
		
		if (settings.compatibilityIssues[channel] == 1) {
			eqNotSupported.push(channelLetters[c]);
		}
	}
	
	
	if (nonFlatChannels.length == 4) {
		previewString += beo.translatedString("Filters for all channels. ", "allActiveFilters", "equaliser");
	} else if (nonFlatChannels.length > 1) {
		previewString += beo.translatedStringWithFormat("Filters for channels %@. ", beo.commaAndList(nonFlatChannels, "and", "and", "equaliser"), "activeFiltersPlural", "equaliser");
	} else if (nonFlatChannels.length == 1) {
		previewString += beo.translatedStringWithFormat("Filters for channel %@. ", nonFlatChannels[0], "activeFiltersSingular", "equaliser");
	}
	
	if (flatChannels.length == 4) {
		previewString += beo.translatedString("All channels are flat. ", "allChannelsFlat", "equaliser");
	} else if (flatChannels.length > 1) {
		previewString += beo.translatedStringWithFormat("Channels %@ are flat. ", beo.commaAndList(flatChannels, "and", "and", "equaliser"), "noActiveFiltersPlural", "equaliser");
	} else if (flatChannels.length == 1) {
		previewString += beo.translatedStringWithFormat("Channel %@ is flat. ", flatChannels[0], "noActiveFiltersSingular", "equaliser");
	}
	
	if (eqNotSupported.length == 4) {
		compatibilityNote += beo.translatedString("Adjusting equaliser filters is not supported. ", "eqNotSupportedAll", "equaliser");
	} else if (eqNotSupported.length > 1) {
		compatibilityNote += beo.translatedStringWithFormat("Channels %@ do not support adjusting equaliser filters. ", beo.commaAndList(eqNotSupported, "and", "and", "equaliser"), "eqNotSupportedPlural", "equaliser");
	} else if (eqNotSupported.length == 1) {
		compatibilityNote += beo.translatedStringWithFormat("Channel %@ does not support adjusting equaliser filters. ", eqNotSupported[0], "eqNotSupportedSingular", "equaliser");
	}
	
	if (tooManyFilters.length > 1) {
		compatibilityNote += beo.translatedStringWithFormat("Channels %@ have too many filters. ", beo.commaAndList(tooManyFilters, "and", "and", "equaliser"), "tooManyFiltersPlural", "equaliser");
	} else if (tooManyFilters.length == 1) {
		compatibilityNote += beo.translatedStringWithFormat("Channel %@ has too many filters. ", tooManyFilters[0], "tooManyFiltersSingular", "equaliser");
	}
	
	return [beo.translatedString("Speaker Equaliser", "equaliserTitle", "equaliser"), '<p>'+previewString+'</p>', compatibilityNote];
}




function selectScale(scale, updateOnly) {
	if (!scale) { // Cycle through options.
		dBScale += 5;
		if (dBScale > 30) dBScale = 15;
	} else {
		dBScale = scale;
	}
	$("#equaliser-db-scale .menu-value").text("± "+dBScale+" dB");
	if (!updateOnly) beo.sendToProduct("equaliser", {header: "setScale", content: {dBScale: dBScale}});
	eqGraph.setOptions({scale: dBScale}, true);
	if (uiSettingsLoaded) selectFilter();
}

function selectQDisplay(unit, updateOnly) {
	if (!unit) {
		displayQ = (displayQ == "Q") ? "oct" : "Q";
	} else {
		displayQ = unit;
	}
	if (displayQ == "Q") {
		uiDisplayQ = "Q";
		$(".equaliser-unit-q").removeClass("hidden");
		$(".equaliser-unit-oct").addClass("hidden");
	} else {
		uiDisplayQ = "Octaves";
		$(".equaliser-unit-oct").removeClass("hidden");
		$(".equaliser-unit-q").addClass("hidden");
	}
	$("#equaliser-q-display .menu-value").text(uiDisplayQ);
	if (!updateOnly) beo.sendToProduct("equaliser", {header: "setQDisplay", content: {unit: displayQ}});
	if (uiSettingsLoaded) selectFilter();
}

function toggleShowAllChannels() {
	show = (showAllChannels) ? false : true;
	beo.sendToProduct("equaliser", {header: "setShowAllChannels", content: {show: show}});
}

function groupChannels(confirmed, updateOnly = false) {
	if (!updateOnly) {
		if (confirmed) beo.ask();
		if (selectedChannel == "a" || selectedChannel == "b") {
			grouped = (!groupAB) ? true : false;
			if (!grouped || confirmed) {
				beo.sendToProduct("equaliser", {header: "groupChannels", content: {channels: "AB", grouped: grouped, fromChannel: selectedChannel}});
			} else {
				beo.ask("equaliser-group-prompt", ["A & B", selectedChannel.toUpperCase(), (selectedChannel == "a") ? "B" : "A"]);
			}
		}
		if (selectedChannel == "c" || selectedChannel == "d") {
			grouped = (!groupCD) ? true : false;
			if (!grouped || confirmed) {
				beo.sendToProduct("equaliser", {header: "groupChannels", content: {channels: "CD", grouped: grouped, fromChannel: selectedChannel}});
			} else {
				beo.ask("equaliser-group-prompt", ["C & D", selectedChannel.toUpperCase(), (selectedChannel == "c") ? "D" : "C"]);
			}
		}
		if (selectedChannel == "l" || selectedChannel == "r") {
			grouped = (!groupLR) ? true : false;
			if (!grouped || confirmed) {
				beo.sendToProduct("equaliser", {header: "groupChannels", content: {channels: "LR", grouped: grouped, fromChannel: selectedChannel}});
			} else {
				beo.ask("equaliser-group-prompt", ["left & right", (selectedChannel == "l") ? "left" : "right", (selectedChannel == "l") ? "right" : "left"]);
			}
		}
	} else {
		if (groupAB) {
			if (selectedChannel == "b") {
				selectChannel("a");
				beo.showMenuTab("equaliser-ch-a", true);
			}
			$("#equaliser-tab-a, #equaliser-tab-b").addClass("hidden");
			$("#equaliser-tab-group-ab").removeClass("hidden");
		} else {
			(canControlEqualiser.a) ? $("#equaliser-tab-a").removeClass("hidden") : $("#equaliser-tab-a").addClass("hidden");
			(canControlEqualiser.b) ? $("#equaliser-tab-b").removeClass("hidden") : $("#equaliser-tab-b").addClass("hidden");
			//$("#equaliser-tab-a, #equaliser-tab-b").removeClass("hidden");
			$("#equaliser-tab-group-ab").addClass("hidden");
		}
		if (groupCD) {
			if (selectedChannel == "d") {
				selectChannel("c");
				beo.showMenuTab("equaliser-ch-c", true);
			}
			$("#equaliser-tab-c, #equaliser-tab-d").addClass("hidden");
			$("#equaliser-tab-group-cd").removeClass("hidden");
		} else {
			(canControlEqualiser.c) ? $("#equaliser-tab-c").removeClass("hidden") : $("#equaliser-tab-c").addClass("hidden");
			(canControlEqualiser.d) ? $("#equaliser-tab-d").removeClass("hidden") : $("#equaliser-tab-d").addClass("hidden");
			//$("#equaliser-tab-c, #equaliser-tab-d").removeClass("hidden");
			$("#equaliser-tab-group-cd").addClass("hidden");
		}
		if (groupLR) {
			if (selectedChannel == "r") {
				selectChannel("l");
				beo.showMenuTab("equaliser-ch-l", true);
			}
			$("#equaliser-tab-l, #equaliser-tab-r").addClass("hidden");
			$("#equaliser-tab-group-lr").removeClass("hidden");
		} else {
			$("#equaliser-tab-l, #equaliser-tab-r").removeClass("hidden");
			$("#equaliser-tab-group-lr").addClass("hidden");
		}
	}
}


function showLinked(channel = selectedChannel) {
	selectedChannelIndex = ("abcd").indexOf(selectedChannel);
	hasLinks = false;
	leftmostLink = null;
	rightmostLink = 0;
	for (var i = 0; i < links[selectedChannel].length; i++) {
		ch = ("abcd").charAt(i);
		if (links[selectedChannel][i]) {
			beo.setSymbol("#equaliser-link-"+ch+" .symbol", "common/symbols-black/link.svg");
			$("#equaliser-link-"+ch).addClass("linked");
			hasLinks = true;
			if (leftmostLink == null) leftmostLink = i;
			rightmostLink = i;
		} else {
			beo.setSymbol("#equaliser-link-"+ch+" .symbol", "common/symbols-black/link-unlinked.svg");
			$("#equaliser-link-"+ch).removeClass("linked");
		}
	}
	$("#equaliser-link > div").removeClass("selected left-one left-two left-three right-one right-two right-three");
	$("#equaliser-link-"+channel).addClass("selected");
	if (hasLinks) {
		$("#equaliser-link-"+selectedChannel).addClass("linked");
		classes = "";
		switch (selectedChannelIndex - leftmostLink) {
			case 3:
				classes += " left-three";
				break;
			case 2:
				classes += " left-two";
				break;
			case 1:
				classes += " left-one";
				break;
		}
		switch (rightmostLink - selectedChannelIndex) {
			case 3:
				classes += " right-three";
				break;
			case 2:
				classes += " right-two";
				break;
			case 1:
				classes += " right-one";
				break;
		}
		$("#equaliser-link-"+channel).addClass(classes);
	} else {
		$("#equaliser-link-"+channel).removeClass("linked");
	}
}

links = {
	a: [false, false, false, false],
	b: [false, false, false, false],
	c: [false, false, false, false],
	d: [false, false, false, false]
};

function toggleLink(channel) {
	channelIndex = ("abcd").indexOf(channel);
	selectedChannelIndex = ("abcd").indexOf(selectedChannel);
	
	if (links[selectedChannel][channelIndex]) {
		links[selectedChannel][channelIndex] = false;
		links[channel][selectedChannelIndex] = false;
	} else {
		links[selectedChannel][channelIndex] = true;
		links[channel][selectedChannelIndex] = true;
	}
	showLinked();
}

function showChannelSettings() {
	showChannels = [selectedChannel];
	if (selectedChannel == "a" && groupAB) showChannels = ["a", "b"];
	if (selectedChannel == "b" && groupAB) showChannels = ["a", "b"];
	if (selectedChannel == "c" && groupCD) showChannels = ["c", "d"];
	if (selectedChannel == "d" && groupCD) showChannels = ["c", "d"];
	
	if (extensions.channels && channels.showAdvancedSettingsPopup) {
		channels.showAdvancedSettingsPopup(showChannels);
	}
}

function getBeosonicPreview() {
	return {
		label: "Sound Design",
		description: "Room compensation and custom equalisation for left and right channels"
	};
}

function saveBeosonicPreset() {
	if (beosonic && beosonic.savePreset) beosonic.savePreset(null, null, ["equaliser"]);
}


// adapted from: https://stackoverflow.com/questions/846221/logarithmic-slider
function convertHz(value, targetFormat, maxp) {
	minp = 0;
	if (!maxp) maxp = 300;
	
	minv = Math.log(10);
	maxv = Math.log(20000);
	
	// calculate adjustment factor
	scale = (maxv-minv) / (maxp-minp);
	
	if (targetFormat == "linear") {
		return (Math.log(value)-minv) / scale + minp;
	} else {
		result = Math.exp(minv + scale*(value-minp));
		if (result > 99) result = Math.round(result/10)*10;
	  	if (result > 999) result = Math.round(result/100)*100;
	
	  	return Math.round(result);
	}
}

function getBandwidth(Q) {
	return (2 / Math.log(2)) * Math.asinh(1 / (2 * Q));
}

function getQFromBandwidth(N) {
	return Math.sqrt(Math.pow(2, N)) / (Math.pow(2, N) - 1);
}

function getQFromCutoff(Fc, F1, F2) {
	return Fc / (F2 - F1);
}

function getCutoffFrequencies(Fc, Q) {
	F1 = Fc * (Math.sqrt(1 + 1 / (4 * Math.pow(Q, 2))) - 1 / (2 * Q));
	F2 = Fc * (Math.sqrt(1 + 1 / (4 * Math.pow(Q, 2))) + 1 / (2 * Q));
	return [F1, F2];
}





return {
	generateSettingsPreview: generateSettingsPreview,
	setFilterProto: setFilterProto,
	selectScale: selectScale,
	selectQDisplay: selectQDisplay,
	selectChannel: selectChannel,
	selectFilter: selectFilter,
	setCrossoverType: setCrossoverType,
	toggleShowAllChannels: toggleShowAllChannels,
	toggleLink: toggleLink,
	groupChannels: groupChannels,
	step: step,
	toggleBypass: toggleBypass,
	deleteFilter: deleteFilter,
	deleteAllFilters: deleteAllFilters,
	compare: compare,
	addFilter: addFilter,
	enterCoefficient: enterCoefficient,
	saveCoefficients: saveCoefficients,
	revertCoefficients: revertCoefficients,
	showChannelSettings: showChannelSettings,
	showEqualiser: showEqualiser,
	getBeosonicPreview: getBeosonicPreview,
	saveBeosonicPreset: saveBeosonicPreset
};

})();