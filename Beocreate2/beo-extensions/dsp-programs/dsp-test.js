var beoDSP = require('../../beocreate_essentials/dsp');
var xmlJS = require('/usr/lib/node_modules/xml-js');

beoDSP.connectDSP(function(success) {  
	if (success) {
		console.log("DSP connected successfully.");
		beoDSP.getChecksum(function(checksum) {
			console.log("Program checksum is: "+checksum);
			setTimeout(function() {
				beoDSP.getXML(function(response) {
					metadata = (response != null) ? parseDSPMetadata(response).metadata : null;
					console.log(metadata);
					setTimeout(function() {
						beoDSP.getChecksum(function(checksum) {
							console.log("Program checksum is: "+checksum);
							beoDSP.disconnectDSP(function() {
								console.log("DSP was disconnected.");
								process.exit(0);
							});
						});
					}, 1000);
				});
			}, 1000);
		});
	}
}); // Opens a link with the SigmaDSP daemon.


function parseDSPMetadata(xml, fileref) {
	// Get the DSP metadata from the XML as a JavaScript object.
	metadataXML = '<beometa>' + xml.split("</beometa>")[0].split("<beometa>")[1] + "</beometa>";
	beoMeta = {};
	try {
		rawMetadata = xmlJS.xml2js(metadataXML, {compact: true}).beometa.metadata;
		if (rawMetadata) {
			for (var i = 0; i < rawMetadata.length; i++) {
				if (rawMetadata[i]._text) {
					values = rawMetadata[i]._text.split(",");
					for (var v = 0; v < values.length; v++) {
						if (!isNaN(values[v])) values[v] = parseFloat(values[v]);
					}
					beoMeta[rawMetadata[i]._attributes.type] = {value: values};
					for (var key in rawMetadata[i]._attributes) {
					    if (rawMetadata[i]._attributes.hasOwnProperty(key)) {
							if (key != "type") {
								beoMeta[rawMetadata[i]._attributes.type][key] = rawMetadata[i]._attributes[key];
							}
					    }
					}
				}
			}
		} else {
			beoMeta = null;
		}
		return {metadata: beoMeta, error: null};
	} catch (error) {
		if (filename) {
			console.error("Invalid XML encountered in DSP program '"+fileref+"'. Error:", error);
		} else {
			console.error("Invalid XML encountered in the received DSP program. Error:", error);
		}
		return {metadata: null, error: error};
	}
}