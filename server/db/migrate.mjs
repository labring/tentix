import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

async function runMigration() {
  // Prefer DATABASE_URL, fall back to DEV_DATABASE_URL for local/testing
  const databaseUrl = process.env.DATABASE_URL || process.env.DEV_DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or DEV_DATABASE_URL must be provided')
  }

  const isProd = process.env.NODE_ENV === 'production'

  const client = postgres(databaseUrl, {
    max: 1,
    ssl: isProd ? 'require' : undefined,
  })

  const db = drizzle(client)

  try {
    console.info('[drizzle] Migration started')
    await migrate(db, { migrationsFolder: './db/codegen' })
    console.info('[drizzle] Migration completed')
  } catch (error) {
    console.error('[drizzle] Migration failed:', error)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

runMigration().catch((err) => {
  console.error('[drizzle] Migration process error:', err)
  process.exit(1)
});


