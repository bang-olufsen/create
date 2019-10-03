var equaliser = (function() {

$(document).on("equaliser", function(event, data) {
	if (data.header == "channelSettings") {
		
		if (data.content.settings != undefined) {
			showChannelSettings(data.content.settings);
		}
		
		if (data.content.canControlChannels != undefined) {
			showCanControlChannels(data.content.canControlChannels);
		}
		
		if (data.content.canDoSimpleStereoSetup != undefined) {
			showCanDoSimpleStereoSetup(data.content.canDoSimpleStereoSetup);
		} else {
			showCanDoSimpleStereoSetup(false);
		}
		
		if (data.content.simpleChannelSelection != undefined) {
			showSimpleChannelSelection(data.content.simpleChannelSelection);
		} else {
			showSimpleChannelSelection(null);
		}
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


function setFilterProto(channels, index, filter) {
	send({target: "equaliser", header: "setFilterProto", content: {channel: channels, index: index, filter: filter}});
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
		previewString += translatedString("Filters for all channels. ", "allActiveFilters", "equaliser");
	} else if (nonFlatChannels.length > 1) {
		previewString += translatedStringWithFormat("Filters for channels %@. ", commaAndList(nonFlatChannels, "and", "and", "equaliser"), "activeFiltersPlural", "equaliser");
	} else if (nonFlatChannels.length == 1) {
		previewString += translatedStringWithFormat("Filters for channel %@. ", nonFlatChannels[0], "activeFiltersSingular", "equaliser");
	}
	
	if (flatChannels.length == 4) {
		previewString += translatedString("All channels are flat. ", "allChannelsFlat", "equaliser");
	} else if (flatChannels.length > 1) {
		previewString += translatedStringWithFormat("Channels %@ are flat. ", commaAndList(flatChannels, "and", "and", "equaliser"), "noActiveFiltersPlural", "equaliser");
	} else if (flatChannels.length == 1) {
		previewString += translatedStringWithFormat("Channel %@ is flat. ", flatChannels[0], "noActiveFiltersSingular", "equaliser");
	}
	
	if (eqNotSupported.length == 4) {
		compatibilityNote += translatedString("Adjusting equaliser filters is not supported. ", "eqNotSupportedAll", "equaliser");
	} else if (eqNotSupported.length > 1) {
		compatibilityNote += translatedStringWithFormat("Channels %@ do not support adjusting equaliser filters. ", commaAndList(eqNotSupported, "and", "and", "equaliser"), "eqNotSupportedPlural", "equaliser");
	} else if (eqNotSupported.length == 1) {
		compatibilityNote += translatedStringWithFormat("Channel %@ does not support adjusting equaliser filters. ", eqNotSupported[0], "eqNotSupportedSingular", "equaliser");
	}
	
	if (tooManyFilters.length > 1) {
		compatibilityNote += translatedStringWithFormat("Channels %@ have too many filters. ", commaAndList(tooManyFilters, "and", "and", "equaliser"), "tooManyFiltersPlural", "equaliser");
	} else if (tooManyFilters.length == 1) {
		compatibilityNote += translatedStringWithFormat("Channel %@ has too many filters. ", tooManyFilters[0], "tooManyFiltersSingular", "equaliser");
	}
	
	return [translatedString("Crossover & Equaliser", "equaliserTitle", "equaliser"), '<p>'+previewString+'</p>', compatibilityNote];
}

return {
	generateSettingsPreview: generateSettingsPreview
};

})();