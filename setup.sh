#!/bin/bash
# Install dependencies
pip install -r c:\AIQCS\backend\requirements.txt

# Database migration
alembic upgrade head

# Configure environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/mydatabase"
export SECRET_KEY="$(openssl rand -base64 32)"

# VS Code extensions
code --install-extension ms-python.python
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode-remote.remote-containers