var choose_country = (function() {


var currentCountryCode = null;
var currentCountryName = null;
var listHeaders = "abcdefghijklmnopqrstuvwxyz";
var countrySelectedRecently = false;

$(document).on("choose-country", function(event, data) {
	if (data.header == "showList") {
		$(".country-list").empty();
		currentHeader = "";
		
		for (property in data.content.countries) {
			firstLetter = data.content.countries[property].charAt(0);
			allowCreatingHeader = true;
			switch (firstLetter) {
				case "Å":
					allowCreatingHeader = false;
					break;
				case "E":
					if (currentHeader == "S") allowCreatingHeader = false;
					break;
			}
			if (firstLetter != currentHeader && allowCreatingHeader) {
				$(".country-list").append('<div class="sticky-group sticky-group-'+firstLetter+'"><h2 class="sticky-header">'+firstLetter.toUpperCase()+'</h2></div>');
				currentHeader = firstLetter;
			}

			$(".country-list .sticky-group-"+currentHeader).append(createMenuItem({
				label: data.content.countries[property],
				onclick: "choose_country.selectCountry('"+property+"');",
				checkmark: "left",
				classes: ["country-item-"+property]
			}));
		}
		
		updateCurrentCountry();
		
	}
	
	if (data.header == "showCurrent") {
		if (data.content.countryCode != undefined) { 
			currentCountryCode = data.content.countryCode.toLowerCase();
			currentCountryName = data.content.countryName;
		} else {
			currentCountryCode = null;
			currentCountryName = null;
		}
		updateCurrentCountry();
	}
});

function selectCountry(country) {
	countrySelectedRecently = true;
	send({target: "choose-country", header: "setCountry", content: {country: country}});
}

function updateCurrentCountry() {
	$(".country-list .menu-item.checked").removeClass("checked");
	if (currentCountryCode != null) {
		if (!countrySelectedRecently) $("#current-country-wrap").removeClass("hidden");
		$(".wifi-country-name").text(currentCountryName);
		$(".country-list .country-item-"+currentCountryCode).addClass("checked");
	} else {
		$("#current-country-wrap").addClass("hidden");
		$(".wifi-country-name").text("");
	}
	countrySelectedRecently = false;
}

return {
	selectCountry: selectCountry
}

})();