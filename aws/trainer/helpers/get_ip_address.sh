#!/usr/bin/env bash

APP_NAME=upload-image-plugin-memory-estimator

PUBLIC_IP_ADDRESS=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${APP_NAME}" \
  --output text \
  --query 'Reservations[*].Instances[*].PublicIpAddress')

if (( $(grep -c . <<<"$PUBLIC_IP_ADDRESS") > 1 )); then
  echo "ERROR: Many EC2 instances running for ${APP_NAME}... aborting deploy! (We don't want multiple running services...)"
  exit 1
fi

if (( $(grep -c . <<<"$PUBLIC_IP_ADDRESS") == 0 )); then
  echo "ERROR: No EC2 instances running for ${APP_NAME}... aborting deploy!"
  exit 1
fi
