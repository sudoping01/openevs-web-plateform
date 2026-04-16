#!/bin/sh
set -e

mqtt_user="${MQTT_USER}"
mqtt_pass="${MQTT_PASS}"

if [ -z "$mqtt_user" ] || [ -z "$mqtt_pass" ]; then
    echo "ERROR: MQTT credentials not set. Please set MQTT_USER and MQTT_PASS env vars." >&2
    exit 1
fi

mosquitto_passwd -b /mosquitto/config/pwfile "$mqtt_user" "$mqtt_pass"

exec mosquitto -c /mosquitto/config/mosquitto.conf
