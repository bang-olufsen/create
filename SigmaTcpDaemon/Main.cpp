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
#include "SpiCommunication.h"
#include "EepromHandler.h"
#include <iostream>
#include <exception>

int main(int argc, char* argv[])
{
 	SigmaTcpServer tcpServer;
	SpiCommunication spiCommIf;

	tcpServer.SetDebugPrint(strcmp(argv[1], "-d") == 0);

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