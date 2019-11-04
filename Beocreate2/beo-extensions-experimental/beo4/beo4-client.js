$(document).on("beo4", function(event, data) {
	if (data.header == "lastCommand") {
		$("#beo4-source").text(data.content.source);
		$("#beo4-command").text(data.content.command);
	}
});