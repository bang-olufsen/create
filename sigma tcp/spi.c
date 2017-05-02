/**
 * Copyright (C) 2017 Bang & Olufsen.
 *
 **/

#include <fcntl.h>
#include <stdio.h>
#include <error.h>
#include <string.h>

#include <stdint.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <getopt.h>
#include <fcntl.h>
#include <sys/ioctl.h>

#include <linux/spi/spidev.h>
#include <linux/types.h>
#include "sigma_tcp.h"

#define SPI_WRITE_CMD_HEADER_VALUE 0x00
#define SPI_READ_CMD_HEADER_VALUE 0x01
#define MAX_BLOCK_WRITE_SIZE 512

static int spi_fd; 
static struct spi_ioc_transfer xfer[2];
static char read_cmd_buf[3] = {0};
static char write_buf[MAX_BLOCK_WRITE_SIZE] = {0};

static int spi_open(int argc, char *argv[])
{
	int ret;
	char *endp;
    unsigned char mode, lsb, bits;
    unsigned int speed=250000;

	if (argc < 3) {
		fprintf(stderr, "spi: Usage %s spi <spi-dev>\n", argv[0]);
		return 1;
	}

	spi_fd = open(argv[2], O_RDWR);

	if (spi_fd < 0) {
		perror("spi: Failed to open spi device");
		return 1;
	}

    if (ioctl(spi_fd , SPI_IOC_RD_MODE, &mode) < 0)
    {
        perror("SPI rd_mode");
        return 1;
    }

    if (ioctl(spi_fd , SPI_IOC_RD_LSB_FIRST, &lsb) < 0)
    {
        perror("SPI rd_lsb_fist");
        return 1;
    }
      
        
    if (ioctl(spi_fd , SPI_IOC_RD_BITS_PER_WORD, &bits) < 0) 
    {
        perror("SPI bits_per_word");
        return 1;
    }
    
    if (ioctl(spi_fd , SPI_IOC_RD_MAX_SPEED_HZ, &speed) < 0) 
    {
        perror("SPI max_speed_hz");
        return 1;
    }
     
    printf("%s: spi mode %d, %d bits %sper word, %d Hz max\n",argv[2], mode, bits, lsb ? "(lsb first) " : "", speed);
 
    xfer[0].len = 3; /* Length of  command to write*/
    xfer[0].cs_change = 0; /* Keep CS activated */
    xfer[0].delay_usecs = 0; //delay in us
    xfer[0].speed_hz = 100000; //speed
    xfer[0].bits_per_word = 8; // bites per word 8
 
    xfer[1].len = 2; /* Length of Data to read */
    xfer[1].cs_change = 0; /* Keep CS activated */
    xfer[1].delay_usecs = 0;
    xfer[1].speed_hz = 100000;
    xfer[1].bits_per_word = 8;

	printf("spi: Initalized for device %s\n", argv[2]);

	return 0;
}

static int spi_read(unsigned int addr, unsigned int len, uint8_t *data)
{
	int status; 

    read_cmd_buf[0] = SPI_READ_CMD_HEADER_VALUE;
    read_cmd_buf[1] = addr >> 8;
    read_cmd_buf[2] = addr & 0xFF;
    xfer[0].tx_buf = (unsigned long)read_cmd_buf;
    xfer[0].len = 3; // Length of  command to write
    xfer[1].rx_buf = (unsigned long) data;
    xfer[1].len = len; //Length of Data to read 
    status = ioctl(spi_fd, SPI_IOC_MESSAGE(2), xfer);
    if (status < 0) {
        perror("SPI_IOC_MESSAGE READ");
        return 0;
    }

    return status;
}

static int spi_write(unsigned int addr, unsigned int len, const uint8_t *data)
{
    int status,i,loop_count, curent_block_size;

    loop_count = len / MAX_BLOCK_WRITE_SIZE;

    for(i = 0; i <= loop_count; i++)
    {
        addr += (i*MAX_BLOCK_WRITE_SIZE);
        write_buf[0] = SPI_WRITE_CMD_HEADER_VALUE;
        write_buf[1] = addr >> 8;
        write_buf[2] = addr & 0xFF;

        if(i == loop_count) {
            curent_block_size = len % MAX_BLOCK_WRITE_SIZE;
        }
        else {
            curent_block_size = MAX_BLOCK_WRITE_SIZE;
        }

        if(curent_block_size == 0)
        {
            //We are done
            break;
        }

        printf("Writing %i bytes to 0x%04x\n",curent_block_size, addr );

        memcpy(&write_buf[3], data + (i*MAX_BLOCK_WRITE_SIZE), curent_block_size );

        xfer[0].tx_buf = (unsigned long)write_buf;
        xfer[0].len = curent_block_size+3; // Length of  command to write
        status = ioctl(spi_fd, SPI_IOC_MESSAGE(1), xfer);

        if (status < 0){
            perror("SPI_IOC_MESSAGE WRITE");
            return 1;
        }
    }
}

const struct backend_ops spi_backend_ops = {
	.open = spi_open,
	.read = spi_read,
	.write = spi_write,
};
