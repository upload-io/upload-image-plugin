#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
cd ../..

. ./aws/trainer/helpers/get_ip_address.sh

ssh ec2-user@${PUBLIC_IP_ADDRESS}
