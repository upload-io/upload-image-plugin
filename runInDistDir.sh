#!/usr/bin/env bash

# Create a predictable environment :)
set -e
cd "$(dirname "$0")"
cd dist

eval $@
