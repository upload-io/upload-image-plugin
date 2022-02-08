#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

. ../.env

docker run --rm --platform ${PLATFORM} -w=/var/task/build -v $(pwd):/var/task ${DOCKER_IMAGE} /var/task/build_binary.sh
