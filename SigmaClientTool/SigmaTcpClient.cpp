#include "SigmaTcpClient.h"
#include <stdexcept>
#include<sys/socket.h>
#include<arpa/inet.h> 
#include <unistd.h>
#include <cstring>

SigmaTcpClient::SigmaTcpClient() :
m_sockConnection(-1)
{}

SigmaTcpClient::~SigmaTcpClient()
{
}

void SigmaTcpClient::InitializeConnection(std::string ip)
{
	m_sockConnection = socket(AF_INET, SOCK_STREAM, 0);
	
	struct sockaddr_in hostAddress;

	hostAddress.sin_addr.s_addr = inet_addr(ip.c_str());
	hostAddress.sin_family = AF_INET;
	hostAddress.sin_port = htons(SigmaServerPortNumber);
	
	int retryCount = 10;
	int status;
	do {
		status = ::connect(m_sockConnection, (sockaddr *)&hostAddress, sizeof(hostAddress));
		--retryCount;
		sleep(1);

	} while (status != 0 && retryCount > 0);

	if (status != 0) {
		m_sockConnection = -1; // ensure the state is the disconnected state
		throw std::domain_error("Unable to connect to SigmaTcpDaemon");
	}
}

SigmaReadResponse& SigmaTcpClient::ReadMemory(uint16_t addr, uint16_t size)
{
	uint8_t* readRequst = nullptr;
	m_dataFormatter.CreateSigmaReadRequest(addr, size, &readRequst);

	uint8_t* bytesToRcv = (uint8_t*) malloc(size + SigmaCommandHeaderSize);
	::send(m_sockConnection, readRequst, SigmaCommandHeaderSize, 0);
	::recv(m_sockConnection, bytesToRcv, size + SigmaCommandHeaderSize, 0);

	m_dataFormatter.GetSigmaReadResponse(bytesToRcv, &m_readResponse);

	free(readRequst);
	free(bytesToRcv);

	return m_readResponse;
} 

void SigmaTcpClient::WriteMemory(uint16_t addr, uint16_t size, uint8_t* data)
{
	uint8_t* writeRequest = nullptr;
	m_dataFormatter.CreateSigmaWriteRequest(addr, size, data, &writeRequest);
	::send(m_sockConnection, writeRequest, size + SigmaCommandHeaderSize, 0);

	free(writeRequest);
}

double SigmaTcpClient::ReadDecimal(uint16_t addr)
{
	SigmaReadResponse& resp = ReadMemory(addr, m_DecimalByteSize);
	int32_t resultValInt = 0;
	resultValInt |= (resp.data[0] << 24);
	resultValInt |= (resp.data[1] << 16);
	resultValInt |= (resp.data[2] << 8);
	resultValInt |= resp.data[3];

	double decimalResult = resultValInt / m_FullScaleIntValue;

	return decimalResult;	
}

void SigmaTcpClient::WriteDecimal(uint16_t addr, double value)
{
	int decimalIntValue = (int) ((value *  m_FullScaleIntValue) + 0.5);
	uint8_t memValue[4] = {0};
	memValue[0] = (uint8_t) (decimalIntValue >> 24);
	memValue[1] = (uint8_t) (decimalIntValue >> 16);
	memValue[2] = (uint8_t) (decimalIntValue >> 8);
	memValue[3] = (uint8_t) decimalIntValue;

	WriteMemory(addr, 4, memValue);
}

int SigmaTcpClient::ReadInteger(uint16_t addr)
{
	SigmaReadResponse& resp = ReadMemory(addr, m_IntByteSize);
	int resultValInt = 0;

	resultValInt |= (resp.data[0] << 24);
	resultValInt |= (resp.data[1] << 16);
	resultValInt |= (resp.data[2] << 8);
	resultValInt |= resp.data[3];
	return resultValInt;
}

void SigmaTcpClient::WriteInteger(uint16_t addr, int value)
{
	uint8_t memValue[4] = { 0 };
	memValue[0] = (uint8_t)(value >> 24);
	memValue[1] = (uint8_t)(value >> 16);
	memValue[2] = (uint8_t)(value >> 8);
	memValue[3] = (uint8_t)value;
	WriteMemory(addr, m_IntByteSize, memValue);
}

