#pragma once

#include "HwCommunicationIF.h"

class SigmaTcpServer {
public:
	SigmaTcpServer();
	~SigmaTcpServer();

	void Initialize(int port, HwCommunicationIF* hwCommunicationIF);

	void Start();

	void Stop();

private:
	int m_portNumber;
	HwCommunicationIF* m_hwCommIf;
};