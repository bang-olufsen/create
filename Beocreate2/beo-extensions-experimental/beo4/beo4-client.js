beo4 = (function() {


$(document).on("beo4", function(event, data) {
	if (data.header == "lastCommand") {
		$("#beo4-source").text(data.content.source);
		$("#beo4-command").text(data.content.command);
	}
});

interactDictionary = {
	actions: {
		beo4: {
			name: "Beo4",
			icon: "extensions/beo4/symbols-black/beo4.svg"
		}
	}
}

return {
	interactDictionary: interactDictionary
}
	
})();


