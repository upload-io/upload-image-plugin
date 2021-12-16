#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

AMI=ami-029c64b3c205e6cce
INSTANCE_TYPE=t4g.medium

if [[ -z "${SSH_ACCESS_SECURITY_GROUP}" ]]; then
	echo "Please export the env var 'SSH_ACCESS_SECURITY_GROUP' before running this script."
	exit 1
fi

APP_NAME=upload-image-plugin-memory-estimator
KEY_PAIR_NAME=upload-admin

echo
echo "Deploying new '${INSTANCE_TYPE}' EC2 instance..."

INSTANCE_ID=$(aws ec2 run-instances \
  --count 1 \
  --image-id $AMI \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_PAIR_NAME \
  --security-group-ids $SSH_ACCESS_SECURITY_GROUP \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${APP_NAME}}]" \
  --output text \
  --query 'Instances[*].InstanceId')

echo "Waiting for EC2 health checks..."

aws ec2 wait instance-status-ok \
  --instance-ids ${INSTANCE_ID}

echo "Getting instance IP address..."

PUBLIC_IP_ADDRESS=$(aws ec2 describe-instances \
  --instance-ids ${INSTANCE_ID} \
  --output text \
  --query 'Reservations[*].Instances[*].PublicIpAddress')

echo ""
echo "EC2 RUNNING:"
echo ""
echo "    ssh ec2-user@${PUBLIC_IP_ADDRESS}"
echo ""

./deploy_existing.sh
