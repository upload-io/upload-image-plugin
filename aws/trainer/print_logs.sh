#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
cd ../..

. ./aws/trainer/helpers/get_ip_address.sh

ssh -T ec2-user@${PUBLIC_IP_ADDRESS} << EOF
  cat /var/log/${APP_NAME}.log
  cat /var/log/${APP_NAME}.err
EOF
