#include "SigmaTcpClient.h"
#include <stdexcept>
#include<sys/socket.h>
#include<arpa/inet.h> 
#include <unistd.h>

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
