function openExtensionsManager(destination) {
	
	/*$("#extensions-manager, #extensions-manager-back-plate").addClass("block");
	setTimeout(function() {
		$("#extensions-manager, #extensions-manager-back-plate").addClass("visible");
	}, 50);*/
	showPopupViewInternal("#extensions-manager", "#extensions-manager-back-plate");
	
}

function closeExtensionsManager() {
	
	/*$("#extensions-manager, #extensions-manager-back-plate").removeClass("visible");
	setTimeout(function() {
		$("#extensions-manager, #extensions-manager-back-plate").removeClass("block");
	}, 500);*/
	hidePopupViewInternal("#extensions-manager", "#extensions-manager-back-plate");
	
}