import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    try {
      await this.applyConstraints();
    } catch (e) {
      console.warn("Prisma constraints skipped:", (e as Error).message);
    }
  }

  private async applyConstraints() {
    await this.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active_per_seat
      ON sessions ("seatId") WHERE status IN ('ACTIVE', 'PAUSED');
    `);
    await this.$executeRawUnsafe(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS period tstzrange;
    `);
    await this.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION arenaos_bookings_set_period()
      RETURNS trigger AS $$
      BEGIN
        NEW.period := tstzrange(NEW."startsAt", NEW."endsAt", '[)');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await this.$executeRawUnsafe(`DROP TRIGGER IF EXISTS bookings_set_period ON bookings`);
    await this.$executeRawUnsafe(`
      CREATE TRIGGER bookings_set_period
      BEFORE INSERT OR UPDATE OF "startsAt", "endsAt" ON bookings
      FOR EACH ROW EXECUTE FUNCTION arenaos_bookings_set_period()
    `);
    await this.$executeRawUnsafe(`UPDATE bookings SET period = tstzrange("startsAt", "endsAt", '[)') WHERE period IS NULL`);
    await this.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'bookings_seat_period_excl'
        ) THEN
          ALTER TABLE bookings ADD CONSTRAINT bookings_seat_period_excl
            EXCLUDE USING gist ("seatId" WITH =, period WITH &&)
            WHERE (status IN ('PENDING', 'CONFIRMED'));
        END IF;
      END $$;
    `);
  }
}
