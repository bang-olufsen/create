#include "SigmaTcpServer.h"
#include "SpiCommunication.h"
#include <iostream>
#include <exception>

int main()
{
	SigmaTcpServer tcpServer;
	SpiCommunication spiCommIf;

	try
	{
		spiCommIf.Initialize("/dev/spidev0.0");
	}
	catch (std::exception& e)
	{
		std::cout << "Error initializing SPI device: " << e.what() << '\n';
	}

	try
	{
		tcpServer.Initialize(8086, &spiCommIf);
	}
	catch (std::exception& e)
	{
		std::cout << "Error initializing TCP server: " << e.what() << '\n';
	}

	try
	{
		tcpServer.Start();
	}
	catch (std::exception& e)
	{
		std::cout << "Error starting TCP server: " << e.what() << '\n';
	}

	return 0;
}