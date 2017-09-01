#include "SigmaProtocolDataFormatter.h"
#include <cstring>

SigmaProtocolDataFormatter::SigmaProtocolDataFormatter() {

}
SigmaProtocolDataFormatter::~SigmaProtocolDataFormatter() {

}

void SigmaProtocolDataFormatter::SigmaProtocolDataFormatter::CreateSigmaWriteRequest(uint16_t addr, uint16_t length, uint8_t* data, uint8_t** sigmaWriteRequest) {

	*sigmaWriteRequest = (uint8_t*)malloc(SigmaCommandHeaderSize + length);
	memset(*sigmaWriteRequest, 0, SigmaCommandHeaderSize + length);

	(*sigmaWriteRequest)[0] = SigmaCommandWriteCode;
	(*sigmaWriteRequest)[10] = (uint8_t)((length & 0xFF00) >> 8);
	(*sigmaWriteRequest)[11] = (uint8_t) (length & 0x00FF);

	(*sigmaWriteRequest)[12] = (uint8_t)((addr & 0xFF00) >> 8);
	(*sigmaWriteRequest)[13] = (uint8_t)(addr & 0x00FF);

	memcpy(&(*sigmaWriteRequest)[14], data, length);
}

void SigmaProtocolDataFormatter::CreateSigmaReadRequest(uint16_t addr, uint16_t length, uint8_t** sigmaReadRequest) {

	*sigmaReadRequest = (uint8_t*)malloc(SigmaCommandHeaderSize);
	memset(*sigmaReadRequest, 0, SigmaCommandHeaderSize);

	(*sigmaReadRequest)[0] = SigmaCommandReadCode;
	(*sigmaReadRequest)[8] = (uint8_t)((length & 0xFF00) >> 8);
	(*sigmaReadRequest)[9] = (uint8_t)(length & 0x00FF);

	(*sigmaReadRequest)[10] = (uint8_t)((addr & 0xFF00) >> 8);
	(*sigmaReadRequest)[11] = (uint8_t)(addr & 0x00FF);
}

void SigmaProtocolDataFormatter::GetSigmaReadResponse(uint8_t* rawDataResponse, SigmaReadResponse* readRepsonse) {
	unsigned int len = (rawDataResponse[8] << 8) | rawDataResponse[9];
	unsigned int addr = (rawDataResponse[10] << 8) | rawDataResponse[11];

	readRepsonse->addr = (uint16_t) addr;
	readRepsonse->length = (uint16_t) len;

	if (len < 1024)
	{
		memcpy(readRepsonse->data, &rawDataResponse[14], len);
	}
}