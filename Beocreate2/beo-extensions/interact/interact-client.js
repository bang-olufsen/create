interact = (function() {
	
var interactions = [];
var interactionNames = [];
var interactionsEnabled = true;

var triggersListed = false;
var allTriggers = {};

var actionsListed = false;
var allActions = {};



$(document).on("interact", function(event, data) {
	if (data.header == "interactions") {
		listTriggersAndActions();
		interactions = data.content.interactions;
		
		if (data.content.special) {
			if (data.content.special == "new" && interactionNames.indexOf(data.content.name) == -1) {
				beo.notify({title: data.content.name, message: "Interaction saved", icon: "common/symbols-black/checkmark-round.svg"});
			}
		}
		interactionNames = [];
		for (i in interactions) {
			interactionNames.push(interactions[i].name);
		}
		$("#all-interactions").empty();
		if (interactions.length > 0) {
			$("#interactions-header").removeClass("hidden");
		} else {
			$("#interactions-header").addClass("hidden");
		}
		for (i in interactions) {
			$("#all-interactions").append(beo.createMenuItem({
				label: interactions[i].name,
				data: {"data-interaction-item": i},
				icon: ((allTriggers[interactions[i].triggerExtension][interactions[i].triggerType].icon) ? allTriggers[interactions[i].triggerExtension][interactions[i].triggerType].icon : extensions.interact.assetPath+"/symbols-black/interact.svg"),
				iconRight: "common/symbols-black/more.svg",
				onclick: "interact.editInteraction('"+interactions[i].name+"');"
			}));
		}
		interactionsEnabled = (data.content.interactionsEnabled) ? true : false;
		(interactionsEnabled) ? $("#enable-interactions").addClass("on") : $("#enable-interactions").removeClass("on");
	}
	
	if (data.header == "showInteraction") {
		selectedInteraction = data.content.interaction;
		$("#interact-options-button").removeClass("hidden");
		showInteraction();
	}
	
	var interactRunTimeout;
	if (data.header == "runInteraction" && selectedExtension == "interact") {
		index = interactionNames.indexOf(data.content.name);
		$('#all-interactions .menu-item').removeClass("run-interaction");
		if (index != -1) {
			$('#all-interactions [data-interaction-item="'+index+'"]').addClass("run-interaction");
			clearTimeout(interactRunTimeout);
			interactRunTimeout = setTimeout(function() {
				$('#all-interactions .menu-item').removeClass("run-interaction");
			}, 500);
		}
	}
	
	if (data.header == "serialMessage") {
		serialReceive("showCapture", data.content.message);
	}
	
	if (data.header == "serialPorts") {
		$("#available-serial-ports").empty();
		selectedPortAvailable = false;
		portCount = data.content.ports.length;
		for (p in data.content.ports) {
			port = data.content.ports[p];
			if (!port.path && port.comName) port.path = port.comName;
			if (port.path != "/dev/ttyAMA0") {
				description = "Unknown";
				if (port.manufacturer) {
					description = port.manufacturer;
				}
				if (data.content.selectedPort && data.content.selectedPort == port.path) selectedPortAvailable = true;
				$("#available-serial-ports").append(beo.createMenuItem({
					label: port.path,
					classes: ["serial-port-item"],
					data: {"data-path": port.path},
					description: description,
					onclick: "interact.selectSerialPort('"+port.path+"');",
					checkmark: "left",
					checked: (data.content.selectedPort && data.content.selectedPort == port.path)
				}));
			} else {
				portCount--;
			}
		}
		if (portCount > 0) {
			$("#available-serial-ports-title").removeClass("hidden");
		} else {
			$("#available-serial-ports-title").addClass("hidden");
		}
		$("#ghost-serial-port").empty();
		if (!selectedPortAvailable && data.content.selectedPort) {
			$("#ghost-serial-port").html(beo.createMenuItem({
				label: data.content.selectedPort,
				checkmark: "left",
				value: "Reconnect",
				valueAsButton: true,
				onclick: "interact.selectSerialPort(true);",
				checked: true
			}));
		}
		if (!data.content.selectedPort) {
			$("#serial-port-off").addClass("checked");
		} else {
			$("#serial-port-off").removeClass("checked");
		}
	}
	
	if (data.header == "serialPortSelected") {
		$("#available-serial-ports .menu-item").removeClass("checked");
		if (data.content.selectedPort) {
			$('#available-serial-ports .menu-item[data-path="'+data.content.selectedPort+'"]').addClass("checked");
			$("#serial-port-off").removeClass("checked");
		} else {
			$("#serial-port-off").addClass("checked");
		}
		$("#ghost-serial-port").empty();
	}
	
	if (data.header == "serialPortOpened") {
		$("#available-serial-ports .menu-item").removeClass("checked");
		$('#available-serial-ports .menu-item[data-path="'+data.content.selectedPort+'"]').addClass("checked");
		$("#ghost-serial-port").empty();
	}
});

function selectSerialPort(path = null) {
	if (!path) {
		beo.sendToProduct("interact", {header: "selectSerialPort"});
	} else if (path == true) {
		beo.sendToProduct("interact", {header: "reconnectSerialPort"});
	} else {
		beo.sendToProduct("interact", {header: "selectSerialPort", content: {path: path}});
	}
}


function enableInteractions() {
	enable = (!interactionsEnabled) ? true : false;
	beo.sendToProduct("interact", {header: "enableInteractions", content: {enabled: enable}});
}

selectedInteraction = null;
selectedAction = null;
unsavedChanges = false;
function createInteraction() {
	selectedInteraction = {
		name: null,
		triggerExtension: null,
		triggerType: null,
		triggerData: null,
		actions: []
	};
	$("#interact-trigger").empty();
	$("#interact-options-button").addClass("hidden");
	showInteraction();
}

function showInteraction() {
	if (selectedInteraction.name == null) {
		// New interaction.
		$("#interaction-name").text("New interaction");
		$("#interact-trigger, #interact-actions").empty();
		$("#choose-trigger-button").removeClass("hidden");
	} else {
		// Existing interaction.
		$("#choose-trigger-button").addClass("hidden");
		$("#interaction-name").text(selectedInteraction.name);
		if (allTriggers[selectedInteraction.triggerExtension][selectedInteraction.triggerType].preview) {
			preview = allTriggers[selectedInteraction.triggerExtension][selectedInteraction.triggerType].preview(selectedInteraction.triggerData);
		}
		$("#interact-trigger").html(beo.createMenuItem({
			label: allTriggers[selectedInteraction.triggerExtension][selectedInteraction.triggerType].name,
			icon: allTriggers[selectedInteraction.triggerExtension][selectedInteraction.triggerType].icon,
			description: preview,
			onclick: "beo.ask('interact-trigger-menu');",
			iconRight: "common/symbols-black/more.svg"
		}));
		listAddedActions();
	}
	unsavedChanges = false;
	shouldEnableSaveButton();
	beo.showPopupView("interaction-editor", null, function() {
		cancelEditing();
	});
}

function editInteraction(withName) {
	beo.sendToProduct("interact", {header: "getInteraction", content: {withName: withName}});
}

function saveInteraction() {
	beo.ask();
	if (selectedInteraction.name) {
		beo.hidePopupView("interaction-editor");
		beo.sendToProduct("interact", {header: "saveInteraction", content: selectedInteraction});
		selectedInteraction = null;
	} else {
		nameInteraction(true);
	}
}

function deleteInteraction(confirmed) {
	if (!confirmed) {
		beo.ask("delete-interaction-prompt", [selectedInteraction.name]);
	} else {
		beo.ask();
		beo.sendToProduct("interact", {header: "deleteInteraction", content: {withName: selectedInteraction.name}});
		cancelEditing(true);
	}
}

function nameInteraction(save = false, exists = false) {
	if (selectedInteraction) {
		beo.ask();
		beo.startTextInput(1, (save) ? "Save Interaction" : "Rename Interaction", 
			(!exists) ? "Enter a name for this interaction." : "Another interaction with this name already exists. Please choose another name.", 
			{text: selectedInteraction.name, placeholders: {text: "Interaction"}, minLength: {text: 2}, autocorrect: true}, function(input) {
			// Validate and store input.
			if (input && input.text) {
				if (interactionNames.indexOf(input.text) != -1 && input.text != selectedInteraction.name) {
					nameInteraction(save, true);
				} else {
					oldName = selectedInteraction.name;
					selectedInteraction.name = input.text;
					$("#interaction-name").text(selectedInteraction.name);
					if (save) {
						saveInteraction();
					} else {
						beo.sendToProduct("interact", {header: "renameInteraction", content: {oldName: oldName, newName: input.text}});
					}
				}
			}
		});
	}
}

function cancelEditing(override) {
	if (unsavedChanges && !override) {
		if (!selectedInteraction.triggerExtension || selectedInteraction.actions.length == 0) {
			beo.ask("interact-cannot-save-yet");
		} else {
			beo.ask("interact-unsaved-changes");
		}
	} else {
		beo.hidePopupView("interaction-editor");
		selectedInteraction = null;
		beo.ask();
	}
}

function listTriggersAndActions() {
	if (!triggersListed) {
		allTriggers.interact = {
			serialReceive: {
				name: "Serial Message Received", 
				icon: extensions.interact.assetPath+"/symbols-black/serial-port.svg", 
				setup: function(data) { serialReceive("setup", data) }, 
				preview: function(data) { return serialReceive("preview", data) }
			},
			httpAPI: {
				name: "Web Request Received",
				icon: extensions.interact.assetPath+"/symbols-black/http-api.svg", 
				setup: function(data) { httpAPISetup("received", "setup", data) }, 
				preview: function(data) { return httpAPISetup("received", "preview", data) }
			}
		}
		
		for (extension in extensions) {
			if (extensions[extension].namespace && 
				window[extensions[extension].namespace] &&
				window[extensions[extension].namespace].interactDictionary &&
				window[extensions[extension].namespace].interactDictionary.triggers) {
				allTriggers[extension] = window[extensions[extension].namespace].interactDictionary.triggers;
			}
		}
		triggersListed = true;
	}
	if (!actionsListed) {
		allActions.interact = {
			serialSend: {
				name: "Send Serial Message", 
				icon: extensions.interact.assetPath+"/symbols-black/serial-port.svg", 
				setup: function(data) { serialSend("setup", data) }, 
				preview: function(data) { return serialSend("preview", data) }
			},
//			httpAPI: {
//				name: "Send HTTP Request",
//				icon: extensions.interact.assetPath+"/symbols-black/http-api.svg"
//			}
		}
		
		for (extension in extensions) {
			if (extensions[extension].namespace && 
				window[extensions[extension].namespace] &&
				window[extensions[extension].namespace].interactDictionary &&
				window[extensions[extension].namespace].interactDictionary.actions) {
				allActions[extension] = window[extensions[extension].namespace].interactDictionary.actions;
			}
		}
		actionsListed = true;
	}
}

function chooseTrigger(triggerExtension = null, theTrigger) {
	if (!triggerExtension) {
		
		$("#interact-trigger-list").empty();
		firstRow = true;
		for (extension in allTriggers) {
			(!firstRow) ? $("#interact-trigger-list").append("<hr>") : firstRow = false;
			for (trig in allTriggers[extension]) {
				disabled = false;
				for (a in selectedInteraction.actions) {
					if (!isLegalTriggerOrAction("actions", selectedInteraction.actions[a].extension, selectedInteraction.actions[a].type, allTriggers[extension][trig])) {
						disabled = true;
						disabledReason = "Not allowed";
					}
				}
				$("#interact-trigger-list").append(beo.createMenuItem({
					label: allTriggers[extension][trig].name,
					icon: ((allTriggers[extension][trig].icon) ? allTriggers[extension][trig].icon : extensions.interact.assetPath+"/symbols-black/interact.svg"),
					onclick: "interact.chooseTrigger('"+extension+"', '"+trig+"');",
					disabled: disabled,
					value: (disabled) ? disabledReason : null
				}));
			}
		}
		beo.ask("interact-trigger-chooser");
	} else {
		beo.ask();
		if (allTriggers[triggerExtension] &&
			allTriggers[triggerExtension][theTrigger]) {
			if (allTriggers[triggerExtension][theTrigger].setupDialogue) {
				beo.ask(allTriggers[triggerExtension][theTrigger].setupDialogue);
			} else if (allTriggers[triggerExtension][theTrigger].setup) {
				allTriggers[triggerExtension][theTrigger].setup(null);
			} else {
				saveTrigger(triggerExtension, theTrigger);
			}
		}
	}
}

function editTrigger() {
	if (selectedInteraction) {
		if (allTriggers[selectedInteraction.triggerExtension][selectedInteraction.triggerType].setup) {
			preview = allTriggers[selectedInteraction.triggerExtension][selectedInteraction.triggerType].setup(selectedInteraction.triggerData);
		}
	}
}

function saveTrigger(extension, type, data = null) {
	if (allTriggers[extension] &&
		allTriggers[extension][type]) {
		selectedInteraction.triggerExtension = extension;
		selectedInteraction.triggerType = type;
		selectedInteraction.triggerData = data;
		preview = null;
		if (allTriggers[extension][type].preview) {
			preview = allTriggers[extension][type].preview(data);
		}
		$("#interact-trigger").html(beo.createMenuItem({
			label: allTriggers[extension][type].name,
			icon: allTriggers[extension][type].icon,
			description: (preview) ? preview : null,
			onclick: "interact.triggerMenu();",
			iconRight: "common/symbols-black/more.svg"
		}));
		$("#choose-trigger-button").addClass("hidden");
		unsavedChanges = true;
		shouldEnableSaveButton();
	} else {
		console.error("This trigger doesn't exist in the published triggers.");
	}
}

function triggerMenu() {
	if (allTriggers[selectedInteraction.triggerExtension][selectedInteraction.triggerType].setup) {
		$("#interact-edit-trigger-button").removeClass("disabled");
	} else {
		$("#interact-edit-trigger-button").addClass("disabled");
	}
	beo.ask("interact-trigger-menu");
}

function addAction(actionExtension = null, theAction) {
	if (!actionExtension) {

		$("#interact-action-list").empty();
		firstRow = true;
		for (extension in allActions) {
			(!firstRow) ? $("#interact-action-list").append("<hr>") : firstRow = false;
			for (action in allActions[extension]) {
				disabled = false;
				disabledReason = null;
				for (a in selectedInteraction.actions) {
					if (selectedInteraction.actions[a].extension == extension &&
						selectedInteraction.actions[a].type == action) {
						if (allActions[selectedInteraction.actions[a].extension][selectedInteraction.actions[a].type].once) {
							disabled = true;
							if (!disabledReason) disabledReason = "Once";
						}
					}
					if (!isLegalTriggerOrAction("actions", extension, action, allActions[selectedInteraction.actions[a].extension][selectedInteraction.actions[a].type])) {
						disabled = true;
						disabledReason = "Not allowed";
					}
					if (!isLegalTriggerOrAction("actions", selectedInteraction.actions[a].extension, selectedInteraction.actions[a].type, allActions[extension][action])) {
						disabled = true;
						disabledReason = "Not allowed";
					}
				}
				if (selectedInteraction.triggerExtension) {
					if (!isLegalTriggerOrAction("actions", extension, action, allTriggers[selectedInteraction.triggerExtension][selectedInteraction.triggerType])) {
						disabled = true;
						disabledReason = "Not allowed";
					}
				}
				$("#interact-action-list").append(beo.createMenuItem({
					label: allActions[extension][action].name,
					icon: ((allActions[extension][action].icon) ? allActions[extension][action].icon : extensions.interact.assetPath+"/symbols-black/interact.svg"),
					onclick: "interact.addAction('"+extension+"', '"+action+"');",
					disabled: disabled,
					value: (disabled) ? disabledReason : null
				}));
			}
		}
		beo.ask("interact-action-chooser");
	} else {
		beo.ask();
		selectedAction = null;
		if (allActions[actionExtension] &&
			allActions[actionExtension][theAction]) {
			if (allActions[actionExtension][theAction].setupDialogue) {
				beo.ask(allActions[actionExtension][theAction].setupDialogue);
			} else if (allActions[actionExtension][theAction].setup) {
				allActions[actionExtension][theAction].setup(null);
			} else {
				saveAction(actionExtension, theAction);
			}
		}
	}
}

function isLegalTriggerOrAction(triggerOrAction, theExtension, theType, comparison) {
	legal = true;
	if (comparison.illegalWith &&
		comparison.illegalWith.indexOf(triggerOrAction+"/"+theExtension+"/"+theType) != -1) {
		legal = false;
	}
	return legal;
}


function saveAction(extension, type, data = null) {
	if (allActions[extension] &&
		allActions[extension][type]) {
		if (selectedAction == null) {
			selectedAction = selectedInteraction.actions.push({}) - 1;
		}
		selectedInteraction.actions[selectedAction] = {
			extension: extension,
			type: type,
			data: data
		}
		selectedAction = null;
		unsavedChanges = true;
		listAddedActions();
	} else {
		console.error("This action doesn't exist in the published actions.");
	}
}

function listAddedActions(moveFrom, moveTo) {
	if (moveFrom != undefined && moveTo != undefined) { // Move presets around.
		actionToMove = selectedInteraction.actions[moveFrom];
		selectedInteraction.actions.splice(moveFrom, 1);
		selectedInteraction.actions.splice(moveTo, 0, actionToMove);
		unsavedChanges = true;
	}
	$("#interact-actions").empty();
	for (a in selectedInteraction.actions) {
		preview = null;
		if (allActions[selectedInteraction.actions[a].extension][selectedInteraction.actions[a].type].preview) {
			preview = allActions[selectedInteraction.actions[a].extension][selectedInteraction.actions[a].type].preview(selectedInteraction.actions[a].data);
		}
		$("#interact-actions").append(beo.createMenuItem({
			label: allActions[selectedInteraction.actions[a].extension][selectedInteraction.actions[a].type].name,
			icon: allActions[selectedInteraction.actions[a].extension][selectedInteraction.actions[a].type].icon,
			description: (preview) ? preview : null,
			onclick: "interact.actionMenu("+a+");",
			iconRight: "common/symbols-black/more.svg"
		}));
	}
	shouldEnableSaveButton();
}

function shouldEnableSaveButton() {
	if (selectedInteraction.actions.length > 0 && 
		unsavedChanges && 
		selectedInteraction.triggerExtension) {
		$("#save-interaction-button").removeClass("disabled");
	} else {
		$("#save-interaction-button").addClass("disabled");
	}
}


function actionMenu(index) {
	selectedAction = index;
	if (selectedInteraction.actions[selectedAction]) {
			if (allActions[selectedInteraction.actions[selectedAction].extension][selectedInteraction.actions[selectedAction].type].setup) {
				$("#interact-edit-action-button").removeClass("disabled");
			} else {
				$("#interact-edit-action-button").addClass("disabled");
			}
		}
	beo.ask("interact-action-menu");
}

function editAction() {
	if (selectedInteraction && selectedAction != null) {
		if (selectedInteraction.actions[selectedAction]) {
			if (allActions[selectedInteraction.actions[selectedAction].extension][selectedInteraction.actions[selectedAction].type].setup) {
				allActions[selectedInteraction.actions[selectedAction].extension][selectedInteraction.actions[selectedAction].type].setup(selectedInteraction.actions[selectedAction].data);
			}
		}
	}
}

function deleteAction() {
	beo.ask();
	if (selectedInteraction && selectedAction != null) {
		if (selectedInteraction.actions[selectedAction]) {
			selectedInteraction.actions.splice(selectedAction, 1);
			unsavedChanges = true;
			listAddedActions();
		}
	}
}

var interactActionSort = new Beodrag("#interact-actions .menu-item", {
	arrange: true,
	pre: function(event, position, target) {
		target.classList.add("drag"); // When item is held down long enough.
	},
	start: function(event, position, target) {
		target.classList.add("drag");
	},
	move: function(event, position, target) {
		// Move is handled by the internal "arranger" feature in Beodrag.
	},
	end: function(event, position, target, curPos = null, newPos = null) {
		if (newPos != null) {
			setTimeout(function() {
				listAddedActions(curPos, newPos);
			}, 300);
		}
		target.classList.remove("drag");
	},
	cancel: function(event, position, target) {
		target.classList.remove("drag");
	}
}, document.querySelector("#interaction-editor"));




// SERIAL MESSAGE TRIGGER & ACTION

capturingSerial = false;
messageToMatch = null;
matchMode = "matchAll";
removeBeginning = false;

function serialReceive(stage, data = null) {
	switch (stage) {
		case "setup":
			$("#interact-serial-capture-save").addClass("disabled");
			serialReceive("capture", false);
			if (data) {
				if (data.matchAll) {
					matchMode = "matchAll";
					messageToMatch = data.matchAll;
					removeBeginning = false;
				} else {
					matchMode = "matchBeginning";
					messageToMatch = data.matchBeginning;
					removeBeginning = data.removeBeginning;
				}
				$("#interact-serial-receive-value").text(messageToMatch).removeClass("button");
				serialReceive("setRemoveBeginning", removeBeginning);
				serialReceive(matchMode, false);
			} else {
				messageToMatch = null;
				$("#interact-serial-receive-value").text("Set...").addClass("button");
				serialReceive("matchAll", false);
			}
			beo.ask("serial-receive-setup", null, null, function() {
				serialReceive("capture", false);
			});
			break;
		case "save":
			beo.ask();
			saveTrigger("interact", "serialReceive", (matchMode == "matchAll") ? {matchAll: messageToMatch} : {matchBeginning: messageToMatch, removeBeginning: removeBeginning});
			break;
		case "set":
			serialReceive("capture", false);
			beo.startTextInput(1, "Set Text", 
				"Enter the message to match.", 
				{text: messageToMatch, placeholders: {text: "Message"}}, function(input) {
				// Validate and store input.
				if (input && input.text) {
					messageToMatch = input.text;
					$("#interact-serial-receive-value").text(input.text).removeClass("button");
					if (messageToMatch) $("#interact-serial-receive-save").removeClass("disabled");
					setPassedMessageInstruction(messageToMatch);
				}
			});
			break;
		case "capture":
			if (data == true || data == false) {
				capturingSerial = data;
			} else {
				capturingSerial = (!capturingSerial) ? true : false;
			}
			if (capturingSerial == true) {
				$("#interact-serial-capture-button").text("Stop Learning");
				$("#interact-serial-receive-value").text("Waiting for message...").removeClass("button");
			} else {
				$("#interact-serial-capture-button").text("Learn Message...");
				if (messageToMatch) {
					$("#interact-serial-receive-value").text(messageToMatch).removeClass("button");
				} else {
					$("#interact-serial-receive-value").text("Set...").addClass("button");
				}
			}
			break;
		case "showCapture":
			if (capturingSerial) {
				messageToMatch = data;
				setPassedMessageInstruction(messageToMatch);
				$("#interact-serial-receive-value").text(data).removeClass("button");
				if (messageToMatch) $("#interact-serial-receive-save").removeClass("disabled");
			}
			break;
		case "matchAll":
		case "matchBeginning":
			matchMode = stage;
			$("#interact-serial-receive-match div").removeClass("selected");
			element = (stage == "matchAll") ? "all" : "beginning";
			$("#serial-receive-match-"+element).addClass("selected");
			if (matchMode == "matchAll") {
				serialReceive("setRemoveBeginning", false);
				$("#serial-receive-remove-beginning").addClass("disabled");
			} else if (matchMode == "matchBeginning") {
				$("#serial-receive-remove-beginning").removeClass("disabled");
			}
			if (messageToMatch && data != false) {
				$("#interact-serial-receive-save").removeClass("disabled");
			}
			setPassedMessageInstruction(messageToMatch);
			break;
		case "setRemoveBeginning":
			removeBeginning = (data != null) ? data : (removeBeginning == false);
			if (removeBeginning) {
				$("#serial-receive-remove-beginning").addClass("on");
			} else {
				$("#serial-receive-remove-beginning").removeClass("on");
			}
			if (messageToMatch) {
				$("#interact-serial-receive-save").removeClass("disabled");
			}
			setPassedMessageInstruction(messageToMatch);
			break;
		case "preview":
			return "Message "+((data.matchAll) ? "is" : "begins with")+" '"+((data.matchAll) ? data.matchAll : data.matchBeginning)+"'"+((data.removeBeginning) ? ", pass message without the beginning" : "");
			break;
	}
}

function setPassedMessageInstruction(text = null) {
	if (matchMode == "matchBeginning" && removeBeginning) {
		if (text) {
			instruction = "From '"+text+"<strong>abcd</strong>', only '<strong>abcd</strong>' is passed.";
		} else {
			instruction = "Message is passed without the matched beginning text.";
		}
	} else {
		instruction = "Whole message is passed.";
	}
	$("#serial-receive-passed-text").html(instruction);
}

messageToSend = null;

function serialSend(stage, data) {
	switch (stage) {
		case "setup":
			if (data) {
				messageToSend = data.message;
				$("#interact-serial-send-value").text(messageToSend).removeClass("button");
			} else {
				messageToSend = null;
				$("#interact-serial-send-value").text("Set...").addClass("button");
			}
			beo.ask("serial-send-setup");
			break;
		case "save":
			beo.ask();
			saveAction("interact", "serialSend", {message: messageToSend});
			break;
		case "set":
			beo.startTextInput(1, "Set Text", 
				"Enter the message to send. Tags #trigger and #previous will be replaced by the values from trigger and previous action.", 
				{text: messageToSend, placeholders: {text: "Message"}}, function(input) {
				// Validate and store input.
				if (input && input.text) {
					messageToSend = input.text;
					$("#interact-serial-send-value").text(input.text).removeClass("button");
					if (messageToSend) $("#interact-serial-send-save").removeClass("disabled");
				}
			});
			break;
		case "preview":
			return "Send '"+data.message+"'";
			break;
	}
}

// HTTP API TRIGGER/ACTION

addressEnd = null;
function httpAPISetup(type, stage, data) {
	switch (stage) {
		case "setup":
			$("#http-api-received-domain").text(document.domain);
			beo.ask("http-api-received-setup");
			if (data && data.addressEnd) {
				$("#http-api-received-key").text(data.addressEnd).removeClass("light");
				$("#http-api-received-key-set").text(data.addressEnd).removeClass("button");
				addressEnd = data.addressEnd;
			} else {
				$("#http-api-received-key").text("???").addClass("light");
				$("#http-api-received-key-set").text("Set...").addClass("button");
				addressEnd = null;
			}
			if (addressEnd) $("#http-api-received-save").addClass("disabled");
			break;
		case "set":
			beo.startTextInput(1, "Set Address End", 
				"Enter the key for the HTTP POST API address.", 
				{text: addressEnd, placeholders: {text: "Message"}}, function(input) {
				// Validate and store input.
				if (input && input.text) {
					addressEnd = input.text;
					$("#http-api-received-key").text(input.text).removeClass("light");
					$("#http-api-received-key-set").text(input.text).removeClass("button");
					if (addressEnd) $("#http-api-received-save").removeClass("disabled");
				}
			});
			break;
		case "save":
			beo.ask();
			saveTrigger("interact", "httpAPI", {addressEnd: addressEnd});
			break;
		case "preview":
			return "POST at http://"+document.domain+"/interact/trigger/"+data.addressEnd;
			break;
	}
}


return {
	enableInteractions: enableInteractions,
	newInteraction: createInteraction,
	saveInteraction: saveInteraction,
	editInteraction: editInteraction,
	nameInteraction: nameInteraction,
	deleteInteraction: deleteInteraction,
	cancelEditing: cancelEditing,
	chooseTrigger: chooseTrigger,
	editTrigger: editTrigger,
	saveTrigger: saveTrigger,
	triggerMenu: triggerMenu,
	addAction: addAction,
	saveAction: saveAction,
	editAction: editAction,
	deleteAction: deleteAction,
	actionMenu: actionMenu,
	serialReceive: serialReceive,
	serialSend: serialSend,
	selectSerialPort: selectSerialPort,
	httpAPISetup: httpAPISetup
}
	
})();