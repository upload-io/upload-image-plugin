#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
cd ../..

. ./aws/trainer/helpers/get_ip_address.sh

ssh -T ec2-user@${PUBLIC_IP_ADDRESS} << EOF
  sudo /etc/init.d/${APP_NAME} stop
  sleep 10
  sudo rm /var/log/${APP_NAME}.log
  sudo rm /var/log/${APP_NAME}.err
  sudo /etc/init.d/${APP_NAME} start
EOF
