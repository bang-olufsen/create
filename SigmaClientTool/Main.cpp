#include "SigmaTcpClient.h"
#include <iostream>
#include <stdio.h>
#include <string.h>
#include <stdlib.h> 

int main(int argc, char* argv[])
{

	if (argc < 4) {
		std::cout << "Usage: SigmaClientTool <IP> <r,w> <address> <length> (<byte0> <byte1> ...)" << std::endl;
		return 0;
	}


	SigmaTcpClient tcpClient;
	std::cout << "Initializing connection to " << argv[1] << std::endl; 
	tcpClient.InitializeConnection(argv[1]);

	if (strcmp(argv[2], "r") == 0)
	{
		std::cout << "Reading " << argv[4] << " bytes from " << argv[3] << std::endl;

		SigmaReadResponse& resp = tcpClient.ReadMemory((uint16_t) strtol(argv[3],nullptr, 0), (uint16_t) strtol(argv[4], nullptr, 0));
		printf("0: ");
		for (int i = 0; i < resp.length; i++)
		{
			printf("0x%02x", resp.data[i]);
			(i % 12 == 0 && i != 0) ? printf("\n%i: ", i) : printf(" ");
		}
		printf("\n");
	}
	else
	{
		if (argc <= 5)
		{
			std::cout << "Missing data to write" << std::endl;
			return 0;
		}

		uint16_t bytesToWrite = (uint16_t) (argc - 5);
		uint8_t* dataPtr = (uint8_t*) malloc(bytesToWrite);
		for (int i = 0; i < bytesToWrite; i++)
		{
			dataPtr[i] = strtol(argv[5 + 1], nullptr, 0);
		}

		std::cout << "Writing " << bytesToWrite << " bytes to " << (uint16_t)strtol(argv[3], nullptr, 0) << std::endl;
		tcpClient.WriteMemory((uint16_t) strtol(argv[3], nullptr, 0), bytesToWrite, dataPtr);

		free(dataPtr);
	}

	return 0;
}