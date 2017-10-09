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

#include "SigmaTcpServer.h"
#include "SigmaTcpTypes.h"
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
#include <iostream>
#include <mutex>

std::mutex spiDeviceMutex;

SigmaTcpServer::SigmaTcpServer() :
m_portNumber(-1),
m_hwCommIf(nullptr),
m_debugPrint(false)
{
}

SigmaTcpServer::~SigmaTcpServer()
{
	Stop();
}

void SigmaTcpServer::Initialize(int port, HwCommunicationIF* hwCommunicationIF)
{
	m_hwCommIf = hwCommunicationIF;
	m_portNumber = port;
}

void ConnectionHandlerThread(int fd, HwCommunicationIF* hwCommunicationIF, std::atomic_bool* threadRunning, bool debugPrint)
{
	const int MaxConnectionBufferSize = 256 * 1024;
	const size_t CmdByteSize = sizeof(SigmaTcpReadRequest);
	EepromHandler eepromHandler;
	eepromHandler.Initialize(hwCommunicationIF);
	std::vector<uint8_t> readResponseBuffer(1024, 0);

	if (CmdByteSize != sizeof(SigmaTcpWriteRequest))
	{
		std::cout << "Error, the Sigma Studio read and write request headers differ in size, this is not supported" << std::endl;
		*threadRunning = false;
		shutdown(fd, SHUT_RDWR);
		close(fd);
		return;
	}

	uint8_t buf[MaxConnectionBufferSize] = { 0 };

	size_t rxByteCount = 0;

	uint8_t *commandPtr = &buf[0];
	size_t remainingBytes = 0;

	while (*threadRunning)
	{
		if (remainingBytes > 0)
		{
			memmove(&buf[0], commandPtr, remainingBytes);
		}
		rxByteCount = read(fd, buf + remainingBytes, MaxConnectionBufferSize - remainingBytes);
		if (rxByteCount <= 0)
		{
			break;
		}

		std::unique_lock<std::mutex> deviceLock(spiDeviceMutex);
		remainingBytes += rxByteCount;
		commandPtr = &buf[0];

		while (remainingBytes >= CmdByteSize)
		{
			//Handle the incoming command, must be either read or write request
			if (commandPtr[0] == CommandRead) 
			{
				//Read request, extract the relevant header information
				SigmaTcpReadRequest* readRequest =(SigmaTcpReadRequest*) &commandPtr[0];
				unsigned int dataLength = (readRequest->dataLength3 << 24) | (readRequest->dataLength2 << 16) | (readRequest->dataLength1 << 8) | readRequest->dataLength0;
				unsigned int dataAddress = (readRequest->addressHigh << 8) | readRequest->addressLow;

				if(debugPrint)
				{
					printf("Read %i bytes from %#04x\n", dataLength, dataAddress);
				}
				
				if (dataLength > 0)
				{
					SigmaTcpReadResponse readResponse;
					unsigned int totalResponseLength = dataLength + sizeof(SigmaTcpReadResponse);
					if (totalResponseLength > readResponseBuffer.size())
					{
						//Make sure the buffer can hold the response data and header information
						readResponseBuffer.resize(totalResponseLength, 0);
					}
			
					try
					{
						hwCommunicationIF->Read(dataAddress, dataLength, readResponseBuffer.data() + sizeof(SigmaTcpReadResponse));

						//Set the response data
						readResponse.totalLength0 = readRequest->totalLength0;
						readResponse.totalLength1 = readRequest->totalLength1;
						readResponse.totalLength2 = readRequest->totalLength2;
						readResponse.totalLength3 = readRequest->totalLength3;
						readResponse.chipAddress = readRequest->chipAddress;
						readResponse.dataLength0 = readRequest->dataLength0;
						readResponse.dataLength1 = readRequest->dataLength1;
						readResponse.dataLength2 = readRequest->dataLength2;
						readResponse.dataLength3 = readRequest->dataLength3;
						readResponse.addressHigh = readRequest->addressHigh;
						readResponse.addressLow = readRequest->addressLow;

						readResponse.successFailure = CommandReadSuccess;
					}
					catch (std::exception& e)
					{
						//Indicate that there was an error
						readResponse.successFailure = CommandReadFailure;
						dataLength = 0;
						std::cout << "Error reading data: " << e.what() << '\n';
					}
				
					//Copy the response header
					memcpy(readResponseBuffer.data(), (uint8_t*)&readResponse, sizeof(SigmaTcpReadResponse));
					//Write the response
					write(fd, readResponseBuffer.data(), totalResponseLength);
				}

				remainingBytes -= CmdByteSize;
				commandPtr += CmdByteSize;
			}
			else if (commandPtr[0] == CommandWrite) 
			{
				//Write request, extract the relevant header information
				SigmaTcpWriteRequest* writeRequest = (SigmaTcpWriteRequest*)&commandPtr[0];
				unsigned int dataLength = (writeRequest->dataLength3 << 24) | (writeRequest->dataLength2 << 16) | (writeRequest->dataLength1 << 8) | writeRequest->dataLength0;
				unsigned int dataAddress = (writeRequest->addressHigh << 8) | writeRequest->addressLow;

				if (debugPrint)
				{
					printf("Write %i bytes to 0x%04x\n", dataLength, dataAddress);
				}

				if (remainingBytes < CmdByteSize + dataLength)
				{
					break;
				}

				try
				{
					hwCommunicationIF->Write(dataAddress, dataLength, commandPtr + sizeof(SigmaTcpWriteRequest));
				}
				catch (std::exception& e)
				{
					std::cout << "Error reading data: " << e.what() << '\n';
				}

				remainingBytes -= (dataLength + CmdByteSize);
				commandPtr += CmdByteSize + dataLength;
			}
			else if (commandPtr[0] == CommandEEPROM)
			{
				SigmaTcpEepromRequest* eepromRequest = (SigmaTcpEepromRequest*)&commandPtr[0];

				if (remainingBytes >= eepromRequest->length + sizeof(SigmaTcpEepromRequest))
				{
					char* filePathString = new char[eepromRequest->length + 1];
					memset(filePathString, 0, eepromRequest->length + 1);

					memcpy(filePathString, commandPtr + sizeof(SigmaTcpEepromRequest), eepromRequest->length);

					uint8_t successVal = 0;
					
					if (eepromHandler.WriteFromXml(filePathString))
					{
						successVal = 1;
					}

					write(fd, &successVal, 1);

					remainingBytes = 0;

					delete[] filePathString;
				}
			}
			else
			{
				std::cout << "Unknown command received" << std::endl;
			}
		}
	}

	*threadRunning = false;
}


void SigmaTcpServer::Start()
{
	if (m_serverRunning)
	{
		//Already running
		return;
	}

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
	
	m_socketFd = socket(serverInfo->ai_family, serverInfo->ai_socktype, serverInfo->ai_protocol);
	if (m_socketFd < 0)
	{
		throw std::domain_error("failed to create socket");
	}

	int reuse = 1;
	if (setsockopt(m_socketFd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(int)) < 0)
	{
		throw std::domain_error("failed to set socket options");
	}

	if (bind(m_socketFd, serverInfo->ai_addr, serverInfo->ai_addrlen) < 0)
	{
		throw std::domain_error("failed to bind socket");
	}

	freeaddrinfo(serverInfo);

	if (listen(m_socketFd, 0) < 0)
	{
		throw std::domain_error("Failed to listen on socket");
	}

	m_serverRunning = true;

	while (m_serverRunning) 
	{
		int newSockFd = accept(m_socketFd, NULL, NULL);
		if (newSockFd < 0) 
		{
			continue;
		}

		//Make sure to update the thread pool to see if we can handle the incoming connection
		CleanThreadPool();

		if (m_threadPool.size() < m_MaxNumClients)
		{
			if (m_debugPrint)
			{
				std::cout << "Accepted a new connection" << std::endl;
			}

			//Add the new connection to the thread pool
			std::atomic_bool* threadStatus = new std::atomic_bool(true);
			std::thread* newClientThread = new std::thread(ConnectionHandlerThread, newSockFd, m_hwCommIf, threadStatus, m_debugPrint);
			m_threadPool.push_back(std::make_tuple(newClientThread, newSockFd, threadStatus));
		}
		else
		{
			//No more connections allowed, close the socket
			std::cout << "Only " << m_MaxNumClients << " active connections allowed at a time" << std::endl;
			shutdown(newSockFd, SHUT_RDWR);
			close(newSockFd);
		}
	}
}

void SigmaTcpServer::CloseClientConnection(std::thread* connectionThread, int fileDescriptor, std::atomic_bool* threadStatus)
{
	//close file desciptor, join and delete thread and free memory
	shutdown(fileDescriptor, SHUT_RDWR);
	close(fileDescriptor);

	//Signal that the thread should stop running
	*threadStatus = false;

	if (connectionThread != nullptr)
	{
		//Wait for thread to exit
		if (connectionThread->joinable())
		{
			connectionThread->join();
		}

		delete connectionThread;
	}

	delete threadStatus;
}

void SigmaTcpServer::CleanThreadPool()
{
	std::vector<std::tuple<std::thread*, int, std::atomic_bool*>> newThreadPool;
	for (unsigned int i = 0; i < m_threadPool.size(); i++)
	{
		std::atomic_bool* threadRunning = std::get<2>(m_threadPool.at(i));

		if (*threadRunning)
		{
			//Thread (connection) is still active
			newThreadPool.push_back(m_threadPool.at(i));
			continue;
		}

		//Thread (connection) is no longer active, remove it and remove it from the thread pool
		CloseClientConnection(std::get<0>(m_threadPool.at(i)), std::get<1>(m_threadPool.at(i)), threadRunning);
	}

	m_threadPool = newThreadPool;
}

void SigmaTcpServer::SetDebugPrint(bool enable)
{
	m_debugPrint = enable;
}

void SigmaTcpServer::Stop()
{ 
	if (!m_serverRunning)
	{
		//Server is not running, nothing to stop
		return;
	}

	//Close all active client connections
	for (unsigned int i = 0; i < m_threadPool.size(); i++)
	{
		CloseClientConnection(std::get<0>(m_threadPool.at(i)), std::get<1>(m_threadPool.at(i)), std::get<2>(m_threadPool.at(i)));
	}

	//All connections have been shutdown and closed, clear the thread pool
	m_threadPool.clear();

	//Shutdown the server socket
	m_serverRunning = false;
	if (m_socketFd != -1)
	{
		shutdown(m_socketFd, SHUT_RDWR);
		close(m_socketFd);
	} 	
}
