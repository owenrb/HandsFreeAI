#!/bin/sh
# This script generates the env.js file at runtime from environment variables
# and handles missing assets like favicon.ico.

echo "window.REALTIME_BFF_URL = \"$REALTIME_BFF_URL\";" > /usr/share/nginx/html/env.js

# Fallback for favicon.ico if it doesn't exist
if [ ! -f /usr/share/nginx/html/favicon.ico ] && [ -f /usr/share/nginx/html/favicon.svg ]; then
  cp /usr/share/nginx/html/favicon.svg /usr/share/nginx/html/favicon.ico
fi

# Execute the original command (nginx)
exec "$@"
