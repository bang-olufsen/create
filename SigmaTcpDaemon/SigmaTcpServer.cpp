#include "SigmaTcpServer.h"

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netdb.h>
#include <arpa/inet.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <stdbool.h>
#include <net/if.h>
#include <netinet/if_ether.h>
#include <sys/ioctl.h>
#include <stdexcept>
#include <thread>
#include <iostream>
#include <mutex>

std::mutex spiDeviceMutex;

SigmaTcpServer::SigmaTcpServer() : 
m_portNumber(-1),
m_hwCommIf(nullptr)
{
}

SigmaTcpServer::~SigmaTcpServer()
{
}

void SigmaTcpServer::Initialize(int port, HwCommunicationIF* hwCommunicationIF)
{
	m_hwCommIf = hwCommunicationIF;
	m_portNumber = port;
}

void ConnectionHandlerThread(int fd, HwCommunicationIF* hwCommunicationIF)
{
	const int MaxConnectionBufferSize = 256 * 1024;
	const char CommandRead = 0x0a;
	const char CommandWrite = 0x0b;
	const size_t CmdByteSize = 14;

	uint8_t buf[MaxConnectionBufferSize] = { 0 };

	size_t rxByteCount = 0;

	uint8_t *commandPtr = &buf[0];
	size_t remainingBytes = 0;

	while (true)
	{
		if (remainingBytes > 0)
		{
			memmove(&buf[0], commandPtr, remainingBytes);
		}
		rxByteCount = read(fd, buf + remainingBytes, MaxConnectionBufferSize - remainingBytes);
		if (rxByteCount <= 0)
			break;

		std::unique_lock<std::mutex> deviceLock(spiDeviceMutex);
		remainingBytes += rxByteCount;
		commandPtr = &buf[0];

		while (remainingBytes >= CmdByteSize)
		{
			char command = commandPtr[0];

			if (command == CommandRead) {

				unsigned int len = (commandPtr[8] << 8) | commandPtr[9];
				unsigned int addr = (commandPtr[10] << 8) | commandPtr[11];

				if (len > 0)
				{
					const int readDataOffset = 14;
					uint8_t* read_buf = (uint8_t*)malloc(len + readDataOffset);

					read_buf[0] = CommandWrite;
					read_buf[1] = commandPtr[1];
					read_buf[2] = commandPtr[2];
					read_buf[3] = commandPtr[3];
					read_buf[4] = commandPtr[4];
					read_buf[5] = commandPtr[5];
					read_buf[6] = commandPtr[6];
					read_buf[7] = commandPtr[7];
					read_buf[8] = commandPtr[8];
					read_buf[9] = commandPtr[9];
					read_buf[10] = commandPtr[10];
					read_buf[11] = commandPtr[11];
					read_buf[12] = 0x00;
					read_buf[13] = 0x00;

					try
					{
						hwCommunicationIF->Read(addr, len, &read_buf[readDataOffset]);
					}
					catch (std::exception& e)
					{
						free(read_buf);
						std::cout << "Error reading data: " << e.what() << '\n';
					}

					write(fd, read_buf, len + readDataOffset);
					free(read_buf);
				}

				remainingBytes -= CmdByteSize;
				commandPtr += CmdByteSize;
			}
			else {
				unsigned int len = (commandPtr[10] << 8) | commandPtr[11];
				unsigned int addr = (commandPtr[12] << 8) | commandPtr[13];

				if (remainingBytes < CmdByteSize + len)
				{
					break;
				}

				try
				{
					hwCommunicationIF->Write(addr, len, commandPtr + CmdByteSize);
				}
				catch (std::exception& e)
				{
					std::cout << "Error reading data: " << e.what() << '\n';
				}

				remainingBytes -= (len + CmdByteSize);
				commandPtr += CmdByteSize + len;
			}
		}
	}
}


void SigmaTcpServer::Start()
{
	int sockFd, newSockFd;

	if (m_portNumber < 0)
	{
		throw std::out_of_range("port number is out of range");
	}

	struct addrinfo hints, *serverInfo;

	memset(&hints, 0, sizeof hints);
	hints.ai_family = AF_UNSPEC;
	hints.ai_socktype = SOCK_STREAM;
	hints.ai_flags = AI_PASSIVE;


	int ret = getaddrinfo(NULL, std::to_string(m_portNumber).c_str(), &hints, &serverInfo);
	if (ret != 0) {
		throw std::domain_error("failed to get address info, unable to start server");
	}
	
	sockFd = socket(serverInfo->ai_family, serverInfo->ai_socktype, serverInfo->ai_protocol);
	if (sockFd < 0)
	{
		throw std::domain_error("failed to create socket");
	}

	int reuse = 1;
	if (setsockopt(sockFd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(int)) < 0)
	{
		throw std::domain_error("failed to set socket options");
	}

	if (bind(sockFd, serverInfo->ai_addr, serverInfo->ai_addrlen) < 0)
	{
		throw std::domain_error("failed to bind socket");
	}

	freeaddrinfo(serverInfo);

	if (listen(sockFd, 0) < 0)
	{
		throw std::domain_error("Failed to listen on socket");
	}

	while (true) {
		newSockFd = accept(sockFd, NULL, NULL);
		if (newSockFd < 0) {
			continue;
		}

		//TODO limit number of threads and store descriptors, call join/delete
		new std::thread(ConnectionHandlerThread, newSockFd, m_hwCommIf);
	}

}

void SigmaTcpServer::Stop()
{ 

}
