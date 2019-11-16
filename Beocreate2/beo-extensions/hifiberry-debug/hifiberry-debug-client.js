var hifiberry_debug = (function() {

var newVersion = null;
var archiveURL = null;


$(document).on("hifiberry-debug", function(event, data) {
	
	if (data.header == "collecting") {
		$("#diagnostic-collect-button").addClass("disabled");
		$("#diagnostic-collecting").removeClass("hidden");
		$("#diagnostic-archive").addClass("hidden");
	}
	
	if (data.header == "finished") {
		$("#diagnostic-collect-button").removeClass("disabled");
		$("#diagnostic-collecting").addClass("hidden");
	}
	
	if (data.header == "archive") {
		if (data.content.archiveURL) {
			archiveURL = data.content.archiveURL;
			$("#diagnostic-archive").removeClass("hidden");
			d = new Date(data.content.archiveDate);
			$("#diagnostic-archive-timestamp").text(d.toLocaleString());
			currentDate = new Date();
			if (currentDate - data.content.archiveDate > 300000) {
				// If data is older than 5 minutes, make collect button the prominent one.
				$("#diagnostic-collect-button").removeClass("grey").addClass("black");
				$("#diagnostic-download-button").removeClass("black").addClass("grey");
				$("#diagnostic-archive-old").removeClass("hidden");
			} else {
				$("#diagnostic-collect-button").removeClass("black").addClass("grey");
				$("#diagnostic-download-button").removeClass("grey").addClass("black");
				$("#diagnostic-archive-old").addClass("hidden");
			}
		} else {
			$("#diagnostic-archive").addClass("hidden");
		}
	}
});


function collect() {
	send({target: "hifiberry-debug", header: "collect"});
}

function download() {
	window.location = archiveURL;
}


return {
	collect: collect,
	download: download
};

})();