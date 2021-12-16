#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
cd ../..

. ./aws/trainer/helpers/get_ip_address.sh

scp "ec2-user@${PUBLIC_IP_ADDRESS}://home/ec2-user/dist-aws/dist-trainer/samples-full-*" trainer-prod-results
