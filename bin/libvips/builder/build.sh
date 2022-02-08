#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

. ../.env

docker build --platform ${PLATFORM} -t ${DOCKER_IMAGE} .

docker push ${DOCKER_IMAGE}
