DESTDIR=/usr/local

CFLAGS := -Wno-implicit-function-declaration

sigma_tcp: i2c.c regmap.c spi.c

install:
	install -d $(DESTDIR)/bin
	install sigma_tcp $(DESTDIR)/bin

clean:
	rm -rf sigma_tcp *.o
