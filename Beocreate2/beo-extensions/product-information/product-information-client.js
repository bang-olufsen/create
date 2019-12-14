var product_information = (function() {


var systemName = "";
var modelName = "";
var modelID = "";
var systemID = "";
var productImage = "";
var cardType = "";
var showFullSystemID = false;
var systemVersion = 0;
var systemVersionReadable = "";
var hifiberryVersion = null;

var productIdentities = {};

$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			beo.send({target: "product-information", header: "getBasicProductInformation"});
		}
	}
	
	if (data.header == "activatedExtension") {
		if (data.content.extension == "product-information") {
			setTimeout(function() {
				$(".product-overview-image").addClass("visible");
			}, 200);
		} else {
			$(".product-overview-image").removeClass("visible");
		}
	}
	
});

$(document).on("product-information", function(event, data) {
	if (data.header == "showProductIdentity") {
		systemName = data.content.systemName;
		modelName = data.content.modelName;
		modelID = data.content.modelID;
		productImage = data.content.productImage;
		$(".product-image").attr("src", productImage);
		$(".product-image-bg").css("background-image", "url("+productImage+")");
		$(".system-name").text(systemName);
		$(".model-name").text(modelName);
	
		document.title = systemName;
		beo.sendToProductView({header: "systemName", content: {name: systemName}});
	}
	
	if (data.header == "showProductModel") {
		modelName = data.content.modelName;
		modelID = data.content.modelID;
		productImage = data.content.productImage;
		$(".model-name").text(modelName);	
		$(".product-identity-collection .collection-item").removeClass("checked");
		$('.product-identity-collection .collection-item[data-model-id="'+modelID+'"]').addClass("checked");
		$(".product-image").attr("src", productImage);
		$(".product-image-bg").css("background-image", "url("+productImage+")");
	}
	
	if (data.header == "basicProductInformation") {
		systemName = data.content.systemName;
		$(".system-name").text(systemName);
		systemVersion = data.content.systemVersion;
		systemID = data.content.systemID;
		beo.sendToProductView({header: "systemName", content: {name: systemName}});
		document.title = systemName;
		if (data.content.systemVersion) {
			systemVersion = data.content.systemVersion;
			$(".system-version").text(systemVersion);
		}
		if (data.content.systemConfiguration && data.content.systemConfiguration.cardType) {
			cardType = data.content.systemConfiguration.cardType;
			$(".card-type").text(data.content.systemConfiguration.cardType);
		}
		if (data.content.hifiberryVersion) {
			hifiberryVersion = data.content.hifiberryVersion;
			$(".hifiberry-version").text(hifiberryVersion);
		}
		cycleSystemInformation(true);
	}
	
	if (data.header == "showSystemName") {
		systemName = data.content.systemName;
		$(".system-name").text(systemName);
		beo.sendToProductView({header: "systemName", content: {name: systemName}});
		document.title = systemName;
		if (data.content.staticName) {
			if (document.domain.indexOf(".local") != -1) {
				if (document.domain != data.content.staticName.toLowerCase()+".local") {
					// If the browser is using the local hostname to connect, redirect to the new hostname. With IP address this is not necessary as that doesn't change.
					if (window.location.host.indexOf(":") != -1) {
						port = ":"+window.location.host.split(":")[1];
					} else {
						port = "";
					}
					window.location.replace("http://"+data.content.staticName.toLowerCase()+".local"+port);
				}
			}
		}
	}
	
	if (data.header == "allProductIdentities" && data.content.identities) {
		productIdentities = data.content.identities;
		$(".product-identity-collection").empty();
		
		bangOlufsenSoundPresetCount = 0;
		customSoundPresetCount = 0;
		for (identity in productIdentities) {
			identityItemOptions = {
				classes: ["product-identity-item"],
				label: productIdentities[identity].modelName,
				icon: productIdentities[identity].productImage[1],
				data: {"data-model-id": identity},
				onclick: "product_information.setProductModel('"+identity+"');",
				checkmark: true,
			};
			if (modelID == identity) identityItemOptions.checked = true;
			if (identityItemOptions.label.toLowerCase() == "beocreate 4-channel amplifier") identityItemOptions.label = "Beocreate";
			identityItem = beo.createCollectionItem(identityItemOptions);
			$(".product-identity-collection").append(identityItem);
		}
	}
	
	if (data.header == "askToRestartAfterSystemNameChange") {
		beo.ask("product-name-restart-prompt");
	}
	
});

function toggleSystemIDFormat(updateOnly) {
	if (!updateOnly) {
		showFullSystemID = (showFullSystemID == false) ? true : false;
	}
	if (showFullSystemID) {
		systemIDString = systemID;
	} else {
		systemIDString = systemID.replace(/^0+/, '');
	}
	$(".serial-number").text(systemIDString);
}

currentSystemInfo = 0;
function cycleSystemInformation(updateOnly) {
	if (!updateOnly) {
		currentSystemInfo++;
		if (currentSystemInfo > 3) currentSystemInfo = 0;
	}
	if (currentSystemInfo == 0 && !hifiberryVersion) currentSystemInfo = 1;
	
	switch (currentSystemInfo) {
		case 0: // HiFiBerryOS version ("release")
			infoText = "Software "+hifiberryVersion;
			break;
		case 1: // Beocreate version
			infoText = "Beocreate "+systemVersion;
			break;
		case 2:
			infoText = "Raspberry Pi ID "+systemID.replace(/^0+/, '');
			break;
		case 3:
			infoText = "Raspberry Pi ID "+systemID;
			break;
	}
	$(".system-info-cycle").text(infoText);
}

function changeProductName() {
	beo.startTextInput(1, "Change Name", "This name is shown on your other devices and music services.", {autocapitalise: "words", placeholders: {text: "Name"}, text: systemName, minLength: {text: 3}}, function(input) {
		if (input) {
			beo.send({target: "product-information", header: "setSystemName", content: {newSystemName: input.text}});
		}
	});
}

function setProductModel(theModelID) {
	beo.send({target: "product-information", header: "setProductModel", content: {modelID: theModelID}});
	$(".product-overview-image").removeClass("visible");
	setTimeout(function() {
		$(".product-overview-image").addClass("visible");
	}, 200);
		
}

function generateSettingsPreview(identity, presetName) {
	if (!identity) identity = {};
	infoString = "";
	if (identity.designer) {
		infoString = beo.translatedString("Designed by", "designedBy", "product-information") + " " + identity.designer;
	}
	if (identity.produced) {
		if (!Array.isArray(identity.produced)) {
			produced = identity.produced;
		} else {
			produced = identity.produced[0] + "–" + identity.produced[1];
		}
		if (infoString != "") {
			infoString += ", " + beo.translatedString("Manufactured", "manufactured", "product-information").toLowerCase() + " " + produced;
		} else {
			infoString += beo.translatedString("Manufactured", "manufactured", "product-information") + " " + produced;
		}
	}
	$(".sound-preset-information p.product").text(infoString);
	
	if (identity.manufacturer) {
		if (identity.modelName && identity.modelName != presetName) {
			$(".sound-preset-information h2").text(identity.manufacturer+" "+identity.modelName).removeClass("hidden-2");
		} else {
			$(".sound-preset-information h2").text(identity.manufacturer).removeClass("hidden-2");
		}
	} else {
		$(".sound-preset-information h2").text("").addClass("hidden-2");
	}
	previewString = "";
	if (identity.manufacturer) previewString += identity.manufacturer+" ";
	if (identity.modelName) previewString += identity.modelName;
	
	return [beo.translatedString("Icon & Model Name", "iconAndModelName", "product-information"), "<p>"+previewString+"</p>"];
}

function clearPresetPreview() {
	$(".sound-preset-information p.product").text("");
	$(".sound-preset-information h2").text("").addClass("hidden-2");
}



function startCustomisation() {
	beo.send({target: "product-information", header: "getProductIdentities"});
	beo.showPopupView("customise-product-popup", null, finishCustomisation);
}

function finishCustomisation() {
	beo.hidePopupView("customise-product-popup");
}

function restartProduct() {
	beo.ask();
	beo.send({target: "product-information", header: "restartProduct"});
}

function shutdownProduct() {
	beo.ask();
	beo.send({target: "product-information", header: "shutdownProduct"});
}

function jumpToSoundAdjustments() {
	beo.hidePopupView("customise-product-popup");
	beo.showExtension("sound");
	console.log(systemID);
}

return {
	systemID: function() {return systemID},
	systemName: function() {return systemName},
	systemVersion: function() {return systemVersion},
	modelName: function() {return modelName},
	modelID: function() {return modelID},
	productImage: function() {return productImage},
	cardType: function() {return cardType},
	hifiberryVersion: function() {return hifiberryVersion},
	generateSettingsPreview: generateSettingsPreview,
	clearPresetPreview: clearPresetPreview,
	startCustomisation: startCustomisation,
	finishCustomisation: finishCustomisation,
	changeProductName: changeProductName,
	setProductModel: setProductModel,
	restartProduct: restartProduct,
	shutdownProduct: shutdownProduct,
	jumpToSoundAdjustments: jumpToSoundAdjustments,
	cycleSystemInformation: cycleSystemInformation
};

})();