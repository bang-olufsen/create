#!/bin/bash
# Shairport-sync installer for Beocreate 2

apt-get -q -y update
apt-get -q -y upgrade
apt-get -q -y install build-essential git xmltoman
apt-get -q -y install autoconf automake libtool libdaemon-dev libpopt-dev libconfig-dev
apt-get -q -y install libasound2-dev
apt-get -q -y install avahi-daemon libavahi-client-dev
apt-get -q -y install libssl-dev
apt-get -q -y install libsoxr-dev

if [ -d ./shairport-sync ]; then
	rm -rf ./shairport-sync
fi
git clone https://github.com/mikebrady/shairport-sync.git
cd ./shairport-sync || exit
autoreconf -i -f
./configure --sysconfdir=/etc --with-alsa --with-avahi --with-ssl=openssl --with-metadata --with-soxr --with-systemd
make
make install
cd ..
rm -rf ./shairport-sync
if ! [ -d /etc/shairport-sync.conf.by-beocreate.bak ]; then
	cp /etc/shairport-sync.conf /etc/shairport-sync.conf.by-beocreate.bak
	RAWPRODUCTNAME="Beocreate"
	RAWPRODUCTNAME="$(awk -F= '/PRETTY/ {print $2}' /etc/machine-info)"
	case "$RAWPRODUCTNAME" in
	     *\ * )
	           PRODUCTNAME=$RAWPRODUCTNAME
	          ;;
	       *)
	           PRODUCTNAME="\"${RAWPRODUCTNAME}\""
	           ;;
	esac
	echo "general =
	{
		name = ${PRODUCTNAME};
		interpolation = \"soxr\";
		volume_control_profile = \"flat\";
	}
	metadata =
	{
		enabled = \"yes\";
		include_cover_art = \"yes\";
	}
	sessioncontrol =
	{
		allow_session_interruption = \"yes\";
		session_timeout = 10;
	}
	alsa =
	{
		mixer_control_name = \"DSPVolume\";
	}" > /etc/shairport-sync.conf
fi

systemctl enable shairport-sync

rm -rf ./shairport-sync
exit $?