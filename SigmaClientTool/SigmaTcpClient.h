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

private:
	SigmaReadResponse m_readResponse;
	SigmaProtocolDataFormatter m_dataFormatter;
	int m_sockConnection;
};