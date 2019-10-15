var product_information = (function() {


var systemName = "";
var modelName = "";
var modelID = "";
var systemID = "";
var productImage = ""
var showFullSystemID = false;
var systemVersion = 0;
var systemVersionReadable = "";

var productIdentities = {};

$(document).on("general", function(event, data) {
	if (data.header == "connection") {
		if (data.content.status == "connected") {
			send({target: "product-information", header: "getSystemName"});
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
		systemVersion = data.content.systemVersion;
		systemID = data.content.systemID;
		productImage = data.content.productImage;
		$(".product-image").attr("src", productImage);
		$(".product-image-bg").css("background-image", "url("+productImage+")");
		$(".system-name").text(systemName);
		//extensions["product-information"].title = systemName;
		$(".model-name").text(modelName);
		$(".system-version").text(systemVersion);
		/*if (data.content.hifiberryOS != undefined) {
			setAsHifiberryOS(data.content.hifiberryOS == true);
		}*/
		if (data.content.systemConfiguration && data.content.systemConfiguration.cardType) {
			$(".card-type").text(data.content.systemConfiguration.cardType);
			//console.log(data.content.systemConfiguration.cardType);
		}
		toggleSystemIDFormat(true);
		document.title = systemName;
		sendToProductView({header: "systemName", content: {name: systemName}});
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
	
	if (data.header == "showSystemName") {
		systemName = data.content.systemName;
		$(".system-name").text(systemName);
		sendToProductView({header: "systemName", content: {name: systemName}});
		document.title = systemName;
		if (data.content.systemVersion) {
			systemVersion = data.content.systemVersion;
			$(".system-version").text(systemVersion);
		}
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
				icon: productIdentities[identity].productImage,
				data: {"data-model-id": identity},
				onclick: "product_information.setProductModel('"+identity+"');",
				checkmark: true,
			};
			if (modelID == identity) identityItemOptions.checked = true;
			if (identityItemOptions.label.toLowerCase() == "beocreate 4-channel amplifier") identityItemOptions.label = "Beocreate";
			identityItem = createCollectionItem(identityItemOptions);
			$(".product-identity-collection").append(identityItem);
		}
	}
	
	if (data.header == "askToRestartAfterSystemNameChange") {
		ask("product-name-restart-prompt");
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

function changeProductName(name) {
	if (!name) { // Show text input
		startTextInput(1, "Change Name", "This name is shown to your other devices and music services.", {autocapitalise: "words", placeholders: {text: "Name"}, minLength: {text: 3}}, function(text) {
			changeProductName(text);
		});
	} else {
		//ask("product-name-restart-prompt");
		send({target: "product-information", header: "setSystemName", content: {newSystemName: name.text}});
	}
}

function setProductModel(theModelID) {
	send({target: "product-information", header: "setProductModel", content: {modelID: theModelID}});
}

function generateSettingsPreview(settings, presetName) {
	infoString = "";
	if (settings.validatedSettings.designer) {
		infoString = translatedString("Designed by", "designedBy", "product-information") + " " + settings.validatedSettings.designer;
	}
	if (settings.validatedSettings.produced) {
		if (!Array.isArray(settings.validatedSettings.produced)) {
			produced = settings.validatedSettings.produced;
		} else {
			produced = settings.validatedSettings.produced[0] + "–" + settings.validatedSettings.produced[1];
		}
		if (infoString != "") {
			infoString += ", " + translatedString("Manufactured", "manufactured", "product-information").toLowerCase() + " " + produced;
		} else {
			infoString += translatedString("Manufactured", "manufactured", "product-information") + " " + produced;
		}
	}
	$(".sound-preset-information p.product").text(infoString);
	
	if (settings.validatedSettings.manufacturer) {
		if (settings.validatedSettings.modelName && settings.validatedSettings.modelName != presetName) {
			$(".sound-preset-information h2").text(settings.validatedSettings.manufacturer+" "+settings.validatedSettings.modelName).removeClass("hidden-2");
		} else {
			$(".sound-preset-information h2").text(settings.validatedSettings.manufacturer).removeClass("hidden-2");
		}
	} else {
		$(".sound-preset-information h2").text("").addClass("hidden-2");
	}
	previewString = "";
	if (settings.validatedSettings.manufacturer) previewString += settings.validatedSettings.manufacturer+" ";
	if (settings.validatedSettings.modelName) previewString += settings.validatedSettings.modelName;
	
	return [translatedString("Icon & Model Name", "iconAndModelName", "product-information"), "<p>"+previewString+"</p>"];
}



function startCustomisation() {
	send({target: "product-information", header: "getProductIdentities"});
	showPopupView("customise-product-popup", null, finishCustomisation);
}

function finishCustomisation() {
	hidePopupView("customise-product-popup");
}

function restartProduct() {
	ask();
	send({target: "product-information", header: "restartProduct"});
}

function shutdownProduct() {
	ask();
	send({target: "product-information", header: "shutdownProduct"});
}

function jumpToSoundAdjustments() {
	hidePopupView("customise-product-popup");
	showExtension("sound");
	console.log(systemID);
}

return {
	systemID: function() {return systemID},
	systemName: function() {return systemName},
	systemVersion: function() {return systemVersion},
	modelName: function() {return modelName},
	modelID: function() {return modelID},
	productImage: function() {return productImage},
	generateSettingsPreview: generateSettingsPreview,
	startCustomisation: startCustomisation,
	finishCustomisation: finishCustomisation,
	changeProductName: changeProductName,
	setProductModel: setProductModel,
	restartProduct: restartProduct,
	shutdownProduct: shutdownProduct,
	jumpToSoundAdjustments: jumpToSoundAdjustments,
	toggleSystemIDFormat: toggleSystemIDFormat
};

})();