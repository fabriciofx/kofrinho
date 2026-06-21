#!/bin/bash

REMOTE=fbc@mandacaru.org
DIR=/var/www/kofrinho

ssh -T $REMOTE << 'EOF'
  DIR=/var/www/kofrinho

  if [ ! -d "$DIR" ]; then
    echo -n "Directory $DIR does not exist. Creating it... "
    mkdir -p "$DIR"
    chmod 755 "$DIR"
    echo "done."
  fi

  if [ ! -d "$DIR/frontend" ]; then
    echo -n "Directory $DIR/frontend does not exist. Creating it... "
    mkdir -p "$DIR/frontend"
    chmod 755 "$DIR/frontend"
    echo "done."
  fi

  if [ ! -d "$DIR/backend" ]; then
    echo -n "Directory $DIR/backend does not exist. Creating it... "
    mkdir -p "$DIR/backend"
    chmod 755 "$DIR/backend"
    echo "done."
  fi
EOF

echo -n "Deploying frontend files to $DIR/frontend... "
npm run build && \
  rsync -avz --delete --exclude "node_modules" dist/ "$REMOTE:$DIR/frontend/"
echo "done."

echo -n "Deploying backend files to $DIR/backend... "
npm --prefix=server run build && \
  cp server/package.json server/dist/ && \
  cp server/package-lock.json server/dist/ && \
  rsync -avz --delete --exclude "node_modules" \
    server/dist/ "$REMOTE:$DIR/backend/"
echo "done."

echo -n "Installing backend dependencies in $DIR/backend... "
ssh -T $REMOTE << 'EOF'
  DIR=/var/www/kofrinho
  FNM=/home/fbc/.local/share/fnm/fnm
  "$FNM" exec npm --prefix="$DIR/backend" ci --omit=dev
EOF
echo "done."

echo -n "Setting .env files... "
ssh -T $REMOTE << 'EOF'
  DIR=/var/www/kofrinho
  ln -s "$DIR/.env.backend" "$DIR/backend/.env"
  ln -s "$DIR/.env.frontend" "$DIR/frontend/.env"
EOF
echo "done."
