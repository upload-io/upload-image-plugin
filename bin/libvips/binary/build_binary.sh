#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

tar xf vips-8.12.2.tar.gz
cd vips-8.12.2
./configure
