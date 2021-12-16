#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

APP_NAME=upload-image-plugin-memory-estimator

#
# Idempotent install script (i.e. it may be run multiple times, so needs to start by uninstalling first!)
#

echo "Install script running (on EC2)..."

if [[ -f "/etc/init.d/${APP_NAME}" ]]; then
  echo "Stopping ${APP_NAME}..."
  sudo /etc/init.d/${APP_NAME} stop
  sleep 10
  sudo rm /var/log/${APP_NAME}.log
  sudo rm /var/log/${APP_NAME}.err
  sudo rm /home/ec2-user/dist-aws/dist-trainer/samples-full-*
fi

#
# Install NVM.
#
if [[ ! -f /home/ec2-user/.nvm/nvm.sh ]]; then
    echo "Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
fi

echo "Sourcing NVM..."
. /home/ec2-user/.nvm/nvm.sh # We source NVM on every run (since we don't have profiles).

echo "Sourcing Node.js v12..."
nvm install 12

sudo cp ./service.sh /etc/init.d/${APP_NAME}
sudo /etc/init.d/${APP_NAME} start
