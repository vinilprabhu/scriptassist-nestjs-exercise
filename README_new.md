### Setup Instructions

1. Clone this repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Update the .env file with your database and Redis connection details
   ```
4. Start PostgreSQL and Redis with Docker Compose:
   ```bash
   docker-compose up -d
   ```
   This launches both services in the background using your `docker-compose.yml`.

   Build the TypeScript files to ensure the migrations can be run:
   ```bash
   bun run build
   ```

5. Run database migrations:
   ```bash
   # Option 1: Standard migration (if "No migrations are pending" but tables aren't created)
   bun run migration:run
   
   # Option 2: Force table creation with our custom script
   bun run migration:custom
   ```
   
   Our custom migration script will:
   - Try to run formal migrations first
   - If no migrations are executed, it will directly create the necessary tables
   - It provides detailed logging to help troubleshoot database setup issues

6. Seed the database with initial data:
   ```bash
   bun run seed
   ```

7. Start the development server:
   ```bash
   bun run start:dev
   ```

### Troubleshooting Database Issues

If you continue to have issues with database connections:

1. List running containers:
   ```bash
   docker ps
   ```
   Look for `postgres_taskflow` with `STATUS = Up ...`.

2. View container logs:
   ```bash
   docker logs postgres_taskflow
   ```

3. Connect to Postgres inside the container
   ```bash
   docker exec -it postgres_taskflow psql -U postgres -d taskflow -c "\l"
   ```
   This lists all databases; `taskflow` should be present.

4. Manually create schema if needed
   - Review SQL in `src/database/migrations/`
   - Execute SQL manually in your database:
     ```bash
     docker exec -it postgres_taskflow psql -U postgres -d taskflow
     ```

### Default Users

The seeded database includes two users:

1. Admin User:
   - Email: admin@example.com
   - Password: admin123
   - Role: admin

2. Regular User:
   - Email: user@example.com
   - Password: user123
   - Role: user
