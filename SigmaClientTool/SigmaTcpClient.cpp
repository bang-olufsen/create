/*Copyright 2017 Bang & Olufsen A/S

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

#include "SigmaTcpClient.h"
#include <stdexcept>
#include<sys/socket.h>
#include<arpa/inet.h> 
#include <unistd.h>
#include <cstring>
#include <iostream>
#include <stdio.h>

SigmaTcpClient::SigmaTcpClient() :
m_sockConnection(-1)
{
	memset(m_requestDatabuffer, 0, m_MaxRequestSize);
}

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
	if (size > m_MaxRequestSize)
	{
		std::cout << "Error reading, maximum allowed size of read is " << m_MaxRequestSize << " bytes" << std::endl;
		return m_readResponse;
	}

	m_dataFormatter.ReadRequest(addr, size, m_requestDatabuffer);

	::send(m_sockConnection, m_requestDatabuffer, SigmaCommandHeaderSize, 0);
	::recv(m_sockConnection, m_requestDatabuffer, size + SigmaCommandHeaderSize, 0);

	m_dataFormatter.GetReadResponse(m_requestDatabuffer, &m_readResponse);

	return m_readResponse;
} 

void SigmaTcpClient::WriteMemory(uint16_t addr, uint16_t size, uint8_t* data)
{
	if (size > m_MaxRequestSize)
	{
		std::cout << "Error writing, maximum allowed size of write is " << m_MaxRequestSize << " bytes" << std::endl;
		return;
	}
	
	m_dataFormatter.WriteRequest(addr, size, data, m_requestDatabuffer);
	::send(m_sockConnection, m_requestDatabuffer, size + SigmaCommandHeaderSize, 0);
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

bool SigmaTcpClient::WriteEeprom(std::string pathToFile)
{
	uint16_t requestSize = 0;
	uint8_t successVal = 0;
	m_dataFormatter.EepromRequest(pathToFile, &requestSize, m_requestDatabuffer);

	if (requestSize > 0)
	{
		::send(m_sockConnection, m_requestDatabuffer, requestSize, 0);
		::recv(m_sockConnection, &successVal, 1, 0);
	}

	return successVal == 1;
}