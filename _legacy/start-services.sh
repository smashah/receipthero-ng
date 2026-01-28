#!/bin/sh

# Start the worker in the background
node worker.js &

# Start the Next.js server
node server.js
