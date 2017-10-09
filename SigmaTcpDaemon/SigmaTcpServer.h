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

#pragma once

#include "HwCommunicationIF.h"
#include "EepromHandler.h"
#include <vector>
#include <tuple>
#include <thread>
#include <atomic>

//! @class SigmaTcpServer
//! @brief class implements a simple TCP server for communicating with Sigma Studio. Supports up to 10 simultaneous connections.
class SigmaTcpServer {
public:
	SigmaTcpServer();
	~SigmaTcpServer();
	
	//!@brief Initializes the class with the required initialization data. Does not start the server!
	//!@param port The port number to use for the server instance
	//!@param hwCommunicationIF The hardware interface to use for reading/writing data to/from DSP
	void Initialize(int port, HwCommunicationIF* hwCommunicationIF);

	//!@brief Starts the TCP server. This is a blocking call that will create and bind the socket and
    //! start listening for incoming connections.
	void Start();

	//!@brief Stopes the TCP server if it is running, otherwise just returns.
	void Stop();

private:
	//!@brief Updates the thread pool cache and removes all references to threads that have already exited
	void CleanThreadPool();

	//!@brief Close a client connection handle
	void CloseClientConnection(std::thread* connectionThread, int fileDescriptor, std::atomic_bool* threadStatus);

	int m_portNumber;
	HwCommunicationIF* m_hwCommIf;
	std::vector<std::tuple<std::thread*, int, std::atomic_bool*>> m_threadPool;
	const unsigned int m_MaxNumClients = 10;
	bool m_serverRunning = false;
	int m_socketFd = -1;
};