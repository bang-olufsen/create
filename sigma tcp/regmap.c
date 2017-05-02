/**
 * Copyright (C) 2012 Analog Devices, Inc.
 *
 * THIS SOFTWARE IS PROVIDED BY ANALOG DEVICES "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, NON-INFRINGEMENT,
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *
 **/

#include <stdio.h>
#include <stdint.h>
#include <string.h>

#include "sigma_tcp.h"

static const char *regmap_file;

static int regmap_open(int argc, char *argv[])
{
	int fd;

	if (argc < 3)
		printf("Usage: %s regmap <regmap file>\n", argv[0]);

	regmap_file = argv[2];

	fd = open(regmap_file, 0);
	if (fd < 0) {
		perror("regmap: Failed to open file");
		return 1;
	}
	close(fd);
	return 0;
}

static int regmap_read(unsigned int addr, unsigned int len, uint8_t *data)
{
	FILE *fd;
	unsigned int raddr = -1;
	unsigned int rvalue = 0;
	unsigned int end_addr;
	int ret;

	fd = fopen(regmap_file, "r");
	if (fd == NULL) {
		perror("regmap: Failed to open file");
		return 1;
	}

	memset(data, 0x00, len);

	end_addr = addr + len;

	while (addr < end_addr) {
		ret = fscanf(fd, "%x: %x\n", &raddr, &rvalue);
		if (ret <= 0 || ret == EOF)
			break;
		if (raddr == addr) {
			*data = rvalue & 0xff;
			addr++;
			data++;
		}
	}
	fclose(fd);

	return 0;
}

static int regmap_write(unsigned int addr, unsigned int len, const uint8_t *data)
{
	return 1;
}

const struct backend_ops regmap_backend_ops = {
	.open = regmap_open,
	.read = regmap_read,
	.write = regmap_write,
};
