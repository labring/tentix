# Server Scripts Documentation

This document explains the utility scripts located in the `server/script/` directory. These scripts are essential for database management, configuration setup, and system initialization.

## 📁 Script Overview

The `server/script/` directory contains the following utility scripts:

```
server/script/
├── getCryptoKey.ts        # Generate encryption keys
├── initDB.ts             # Initialize database with System user and staff
├── migrateStaffList.ts   # Migrate staff data from Feishu
├── resetDB.ts            # Reset database completely
└── seed.ts               # Generate seed data for development
```

## 🔐 getCryptoKey.ts

**Purpose**: Generate secure encryption keys for the application.

### Features
- Generates AES-256 encryption keys
- Exports keys in Base64 format for environment variables
- Validates key generation and import functionality
- Provides formatted output for easy configuration

### Usage
```bash
cd server
bun run script/getCryptoKey.ts
```

### Output
The script generates an encryption key and displays:
- Base64 encoded key string for `ENCRYPTION_KEY` environment variable
- Key technical details (algorithm, type, usages)
- Usage instructions for environment configuration

### Example Output
```
Encryption Key Information:
Base64 Key String (for ENCRYPTION_KEY env variable):
BvAzzxZXIzMefxqoUvKBvjr9McND3TDmS3ffjl4kf4M=

Key Details:
{
  type: "secret",
  algorithm: {
    name: "AES-CBC",
    length: 256,
  },
  extractable: true,
  usages: [ "decrypt", "encrypt" ],
}

Usage Instructions:
Add this key to your environment variables:
ENCRYPTION_KEY="BvAzzxZXIzMefxqoUvKBvjr9McND3TDmS3ffjl4kf4M="
```

## 🏗️ initDB.ts

**Purpose**: Initialize the database with essential system users and staff members.

### Features
- Resets the database schema
- Creates system user (ID: 0) for internal operations
- Creates AI user based on configuration
- Registers staff members from configuration file
- Assigns appropriate roles (admin, agent, technician) based on configuration

### Usage
```bash
cd server
bun run script/initDB.ts
```

### What it does
1. **Database Reset**: Clears all existing data and resets sequences
2. **System User Creation**: Creates a system user for internal operations
3. **AI User Creation**: Creates the AI assistant user from `aiProfile` configuration
4. **Staff Registration**: Imports staff members from configuration and assigns roles
5. **Role Assignment**: Automatically assigns roles based on `admin_ids` and `agents_ids` arrays

### Configuration Dependencies
- `config.*.json` file with `aiProfile`, `staffs`, `admin_ids`, and `agents_ids`
- Valid database connection

## 👥 migrateStaffList.ts

**Purpose**: Automatically fetch and migrate staff information from Feishu (Lark) platform.

### Features
- Fetches department information from Feishu API
- Retrieves staff members for each department
- Updates configuration file with latest staff data
- Maintains department-member relationships
- Provides detailed migration reports

### Usage
```bash
cd server
bun run script/migrateStaffList.ts
```

### Process Flow
1. **Read Configuration**: Loads current configuration file
2. **Feishu Authentication**: Obtains access token using app credentials
3. **Department Fetching**: Retrieves department information based on `department_ids`
4. **Staff Fetching**: Gets staff members for each department
5. **Data Processing**: Formats staff data with avatars, names, and IDs
6. **Configuration Update**: Saves updated configuration to `config.dev.json`

### Output
- Updated `config.dev.json` with latest staff and department information
- Migration report showing department member counts
- Warnings for staff changes (additions/removals)

### Prerequisites
- Valid Feishu app credentials in configuration
- Network access to Feishu API
- Proper department IDs in configuration

## 🗑️ resetDB.ts

**Purpose**: Completely reset the database and regenerate schema.

### Features
- Clears generated code files
- Drops entire database schema
- Regenerates database migrations
- Applies fresh migrations

### Usage
```bash
cd server
bun run script/resetDB.ts
```

### Process Steps
1. **Clear Codegen**: Removes `db/codegen` folder
2. **Generate Schema**: Runs `bun run generate` to create new migrations
3. **Drop Schema**: Completely removes the `tentix` schema from database
4. **Apply Migrations**: Runs `bun run migrate` to recreate schema

### ⚠️ Warning
This script will **permanently delete all data** in the database. Use with extreme caution, it should not be used in a production environment, it should only be used during development.

## 🌱 seed.ts

**Purpose**: Generate realistic seed data for development and testing.

### Features
- Creates comprehensive test data for all database tables
- Generates realistic user profiles, tickets, and interactions
- Creates rich content using TipTap JSON format
- Supports various content types (text, images, code blocks, lists)
- Maintains referential integrity between related data

### Usage
```bash
cd server
bun run seed
```

### Generated Data Types
- **Users**: Various roles (admin, agent, technician, customer)
- **Tickets**: Different statuses, priorities, and categories
- **Ticket History**: Status changes, comments, and interactions
- **Rich Content**: TipTap JSON with paragraphs, images, code blocks, lists
- **Relationships**: Proper associations between users, tickets, and history

### Data Characteristics
- **Realistic Content**: Uses Faker.js for generating believable data
- **Varied Formats**: Multiple content types and formatting options
- **Proper Relationships**: Maintains database constraints and relationships
- **Configurable Volume**: Adjustable data quantities for different testing needs

### Content Generation
The seed script generates rich TipTap JSON content including:
- **Paragraphs**: With various text formatting (bold, italic, underline)
- **Images**: Random images with proper dimensions
- **Code Blocks**: Multi-language code examples
- **Lists**: Both ordered and unordered lists
- **Mixed Content**: Combinations of different content types

## 🚀 Common Usage Patterns

### Initial Setup
```bash
# 1. Generate encryption key
bun run script/getCryptoKey.ts

# 2. Add key to .env.local
echo 'ENCRYPTION_KEY="your-generated-key"' >> .env.local

# 3. Initialize database
bun run script/initDB.ts

# 4. (Optional) Generate seed data for development
bun run seed
```

### Feishu Integration Setup
```bash
# 1. Configure Feishu credentials in config.template.json
# 2. Migrate staff data from Feishu
bun run script/migrateStaffList.ts

# 3. Initialize database with migrated staff
bun run script/initDB.ts
```

### Development Reset
```bash
# Complete database reset and fresh start
bun run script/resetDB.ts
bun run script/initDB.ts
bun run seed
```

## 🔧 Script Dependencies

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `ENCRYPTION_KEY`: Generated encryption key
- `FEISHU_APP_ID`: Feishu application ID (for staff migration)
- `FEISHU_APP_SECRET`: Feishu application secret (for staff migration)

### Required Configuration Files
- `config.dev.json` or `config.prod.json`: Application configuration
- `config.template.json`: Configuration template

### Database Requirements
- PostgreSQL database with proper permissions
- Network connectivity for database operations
- Sufficient storage for seed data (if using seed script)

## 📝 Best Practices

### Development Environment
1. Always use `config.dev.json` for development
2. Run `initDB.ts` after any schema changes
3. Use `seed.ts` to generate test data for feature development
4. Keep encryption keys secure and never commit them to version control

### Production Environment
1. Use `config.prod.json` with production settings
2. Never run `resetDB.ts` in production
3. Backup database before running any migration scripts
4. Test scripts in staging environment first

### Security Considerations
1. Generate unique encryption keys for each environment
2. Store sensitive configuration outside of version control
3. Use environment variables for secrets
4. Regularly rotate encryption keys and API credentials

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check network connectivity

**Feishu API Errors**
- Verify app credentials are valid
- Check department IDs exist
- Ensure proper API permissions

**Migration Failures**
- Check database permissions
- Verify schema exists
- Review migration files for syntax errors

**Seed Data Issues**
- Ensure database is properly initialized
- Check for constraint violations
- Verify foreign key relationships

### Debug Mode
Most scripts support verbose logging. Check the console output for detailed error messages and progress information.

---

**Note**: Always backup your database before running any destructive operations, especially `resetDB.ts` and `seed.ts` scripts. 