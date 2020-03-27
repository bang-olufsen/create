var multi_level = (function() {

currentLevel = 1; // This changes back and forth when the user navigates.
totalLevels = 1; // This only increments.

$(document).on("general", function(event, data) {
	if (data.header == "activatedExtension") {
		if (data.content.extension == "multi-level-test") {
			if (data.content.deepMenu != null) {
				currentLevel = parseInt(data.content.deepMenu.split("-").pop());
			} else {
				currentLevel = 1;
			}
			console.log("Now at level "+currentLevel);
		}
	}

	
});

function nextLevel() {
	if (totalLevels <= currentLevel) { // If we need more levels, add them.
		totalLevels++;
		console.log("Adding level "+totalLevels);
		protoClone = $("#multi-level-test-prototype").clone(); // Clone the prototype.
		$(protoClone).attr("id", "multi-level-test-"+totalLevels); // Change the ID to be unique.
		if (currentLevel == 1) { // Place the clone after the current level (so that it slides on top of the current level instead of under).
			$("#multi-level-test").after(protoClone); // If on first level, it goes after the main menu screen.
		} else {
			$("#multi-level-test-"+currentLevel).after(protoClone); 
		}
	}
	currentLevel++;
	// Fill in content as usual:
	$("#multi-level-test-"+currentLevel).attr("data-menu-title", "Multi-Level L"+currentLevel);
	$("#multi-level-test-"+currentLevel+" header h1").text("Multi-Level L"+currentLevel);
	$("#multi-level-test-"+currentLevel+" .next-level-menu-item .menu-label").text("Go to Level "+(currentLevel+1));
	console.log("Going to level "+currentLevel);
	beo.showDeepMenu("multi-level-test-"+currentLevel); // Show the menu.
}


return {
	nextLevel: nextLevel
};

})();