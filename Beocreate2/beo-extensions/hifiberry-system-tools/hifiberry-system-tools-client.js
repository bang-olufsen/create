var hifiberry_system_tools = (function() {

var newVersion = null;
var archiveURL = null;
var backupURL = null;


$(document).on("hifiberry-system-tools", function(event, data) {
	
	if (data.header == "collecting") {
		$("#diagnostic-collect-button").addClass("disabled");
		$("#diagnostic-collecting").removeClass("hidden");
		$("#diagnostic-archive").addClass("hidden");
	}
	
	if (data.header == "finishedCollecting") {
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
	
	if (data.header == "backingUp") {
		$("#backup-controls .button").addClass("disabled");
		$("#backup-download-button").addClass("hidden");
		$("#backup-collecting").removeClass("hidden");
	}
	
	if (data.header == "finishedBackup") {
		$("#backup-controls .button").removeClass("disabled");
		$("#backup-collecting").addClass("hidden");
	}
	
	if (data.header == "backup") {
		if (data.content && data.content.backupURL) {
			backupURL = data.content.backupURL;
			
			$("#backup-button").removeClass("black").addClass("grey");
			$("#backup-download-button").removeClass("hidden");
		} else {
			$("#backup-download-button").addClass("hidden");
			$("#backup-button").removeClass("grey").addClass("black");
		}
	}
	
	if (data.header == "restoreSettings") {
		if (!data.content) {
			restore();
		} else {
			if (data.content && data.content.stage) {
				if (data.content.stage == "restoring") {
					beo.notify({title: "Restoring settings…", message: "Please wait. The product will restart automatically.", icon: "attention", timeout: false, id: "settingsRestore"});
				}
			}
		}
	}
	
	if (data.header == "state") {
		if (data.content.exclusiveAudio) {
			$("#exclusive-audio-status").text("Yes");
			$("#exclusive-audio-on-explanation").removeClass("hidden");
			$("#exclusive-audio-off-explanation").addClass("hidden");
			$("#software-resampling-menu-item").addClass("disabled");
		} else {
			$("#exclusive-audio-status").text("No");
			$("#exclusive-audio-on-explanation").addClass("hidden");
			$("#exclusive-audio-off-explanation").removeClass("hidden");
			$("#software-resampling-menu-item").removeClass("disabled");
			
		}
		
		if (data.content.resamplingRate) {
			$("#resampling-rate").text(data.content.resamplingRate/1000+" kHz");
		} else {
			$("#resampling-rate").text("Unknown");
		}
	}
	
	if (data.header == "sysinfo") {
		updateSystemInfo(data.content)
	}
});


function collect() {
	beo.send({target: "hifiberry-system-tools", header: "collect"});
}


function updateSystemInfo(info) {
		block = document.getElementById("hifiberry-debug-sysinfo");
		block.innerHTML = "";
		for (var i = 0; i <info.length; i++) {
			block.innerHTML += beo.createMenuItem({
				label: info[i][0],
				description: info[i][1],
				static: true
			}) + "\n";
			
		}
	
}

function downloadArchive() {
	window.location = archiveURL;
}

function downloadBackup() {
	window.location = backupURL;
}

function backup() {
	beo.send({target: "hifiberry-system-tools", header: "backup"});
}

function restore(confirmed) {
	if (!confirmed) {
		beo.ask("restore-backup-prompt");
	} else {
		beo.ask();
		beo.sendToProduct("hifiberry-system-tools", "restoreSettings");
	}
}


return {
	collect: collect,
	downloadArchive: downloadArchive,
	backup: backup,
	downloadBackup: downloadBackup,
	restore: restore
};

})();