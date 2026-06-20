#!/bin/bash

DIR=/var/www/kofrinho

if [ ! -d "$DIR" ]; then
  echo -n "Directory $DIR does not exist. Creating it... "
  mkdir -p "$DIR" "$DIR/frontend" "$DIR/backend"
  chmod 755 "$DIR" "$DIR/frontend" "$DIR/backend"
  echo "done."
fi

echo -n "Cleaning up existing files in $DIR/frontend and $DIR/backend... "
rm -rf "$DIR/frontend/"*
rm -rf "$DIR/backend/"*
echo "done."

echo -n "Deploying frontend files to $DIR/frontend... "
npm run build && cp -a dist/. "$DIR/frontend/"
echo "done."

echo -n "Deploying backend files to $DIR/backend... "
cd server && npm run build && cp -a dist/. "$DIR/backend/"
echo "done."
