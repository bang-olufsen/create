var choose_country = (function() {


var currentCountryCode = null;
var currentCountryName = null;
var listHeaders = "abcdefghijklmnopqrstuvwxyz";
var countrySelectedRecently = false;

var allCountries = {};

$(document).on("choose-country", function(event, data) {
	if (data.header == "showList") {
		allCountries = data.content.countries;
		$("#country-search-field").val("");
		showCountries();
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


function showCountries(filter) {
	$(".country-list").empty();
	currentHeader = "";
	
	for (country in allCountries) {
		if (!filter ||
		 	allCountries[country].toLowerCase().indexOf(filter.toLowerCase()) != -1 ||
		 	country.toLowerCase().indexOf(filter.toLowerCase()) != -1) {
			firstLetter = allCountries[country].charAt(0);
			allowCreatingHeader = true;
			switch (firstLetter) {
				/*case "Å":
					allowCreatingHeader = false;
					break;*/
				case "E":
					if (currentHeader == "S") allowCreatingHeader = false;
					break;
			}
			if (firstLetter != currentHeader && allowCreatingHeader) {
				$(".country-list").append('<div class="sticky-group sticky-group-'+firstLetter+'"><h2 class="sticky-header">'+firstLetter.toUpperCase()+'</h2></div>');
				currentHeader = firstLetter;
			}
	
			$(".country-list .sticky-group-"+currentHeader).append(beo.createMenuItem({
				label: allCountries[country],
				onclick: "choose_country.selectCountry('"+country+"');",
				checkmark: "left",
				classes: ["country-item-"+country]
			}));
		}
	}
	if (currentCountryCode) $(".country-list .country-item-"+currentCountryCode).addClass("checked");
}

function selectCountry(country) {
	countrySelectedRecently = true;
	beo.send({target: "choose-country", header: "setCountry", content: {country: country}});
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
	selectCountry: selectCountry,
	search: showCountries
}

})();