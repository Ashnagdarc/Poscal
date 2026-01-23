#!/bin/bash

# Poscal PostgreSQL Setup Script for Contabo VPS
# Run this script on your VPS after SSH connection
# Usage: bash setup_postgresql.sh

set -e  # Exit on error

echo "================================="
echo "Poscal PostgreSQL Setup"
echo "================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Database configuration
DB_NAME="poscal_db"
DB_USER="poscal_user"
DB_PASSWORD="P0sc@l_2026_Secure!" # Change this to a strong password

echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}Step 2: Adding PostgreSQL repository...${NC}"
# Install required packages
apt install -y wget gnupg2 lsb-release

# Add PostgreSQL repository
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt update

echo -e "${GREEN}✓ PostgreSQL repository added${NC}"

echo -e "${YELLOW}Step 3: Installing PostgreSQL 15...${NC}"
# Install PostgreSQL
apt install -y postgresql-15 postgresql-contrib-15

echo -e "${GREEN}✓ PostgreSQL 15 installed${NC}"

echo -e "${YELLOW}Step 4: Starting PostgreSQL service...${NC}"
systemctl start postgresql
systemctl enable postgresql

echo -e "${GREEN}✓ PostgreSQL service started and enabled${NC}"

echo -e "${YELLOW}Step 5: Creating database and user...${NC}"

# Create database and user
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE ${DB_NAME};

-- Create user with password
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';

-- Grant all privileges on database
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Grant schema privileges
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};

-- Show databases
\l

-- Quit
\q
EOF

echo -e "${GREEN}✓ Database '${DB_NAME}' and user '${DB_USER}' created${NC}"

echo -e "${YELLOW}Step 6: Configuring PostgreSQL for remote access...${NC}"

# Backup original config
cp /etc/postgresql/15/main/postgresql.conf /etc/postgresql/15/main/postgresql.conf.backup
cp /etc/postgresql/15/main/pg_hba.conf /etc/postgresql/15/main/pg_hba.conf.backup

# Configure PostgreSQL to listen on all addresses
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/15/main/postgresql.conf

# Allow remote connections (add to pg_hba.conf)
echo "" >> /etc/postgresql/15/main/pg_hba.conf
echo "# Allow remote connections from anywhere (for development)" >> /etc/postgresql/15/main/pg_hba.conf
echo "host    ${DB_NAME}    ${DB_USER}    0.0.0.0/0    md5" >> /etc/postgresql/15/main/pg_hba.conf

echo -e "${GREEN}✓ PostgreSQL configured for remote access${NC}"

echo -e "${YELLOW}Step 7: Restarting PostgreSQL...${NC}"
systemctl restart postgresql

echo -e "${GREEN}✓ PostgreSQL restarted${NC}"

echo -e "${YELLOW}Step 8: Checking PostgreSQL status...${NC}"
systemctl status postgresql --no-pager

echo ""
echo "================================="
echo -e "${GREEN}PostgreSQL Setup Complete!${NC}"
echo "================================="
echo ""
echo "Database Configuration:"
echo "  Host: 62.171.136.178"
echo "  Port: 5432"
echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"
echo "  Password: ${DB_PASSWORD}"
echo ""
echo "Connection String:"
echo "  postgresql://${DB_USER}:${DB_PASSWORD}@62.171.136.178:5432/${DB_NAME}"
echo ""
echo -e "${YELLOW}IMPORTANT: Update this password in your .env file!${NC}"
echo ""
echo "Next Steps:"
echo "  1. Update backend/.env with the connection string above"
echo "  2. Run the schema migration from your local machine"
echo "  3. Test the connection: psql -h 62.171.136.178 -U ${DB_USER} -d ${DB_NAME}"
echo ""
