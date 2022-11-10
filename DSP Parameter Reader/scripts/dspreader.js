/*Copyright 2018-2022 Bang & Olufsen A/S
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.*/


// https://www.html5rocks.com/en/tutorials/file/dndfiles/
function handleFileSelect(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	var files = evt.dataTransfer.files; // FileList object.

    // files is a FileList of File objects. List some properties.
	
	file = files[0];
	
	hideMetadata();
	hideBlockDetail();
	
	// Only process text files.
	$("#dsp-object-0").empty();
	$("#block-board-wrap h1").text("");
	if (file.name.indexOf('.params') != -1) {
		theName = file.name.replace(".params", "");
		$("#block-board-wrap").addClass("visible");
		$("#block-board-wrap h1").text(theName);
		$("#file-selector-wrap").removeClass("no-file").addClass("file");
		
		var reader = new FileReader();
		
		  // Closure to capture the file information.
		  reader.onload = (function(theFile) {
			return function(e) {
				//console.log(e.target.result);
				parseParameters(e.target.result);
			};
		})(file);
		
		// Read in the image file as a data URL.
		reader.readAsText(file);
	} else {
		$("#file-selector-wrap").removeClass("file").addClass("no-file");
		$("#drop-zone h1").text(file.name);
		$("#block-board-wrap").removeClass("visible");
		$("#drop-zone #message").text("The file was not recognised, must end with .params. Select 'Export System Files' from the Action menu in SigmaStudio to create the file.");
	}
}

function handleDragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

// Setup the dnd listeners.
var dropZone = document.body;
dropZone.addEventListener('dragover', handleDragOver, false);
dropZone.addEventListener('drop', handleFileSelect, false);

var boards;

function parseParameters(text) {
	
	// Reset metadata.
	metadata = {};
	metadata["sampleRate"] = {value: 48000};
	metadata["profileName"] = {value: "Beocreate Universal"};
	metadata["profileVersion"] = {value: 1};
	metadata["programID"] = {value: "beocreate-universal"};
	metadata["modelName"] = {value: "Beocreate 4-Channel Amplifier", modelID: "beocreate-4ca-mk1"};
	metadata["checksum"] = {value: "AddMe"};
	
	
	rawParams = text.split("\r\n\r\n\r\n\r\n");
	
	allParams = [];
	maxDepth = 0;
	
	// Creates a nice, tidy object of all parameters.
	for (var p = 0; p < rawParams.length-1; p++) {
		paramItems = rawParams[p].split("\r\n");
		titles = paramItems[0].split("= ")[1].split(".");
		if (titles.length == 1) {
			hierarchyBoard = false;
			title = titles[0];
		} else {
			hierarchyBoard = titles.slice(0, -1);
			if (hierarchyBoard.length > maxDepth) maxDepth = hierarchyBoard.length;
			title = titles.slice(-1)[0];
		}
		paramName = paramItems[1].split("= ")[1];
		paramAddress = parseInt(paramItems[2].split("= ")[1]);
		allParams.push({title: title, hierarchyBoard: hierarchyBoard, paramName: paramName, paramAddress: paramAddress});
	}
	
	//console.log(maxDepth);
	
	// Loops through all parameters, merging related parameters together into boards and blocks.
	boards = {"blocks": [], "boards": {}, "id": 0};
	previousBlock = null;
	objectIndex = 1;
	for (var p = 0; p < allParams.length; p++) {
		currentBoard = boards;
		if (allParams[p].hierarchyBoard) {
			for (var b = 0; b < allParams[p].hierarchyBoard.length; b++) {
				if (!currentBoard.boards[allParams[p].hierarchyBoard[b]]) {
					//if (previousBlock) outputBlock(previousBlock);
					currentBoard.boards[allParams[p].hierarchyBoard[b]] = {"blocks": [], "boards": {}, "id": objectIndex};
					objectIndex++;
				}
				currentBoard = currentBoard.boards[allParams[p].hierarchyBoard[b]];
			}
		}
		foundRef = undefined;
		for (var c = 0; c < currentBoard.blocks.length; c++) {
			if (currentBoard.blocks[c].title == allParams[p].title) {
				foundRef = c;
				currentBoard.blocks[c].paramName.push(allParams[p].paramName);
				currentBoard.blocks[c].paramAddress.push(allParams[p].paramAddress);
				//previousBlock = currentBoard.blocks[c];
				break;
			}
		}
		if (foundRef == undefined) {
			//if (previousBlock) outputBlock(previousBlock);
			
			blockType = null;
			if (allParams[p].paramName.indexOf("mute") != -1) blockType = "mute";
			if (allParams[p].paramName.indexOf("GainADAU") != -1) blockType = "volume";
			if (allParams[p].paramName.indexOf("EQS300Multi") != -1) blockType = "biquad";
			if (allParams[p].paramName.indexOf("muxSigma") != -1) blockType = "switch";
			if (allParams[p].paramName.indexOf("SafeLoad") != -1) blockType = "safeload";
			if (allParams[p].paramName.indexOf("DCInp") != -1) blockType = "dc";
			if (allParams[p].paramName.indexOf("invert") != -1) blockType = "invert";
			blockLength = currentBoard.blocks.push({title: allParams[p].title, hierarchyBoard: allParams[p].hierarchyBoard, blockType: blockType, paramName: [allParams[p].paramName], paramAddress: [allParams[p].paramAddress], id: objectIndex});
			objectIndex++;
			//previousBlock = currentBoard.blocks[blockLength-1];
		}
	}
	console.log(boards);
	
	
	outputBoards(boards, 0);
}

// Recursive function to output everything from the boards
outputObjectIndex = 0;
function outputBoards(target, objectID) {
	//console.log(target);
	for (property in target.boards) {
		//console.log(property);
		$("#dsp-object-"+objectID).append('<div class="hierarchy-board block-container dsp-object" id="dsp-object-'+target.boards[property].id+'" data-object-id="'+target.boards[property].id+'" data-board-name="'+property+'"><h2 onclick="toggleBoard('+target.boards[property].id+');">'+property+'</h2></div>');
		outputBoards(target.boards[property], target.boards[property].id);
	}
	if (target.blocks.length > 0) {
		blockCount = target.blocks.length;
		for (var b = 0; b < target.blocks.length; b++) {
			if (target.blocks[b].blockType != "safeload") {
				
				$("#dsp-object-"+objectID).append('<div class="block dsp-object" id="dsp-object-'+target.blocks[b].id+'" data-object-id="'+target.blocks[b].id+'" data-block-index="'+b+'" onclick="showDetail('+target.blocks[b].id+');"><h3>'+target.blocks[b].title+'</h3></div>');
				generateMetadataForBlock(target.blocks[b]);
				paramAddress = getRelevantParamAddress(target.blocks[b]);
				$("#dsp-object-"+target.blocks[b].id).append('<span>'+paramAddress.address+'</span>').addClass(paramAddress.classes);
			} else {
				$("#dsp-object-"+objectID).append('<div class="block dsp-object safeload" id="dsp-object-'+target.blocks[b].id+'" data-object-id="'+target.blocks[b].id+'" data-block-index="'+b+'" onclick="showDetail('+target.blocks[b].id+');"><h3>Safeload Registers</h3></div>');
			}
		}
		addDummyBlocks(blockCount, "#dsp-object-"+objectID);
	}
	outputObjectIndex++
	
	metadata["spdifTXUserDataSource"] = {value: 63135, storable: "yes"};
	metadata["spdifTXUserDataL0"] = {value: 63135, storable: "yes"};
	metadata["spdifTXUserDataL1"] = {value: 63168, storable: "yes"};
	metadata["spdifTXUserDataL2"] = {value: 63169, storable: "yes"};
	metadata["spdifTXUserDataL3"] = {value: 63170, storable: "yes"};
	metadata["spdifTXUserDataL4"] = {value: 63171, storable: "yes"};
	metadata["spdifTXUserDataL5"] = {value: 63172, storable: "yes"};
	metadata["spdifTXUserDataR0"] = {value: 63173, storable: "yes"};
	metadata["spdifTXUserDataR1"] = {value: 63185, storable: "yes"};
}



function getRelevantParamAddress(block) {
	classes = [];
	ignoreNonSequential = false;
	switch (block.blockType) {
		case "volume":
			findRegisterWithName = "target";
			break;
		case "biquad":
			findRegisterWithName = "B2_";
			break;
		default:
			findRegisterWithName = undefined;
	}
	relevantAddresses = [];
	previousAddress = null;
	for (var i = 0; i < block.paramAddress.length; i++) {
		// Loops through registers:
		// - if a certain register needs to be found, attempts to find it.
		// - checks if the addresses are sequential.
		if (findRegisterWithName) {
			if (block.paramName[i].indexOf(findRegisterWithName) != -1) {
				if (relevantAddresses.indexOf(block.paramAddress[i]) == -1) {
					relevantAddresses.push(block.paramAddress[i]);
				}
			}
		}
		if (previousAddress != null) {
			if (!ignoreNonSequential) {
				if (Math.abs(previousAddress-block.paramAddress[i]) > 1) {
					if (classes.indexOf("non-sequential") == -1) classes.push("non-sequential");
				}
			}
		}
		previousAddress = block.paramAddress[i];
	}
	
	if (relevantAddresses.length == 0) {
		returnAddress = block.paramAddress[0];
	} else {
		returnAddress = relevantAddresses[0];
	}
	
	if (classes.length) {
		classes = classes.join(" ");
	} else {
		classes = "";
	}
	
	return {address: returnAddress, relevantAddresses: relevantAddresses, classes: classes};
}

function addDummyBlocks(blockCount, targetContainer) {
	blockRemainder = blockCount % 3;
	//console.log(blockCount, blockRemainder);
	if (blockRemainder) {
		for (var b = 0; b < 3-blockRemainder; b++) {
			$(targetContainer).append('<div class="block empty dsp-object"></div>');
		}
	}
}


function hideBlockDetail() {
	$("#modal-bg, #block-detail, #add-metadata").removeClass("visible");
	$("body").removeClass("static");
}

var selectedBlock = {};
function showDetail(id, path, data) {
	if (id != null) {
		if (!path) path = [];
		if ($("#dsp-object-"+id).attr("data-block-index")) {
			path.push($("#dsp-object-"+id).attr("data-block-index"));
		} else if ($("#dsp-object-"+id).attr("data-board-name")) {
			path.push($("#dsp-object-"+id).attr("data-board-name"));
		}
		parentID = $("#dsp-object-"+id).parent().attr("data-object-id");
		if (parentID != 0) {
			showDetail(parentID, path);
		} else {
			console.log(path);
			showDetail(null, path, boards);
		}
	} else {
		if (path.length > 1) {
			newData = data.boards[path[path.length-1]];
			path.pop();
			showDetail(null, path, newData);
		} else {
			selectedBlock = data.blocks[path[0]];
			if (selectedBlock.blockType != "safeload") {
				$("#block-detail h1").text(selectedBlock.title);
			} else {
				$("#block-detail h1").text("Safeload Registers");
			}
			$(".register-count").text(selectedBlock.paramAddress.length);
			
			if (selectedBlock.hierarchyBoard) {
				$("#block-detail h2").html("<span>Main</span><span>"+selectedBlock.hierarchyBoard.join("</span><span>")+"</span>");
			} else {
				$("#block-detail h2").text("Main");
			}
			
			$("#block-detail #addresses").empty();
			relevantAddresses = getRelevantParamAddress(selectedBlock).relevantAddresses;
			
			if (relevantAddresses.length == 0) {
				$("#block-detail #addresses").addClass("all-relevant");
			} else {
				$("#block-detail #addresses").removeClass("all-relevant");
			}
			for (var i = 0; i < selectedBlock.paramAddress.length; i++) {
				classes = "";
				if (relevantAddresses.indexOf(selectedBlock.paramAddress[i]) != -1) {
					classes = "relevant ";
				}
				$("#block-detail #addresses").append('<div class="'+classes+'"><div class="param-name">'+selectedBlock.paramName[i]+'</div><div class="param-address">'+selectedBlock.paramAddress[i]+'</div></div>');
			}
			
			$("#modal-bg, #block-detail").addClass("visible");
			$("body").addClass("static");
		}
	}
}

function toggleBoard(id) {
	$("#dsp-object-"+id).toggleClass("hidden");
}

metadata = {};

function generateMetadataForBlock(block) {
	switch (block.title) {
		case "Mute":
			metadata["muteRegister"] = {value: block.paramAddress[0]};
			break;
		case "MuteInvert":
			metadata["muteInvertRegister"] = {value: block.paramAddress[0], storable: "yes"};
			break;
		case "SPDIFOn":
			metadata["enableSPDIFRegister"] = {value: block.paramAddress[0], storable: "yes"};
			break;
		case "SPDIF on read":
			metadata["readSPDIFOnRegister"] = {value: block.paramAddress[0]};
			break;
		case "SPDIFDetect":
			metadata["sensitivitySPDIFRegister"] = {value: block.paramAddress[2]};
			break;
		case "SPDIF-TX-Enable":
			metadata["enableSPDIFTransmitterRegister"] = {value: block.paramAddress[0]};
			break;
		case "SPDIF-TX-OffAtMute":
			metadata["disableSPDIFTransmitterAtMuteRegister"] = {value: block.paramAddress[0]};
			break;
		case "CanBeDaisyChained":
			metadata["canBecomeDaisyChainSlaveRegister"] = {value: block.paramAddress[0]};
			break;
		case "Daisy-Chain On Read":
			metadata["readIsDaisyChainSlaveRegister"] = {value: block.paramAddress[0]};
			break;
		case "TuningFork":
			metadata["tuningForkPitchRegister"] = {value: block.paramAddress[0]};
			metadata["tuningForkOnRegister"] = {value: block.paramAddress[1]};
			break;
		case "IIR_L":
			metadata["customFilterRegisterBankLeft"] = {value: block.paramAddress[0]+"/"+block.paramAddress.length, storable: "yes"};
			break;
		case "IIR_R":
			metadata["customFilterRegisterBankRight"] = {value: block.paramAddress[0]+"/"+block.paramAddress.length, storable: "yes"};
			break;
		case "ToneControl_L":
			metadata["toneControlLeftRegisters"] = {value: block.paramAddress[0]+"/"+block.paramAddress.length, storable: "yes"};
			break;
		case "ToneControl_R":
			metadata["toneControlRightRegisters"] = {value: block.paramAddress[0]+"/"+block.paramAddress.length, storable: "yes"};
			break;
		case "IIR_A":
		case "IIR_B":
		case "IIR_C":
		case "IIR_D":
		case "IIR_E":
		case "IIR_F":
		case "IIR_G":
		case "IIR_H":
			metadata[block.title] = {value: block.paramAddress[0]+"/"+block.paramAddress.length, storable: "yes"};
			break;
		case "Invert_A":
		case "Invert_B":
		case "Invert_C":
		case "Invert_D":
		case "Invert_E":
		case "Invert_F":
		case "Invert_G":
		case "Invert_H":
			metadata["invert"+block.title.charAt(7)+"Register"] = {value: block.paramAddress[0], storable: "yes"};
			break;
		case "Ch_A":
		case "Ch_B":
		case "Ch_C":
		case "Ch_D":
		case "Ch_E":
		case "Ch_F":
		case "Ch_G":
		case "Ch_H":
			metadata["channelSelect"+block.title.charAt(3)+"Register"] = {value: block.paramAddress[0], channels: "left,right,mono,side", multiplier: 1, storable: "yes"};
			break;
		case "Delay_A":
		case "Delay_B":
		case "Delay_C":
		case "Delay_D":
		case "Delay_E":
		case "Delay_F":
		case "Delay_G":
		case "Delay_H":
			metadata["delay"+block.title.charAt(6)+"Register"] = {value: block.paramAddress[0], maxDelay: 2000, storable: "yes"};
			break;
		case "Ch_Toslink_L":
			metadata["channelSelectSPDIFLeftRegister"] = {value: block.paramAddress[0], channels: "left,right,mono,side", multiplier: 1, storable: "yes"};
			break;
		case "Ch_Toslink_R":
			metadata["channelSelectSPDIFRightRegister"] = {value: block.paramAddress[0], channels: "left,right,mono,side", multiplier: 1, storable: "yes"};
			break;
		case "Balance":
			metadata["balanceRegister"] = {value: block.paramAddress[0], storable: "yes"};
			break;
		case "MasterVol":
			metadata["volumeControlRegister"] = {value: getRelevantParamAddress(block).address, storable: "yes"};
			break;
		case "Levels":
			registers = getRelevantParamAddress(block).relevantAddresses;
			metadata["levelsARegister"] = {value: registers[3], storable: "yes"};
			metadata["levelsBRegister"] = {value: registers[2], storable: "yes"};
			metadata["levelsCRegister"] = {value: registers[1], storable: "yes"};
			metadata["levelsDRegister"] = {value: registers[0], storable: "yes"};
			break;
		case "VolumeLimits":
			registers = getRelevantParamAddress(block).relevantAddresses;
			for (var i = 0; i < registers.length; i++) {
				switch (i) {
					case 0:
						metadata["volumeLimitRegister"] = {value: registers[0]};
						metadata["volumeLimitPiRegister"] = {value: registers[0], storable: "yes"};
						break;
					case 1:
						metadata["volumeLimitSPDIFRegister"] = {value: registers[1], storable: "yes"};
						break;
					case 2:
						metadata["volumeLimitI2S2Register"] = {value: registers[2], storable: "yes"};
						break;
				}
			}
			break;
		case "VolumeLimitPi":
			registers = getRelevantParamAddress(block).relevantAddresses;
			metadata["volumeLimitRegister"] = {value: registers[0] };
			metadata["volumeLimitPiRegister"] = {value: registers[0], storable: "yes"};
			break;
		case "VolumeLimitSPDIF":
			registers = getRelevantParamAddress(block).relevantAddresses;
			metadata["volumeLimitSPDIFRegister"] = {value: registers[0], storable: "yes"};
			break;
		case "VolumeLimitAux":
			registers = getRelevantParamAddress(block).relevantAddresses;
			metadata["volumeLimitAUXRegister"] = {value: registers[0], storable: "yes"};
			break;
		case "Master-Slave":
			metadata["masterSlaveSelectRegister"] = {value: block.paramAddress[0]};
			break;
		case "SPDIFOutMode":
			metadata["SPDIFOutputModeSelectRegister"] = {value: block.paramAddress[0]};
			break;
	}
}

function showMetadata() {
	if ($("#metadata").hasClass("visible")) {
		hideMetadata();
	} else {
		$("#modal-bg, #metadata").addClass("visible");
		$("body").addClass("static");
		$("#metadata-container").empty();
		
		for (metadataItem in metadata) {
			extraData = "";
			for (attribute in metadata[metadataItem]) {
				if (attribute != "value") {
					extraData += '<div class="extra-data-item"><span class="extra-data-title">'+attribute+'</span>'+metadata[metadataItem][attribute]+'</div>';
				}
			}
			if (extraData) extraData = '<div class="extra-data">'+extraData+'</div>';
			$("#metadata-container").append('<div data-metadata-item="'+metadataItem+'"><div class="first-row"><div class="metadata-name">'+metadataItem+'</div><div class="metadata-value" contenteditable="true">'+metadata[metadataItem].value+'</div></div>'+extraData+'</div>');
		}
	}
}

xml = false;
function toggleXML() {
	if (!xml) {
		xmlData = "<beometa>\n";
		for (metadataItem in metadata) {
			metadata[metadataItem].value = $('div[data-metadata-item="'+metadataItem+'"] .metadata-value').text();
			extraData = "";
			for (attribute in metadata[metadataItem]) {
				if (attribute != "value") {
					extraData += ' '+attribute+'="'+metadata[metadataItem][attribute]+'"';
				}
			}
			xmlData += '\t<metadata type="'+metadataItem+'"'+extraData+'>'+metadata[metadataItem].value+'</metadata>\n';
		}
		xmlData += "</beometa>";
		$("#metadata-xml").val(xmlData).removeClass("hidden");
		$("#copy-xml").removeClass("hidden");
		$("#metadata-container").addClass("hidden");
		xml = true;
	} else {
		$("#metadata-xml").addClass("hidden");
		$("#metadata-container").removeClass("hidden");
		$("#copy-xml").addClass("hidden");
		xml = false;
	}
}

function copyXML() {
	$("#metadata-xml").select();
	document.execCommand("copy");
}


function hideMetadata() {
	$("#modal-bg, #metadata").removeClass("visible");
	$("body").removeClass("static");
}