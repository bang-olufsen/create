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
#include <iostream>
#include <stdio.h>
#include <string.h>
#include <stdlib.h> 

void PrintUsage()
{
	std::cout << "Usage:" << std::endl << "Read: SigmaClientTool [target IP] [read_int|read_dec|read_reg] [address] [length] (for read_reg only)" \
		<< std::endl << "Write value: SigmaClientTool [target IP] [write_val] [address] [value] (single int or decimal value)" \
		<< std::endl << "Write register: SigmaClientTool [target IP] [write_reg] [address] [length] [value1 value2 value3 ...] (each value is 1 bytes in hex format 0xXX)" <<std::endl;
}

int main(int argc, char* argv[])
{

	if (argc < 4) {
		PrintUsage();
		return 0;
	}

	SigmaTcpClient tcpClient;
	std::cout << "Initializing connection to " << argv[1] << std::endl; 
	tcpClient.InitializeConnection(argv[1]);

	if (strcmp(argv[2], "read_reg") == 0)
	{
		if (argc < 5) {
			PrintUsage();
			return 0;
		}

		std::cout << "Reading " << argv[4] << " bytes from " << argv[3] << std::endl;

		SigmaReadResponse& resp = tcpClient.ReadMemory((uint16_t)strtol(argv[3], nullptr, 0), (uint16_t)strtol(argv[4], nullptr, 0));
		printf("0: ");
		for (int i = 0; i < resp.length; i++)
		{
			printf("0x%02x", resp.data[i]);
			(i % 12 == 0 && i != 0) ? printf("\n%i: ", i) : printf(" ");
		}
		printf("\n");
	}
	else if (strcmp(argv[2], "read_int") == 0 || strcmp(argv[2], "read_dec") == 0)
	{
		std::cout << "Reading value from " << argv[3] << std::endl;

		if (strcmp(argv[2], "read_int") == 0)
		{
			int readValue = tcpClient.ReadInteger((uint16_t)strtol(argv[3], nullptr, 0));
			std::cout << readValue << std::endl;
		}
		else
		{
			double readValue = tcpClient.ReadDecimal((uint16_t)strtol(argv[3], nullptr, 0));
			std::cout << readValue << std::endl;
		}
	}
	else if (strcmp(argv[2], "write_val") == 0)
	{

		if (argc <= 3)
		{
			std::cout << "Missing value to write" << std::endl;
			return 0;
		}

		std::string valueToWriteStr(argv[4]);
		std::size_t foundDot = valueToWriteStr.find('.');
		bool isDecimal = foundDot != std::string::npos;

		if (isDecimal)
		{
			double valueToWrite = std::stod(valueToWriteStr);
			tcpClient.WriteDecimal((uint16_t)strtol(argv[3], nullptr, 0), valueToWrite);
		}
		else
		{
			int valueToWrite = std::stoi(valueToWriteStr);
			tcpClient.WriteInteger((uint16_t)strtol(argv[3], nullptr, 0), valueToWrite);
		}
	}
	else if (strcmp(argv[2], "write_reg") == 0)
	{
		if (argc <= 5)
		{
			std::cout << "Missing data to write" << std::endl;
			return 0;
		}

		uint16_t bytesToWrite = (uint16_t)(argc - 5);
		uint8_t* dataPtr = (uint8_t*)malloc(bytesToWrite);
		for (int i = 0; i < bytesToWrite; i++)
		{
			dataPtr[i] = strtol(argv[5 + i], nullptr, 0);
		}

		std::cout << "Writing " << bytesToWrite << " bytes to " << (uint16_t)strtol(argv[3], nullptr, 0) << std::endl;
		tcpClient.WriteMemory((uint16_t)strtol(argv[3], nullptr, 0), bytesToWrite, dataPtr);

		free(dataPtr);
	}
	else
	{
		std::cout << "Unknown argument" << std::endl;
		PrintUsage();
	}

	return 0;
}