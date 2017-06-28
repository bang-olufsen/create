/**
 * Copyright (C) 2012 Analog Devices, Inc.
 *
 * THIS SOFTWARE IS PROVIDED BY ANALOG DEVICES "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, NON-INFRINGEMENT,
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *
 **/

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

#include "sigma_tcp.h"

#define CONNECTION_BUFFER_SIZE 256 * 1024

static void addr_to_str(const struct sockaddr *sa, char *s, size_t maxlen)
{
	switch(sa->sa_family) {
	case AF_INET:
		inet_ntop(AF_INET, &(((struct sockaddr_in *)sa)->sin_addr),
				s, maxlen);
		break;
	case AF_INET6:
		inet_ntop(AF_INET6, &(((struct sockaddr_in6 *)sa)->sin6_addr),
				s, maxlen);
	break;
	default:
		strncpy(s, "Unkown", maxlen);
	}
}

static int show_addrs(int sck)
{
	char buf[256];
	char ip[INET6_ADDRSTRLEN];
	struct ifconf ifc;
	struct ifreq *ifr;
	unsigned int i, n;
	int ret;

	ifc.ifc_len = sizeof(buf);
	ifc.ifc_buf = buf;
	ret = ioctl(sck, SIOCGIFCONF, &ifc);
	if (ret < 0) {
		perror("ioctl(SIOCGIFCONF)");
		return 1;
	}

	ifr = ifc.ifc_req;
	n = ifc.ifc_len / sizeof(struct ifreq);

	printf("IP addresses:\n");

	for (i = 0; i < n; i++) {
		struct sockaddr *addr = &ifr[i].ifr_addr;

		if (strcmp(ifr[i].ifr_name, "lo") == 0)
			continue;

		addr_to_str(addr, ip, INET6_ADDRSTRLEN);
		printf("%s: %s\n", (char*) &ifr[i].ifr_name, ip);
	}

	return 0;
}

#define COMMAND_READ 0x0a
#define COMMAND_WRITE 0x0b

static uint8_t debug_data[256];

static int debug_read(unsigned int addr, unsigned int len, uint8_t *data)
{
	if (addr < 0x4000 || addr + len > 0x4100) {
		memset(data, 0x00, len);
		return 0;
	}

	printf("read: %.2x %d\n", addr, len);

	addr -= 0x4000;
	memcpy(data, debug_data + addr, len);

	return 0;
}

static int debug_write(unsigned int addr, unsigned int len, const uint8_t *data)
{
	if (addr < 0x4000 || addr + len > 0x4100)
		return 0;

	printf("write: %.2x %d\n", addr, len);

	addr -= 0x4000;
	memcpy(debug_data + addr, data, len);

	return 0;
}

static const struct backend_ops debug_backend_ops = {
	.read = debug_read,
	.write = debug_write,
};

static const struct backend_ops *backend_ops = &debug_backend_ops;

static void *get_in_addr(struct sockaddr *sa)
{
    if (sa->sa_family == AF_INET)
		return &(((struct sockaddr_in*)sa)->sin_addr);

	return &(((struct sockaddr_in6*)sa)->sin6_addr);
}

static void handle_connection(int fd)
{
	uint8_t buf[CONNECTION_BUFFER_SIZE] = {0};
	uint8_t *command_ptr;
	unsigned int len;
	unsigned int addr;
	int rx_byte_count, i, remaining_bytes, command_size;
	char command;

	const int byte_size_cmd = 14;

	rx_byte_count = 0;
	memset(buf, 0, CONNECTION_BUFFER_SIZE );

	command_ptr = &buf[0];
	remaining_bytes = 0;

	while (true) 
	{
		if(remaining_bytes > 0)
		{
			printf("\nMoving command data, remaining bytes: %i\n", remaining_bytes);
			memmove(&buf[0], command_ptr, remaining_bytes);
		}
		rx_byte_count = read(fd, buf + remaining_bytes, CONNECTION_BUFFER_SIZE - remaining_bytes);
		if (rx_byte_count <= 0)
			break;

		remaining_bytes += rx_byte_count;
		command_ptr = &buf[0];
		
		while (remaining_bytes >= byte_size_cmd) 
		{
			command = command_ptr[0];

			if (command == COMMAND_READ) {

				len  = (command_ptr[8]  << 8) | command_ptr[9];
				addr = (command_ptr[10] << 8) | command_ptr[11];

				printf("Read %i bytes from 0x%04x\n", len, addr);

				if(len > 0)
				{
					const int readDataOffset = 14;
					uint8_t* read_buf = (uint8_t*) malloc(len + readDataOffset);

					read_buf[0] = COMMAND_WRITE;
					read_buf[1] = command_ptr[1];
					read_buf[2] = command_ptr[2];
					read_buf[3] = command_ptr[3];
					read_buf[4] = command_ptr[4];
					read_buf[5] = command_ptr[5];
					read_buf[6] = command_ptr[6];
					read_buf[7] = command_ptr[7];
					read_buf[8] = command_ptr[8];
					read_buf[9] = command_ptr[9];
					read_buf[10] = command_ptr[10];
					read_buf[11] = command_ptr[11];
					read_buf[12] = 0x00;
					read_buf[13] = 0x00;

					backend_ops->read(addr, len, &read_buf[readDataOffset]);
					
					printf("Read: ");
					for(i=0; i<len; i++)
					{
						printf("%02x ", read_buf[i + readDataOffset]);
					}

					printf("\n");
		
					write(fd, read_buf, len + readDataOffset);
					free(read_buf);
				}

				remaining_bytes -= byte_size_cmd;
				command_ptr += byte_size_cmd;
			} else {
				len  = (command_ptr[10] << 8) | command_ptr[11];
				addr = (command_ptr[12] << 8) | command_ptr[13];

				printf("Write %i bytes to 0x%04x\n", len, addr);
				
				if(remaining_bytes < byte_size_cmd + len)
				{
					break;
				}
	
				backend_ops->write(addr, len, command_ptr + byte_size_cmd);
				remaining_bytes -= (len + byte_size_cmd);
				command_ptr += byte_size_cmd + len;
			}			
		}
	}
}

int main(int argc, char *argv[])
{
    int sockfd, new_fd;
	struct addrinfo hints, *servinfo, *p;
    struct sockaddr_storage their_addr;
    socklen_t sin_size;
    struct sigaction sa;
    int reuse = 1;
    char s[INET6_ADDRSTRLEN];
    int ret;

	if (argc >= 2) {
		if (strcmp(argv[1], "debug") == 0)
			backend_ops = &debug_backend_ops;
		else if (strcmp(argv[1], "i2c") == 0)
			backend_ops = &i2c_backend_ops;
		else if (strcmp(argv[1], "regmap") == 0)
			backend_ops = &regmap_backend_ops;
		else if (strcmp(argv[1], "spi") == 0)
			backend_ops = &spi_backend_ops;
		else {
			printf("Usage: %s <backend> <backend arg0> ...\n"
				   "Available backends: debug, i2c, regmap, spi\n", argv[0]);
			exit(0);
		}

		printf("Using %s backend\n", argv[1]);
	}

	if (backend_ops->open) {
		ret = backend_ops->open(argc, argv);
		if (ret)
			exit(1);
	}

    memset(&hints, 0, sizeof hints);
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_flags = AI_PASSIVE;

	ret = getaddrinfo(NULL, "8086", &hints, &servinfo);
    if (ret != 0) {
        fprintf(stderr, "getaddrinfo: %s\n", gai_strerror(ret));
        return 1;
    }

    for (p = servinfo; p != NULL; p = p->ai_next) {
        if ((sockfd = socket(p->ai_family, p->ai_socktype,
                p->ai_protocol)) == -1) {
            perror("server: socket");
            continue;
        }

        if (setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &reuse,
                sizeof(int)) == -1) {
            perror("setsockopt");
            exit(1);
        }

        if (bind(sockfd, p->ai_addr, p->ai_addrlen) == -1) {
            close(sockfd);
            perror("server: bind");
            continue;
        }

        break;
    }

    if (p == NULL)  {
        fprintf(stderr, "Failed to bind\n");
        return 2;
    }

    freeaddrinfo(servinfo);

    if (listen(sockfd, 0) == -1) {
        perror("listen");
        exit(1);
    }

    printf("Waiting for connections...\n");
	show_addrs(sockfd);

    while (true) {
        sin_size = sizeof their_addr;
        new_fd = accept(sockfd, (struct sockaddr *)&their_addr, &sin_size);
        if (new_fd == -1) {
            perror("accept");
            continue;
        }

        inet_ntop(their_addr.ss_family,
            get_in_addr((struct sockaddr *)&their_addr),
            s, sizeof s);

        printf("New connection from %s\n", s);
		handle_connection(new_fd);
        printf("Connection closed\n");
    }

    return 0;
}
