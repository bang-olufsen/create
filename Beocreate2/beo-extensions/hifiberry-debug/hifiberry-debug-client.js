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
		if (data.content && data.content.archiveURL) {
			archiveURL = data.content.archiveURL;
			
			$("#diagnostic-collect-button").removeClass("black").addClass("grey");
			$("#diagnostic-archive").removeClass("hidden");
		} else {
			$("#diagnostic-archive").addClass("hidden");
			$("#diagnostic-collect-button").removeClass("grey").addClass("black");
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