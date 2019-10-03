#!/bin/bash
# Spotifyd installer for Beocreate 2

cd /tmp || exit
wget https://github.com/Spotifyd/spotifyd/releases/download/v0.2.17/spotifyd-2019-09-29-armv6-slim.zip
unzip spotifyd-2019-09-29-armv6-slim.zip
rm spotifyd-2019-09-29-armv6-slim.zip
mkdir -p /opt/spotifyd
mv spotifyd /opt/spotifyd

echo "[Unit]
Description=Spotify Connect
After=network-online.target
After=sound.target
[Service]
Type=idle
User=pi
ExecStart=/opt/spotifyd/spotifyd --no-daemon
Restart=always
RestartSec=10
StartLimitInterval=30
StartLimitBurst=20
[Install]
WantedBy=multi-user.target" > spotify.service
		
		PRODUCTNAME="$(awk -F= '/PRETTY/ {print $2}' /etc/machine-info)"
		
		echo "[global]
backend = alsa
mixer = DSPVolume
volume-control = alsa # or softvol
bitrate = 320
device_name = ${PRODUCTNAME}" > spotifyd.conf

		cp spotifyd.conf /etc/spotifyd.conf
		cp spotify.service /lib/systemd/system/spotify.service
		systemctl daemon-reload
		systemctl enable spotify.service
		systemctl restart spotify.service
exit $?