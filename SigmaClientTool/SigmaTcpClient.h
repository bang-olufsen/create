#pragma once

#include "SigmaDataTypes.h"
#include <string>
#include "SigmaProtocolDataFormatter.h"

class SigmaTcpClient {
public:
	SigmaTcpClient();
	~SigmaTcpClient();

	void InitializeConnection(std::string ip);

	SigmaReadResponse& ReadMemory(uint16_t addr, uint16_t size);

	void WriteMemory(uint16_t addr, uint16_t size, uint8_t* data);

	double ReadDecimal(uint16_t addr);

	void WriteDecimal(uint16_t addr, double value);

	int ReadInteger(uint16_t addr);

	void WriteInteger(uint16_t addr, int value);

private:
	SigmaReadResponse m_readResponse;
	SigmaProtocolDataFormatter m_dataFormatter;
	int m_sockConnection;
	const double m_FullScaleIntValue = 16777216;
	const int m_DecimalByteSize = 4;
	const int m_IntByteSize = 4;
};