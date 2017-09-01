#pragma once

#include "SigmaDataTypes.h"
#include <string>

class SigmaProtocolDataFormatter {
public:
	SigmaProtocolDataFormatter();
	~SigmaProtocolDataFormatter();

	void CreateSigmaWriteRequest(uint16_t addr, uint16_t length, uint8_t* data,  uint8_t** sigmaWriteRequest);

	void CreateSigmaReadRequest(uint16_t addr, uint16_t length, uint8_t** sigmaReadRequest);

	void GetSigmaReadResponse(uint8_t* rawDataResponse, SigmaReadResponse* readRepsonse);
};