# Seed data

Put `*.sql` files here. `pnpm dev:seed` runs them in filename order against the local `parts_builder` database. Files must be safe to run more than once (`INSERT ... ON CONFLICT DO NOTHING`). Tables arrive with the first migrations, so this folder is empty for now.
