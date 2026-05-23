import { DataSource } from 'typeorm';

const LEGACY_STATUSES = ['pending_review', 'approved', 'denied'];

/**
 * Phase 05 (paid/unpaid refactor) shrinks `receipt_entity.status` from
 * a 3-state enum to a 2-state enum. TypeORM's `synchronize: true` cannot
 * migrate the enum while rows still reference removed values. This helper
 * runs before NestFactory.create() to detect that situation and truncate
 * the table so the subsequent sync succeeds.
 *
 * In production we refuse to truncate; the operator must intervene.
 */
export async function wipeLegacyReceiptStatuses(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'user',
    password: 'password',
    database: 'property_management',
  });

  try {
    await ds.initialize();
  } catch {
    // DB unreachable; let the main bootstrap surface the error.
    return;
  }

  try {
    const rows = await ds.query(
      `SELECT COUNT(*)::int AS count
         FROM receipt_entity
        WHERE status::text = ANY($1)`,
      [LEGACY_STATUSES],
    );
    const count: number = rows?.[0]?.count ?? 0;
    if (count === 0) {
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      console.error(
        `[Phase 05 migration] Detected ${count} receipt(s) with legacy ` +
          `status values (${LEGACY_STATUSES.join('|')}) in production. ` +
          'Refusing to auto-truncate. Manually migrate before redeploying.',
      );
      return;
    }

    console.warn(
      `[Phase 05 migration] Detected ${count} receipt(s) with legacy status ` +
        'values. Truncating receipt_entity to enable enum migration.',
    );
    await ds.query('TRUNCATE TABLE receipt_entity CASCADE');
  } catch {
    // Table or column may not exist yet on first boot — safe to skip.
  } finally {
    await ds.destroy();
  }
}
