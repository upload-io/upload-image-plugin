#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
cd ../..

. ./aws/trainer/helpers/get_ip_address.sh

# Make 'dist-aws'
rm -rf dist-aws
mkdir -p dist-aws/.bin/image-magick
cp -r dist-trainer dist-aws/dist-trainer
rm dist-aws/dist-trainer/samples-full-*

if [[ -z "${CODE_ONLY}" ]]; then
  cp -r .bin/image-magick/result dist-aws/.bin/image-magick
fi

cp -r aws/trainer/install dist-aws/install

echo "Copying install files to EC2 instance ($PUBLIC_IP_ADDRESS)..."
echo

# Copy 'dist-aws' to EC2
scp -rp dist-aws ec2-user@${PUBLIC_IP_ADDRESS}://home/ec2-user

echo "Running install script on EC2 instance ($PUBLIC_IP_ADDRESS)..."
echo

# Run 'dist-aws/install/install.sh' on EC2
ssh -T ec2-user@${PUBLIC_IP_ADDRESS} << EOF
  cd /home/ec2-user/dist-aws
  ./install/install.sh
EOF

echo
echo "Deployment successful."
