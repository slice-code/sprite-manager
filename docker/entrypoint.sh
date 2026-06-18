#!/bin/sh
set -e

node dist-server/index.js &
exec nginx -g 'daemon off;'
