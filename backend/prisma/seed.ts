import { PrismaClient, UserRole, SeatType, SeatStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PHONES = {
  superadmin: { old: '+79990000001', next: '+375291000001', email: 'superadmin@rudemir.by' },
  owner: { old: '+79990000002', next: '+375291000002', email: 'owner@rudemir.by' },
  admin: { old: '+79990000003', next: '+375291000003', email: 'admin@rudemir.by' },
  guest: { old: '+79990000004', next: '+375291000004', email: 'guest@rudemir.by' },
};

async function upsertUser(phone: string, email: string, displayName: string, passwordHash: string, role: UserRole) {
  const byNew = await prisma.user.findUnique({ where: { phone } });
  if (byNew) {
    return prisma.user.update({ where: { id: byNew.id }, data: { email, displayName, passwordHash, globalRole: role } });
  }
  return prisma.user.create({
    data: { phone, email, passwordHash, displayName, globalRole: role, locale: 'ru' },
  });
}

async function migratePhone(oldPhone: string, nextPhone: string, email: string) {
  const old = await prisma.user.findUnique({ where: { phone: oldPhone } });
  const taken = await prisma.user.findUnique({ where: { phone: nextPhone } });
  if (old && !taken) {
    await prisma.user.update({ where: { id: old.id }, data: { phone: nextPhone, email } });
  }
}

async function main() {
  const password = await bcrypt.hash('admin123', 10);
  const guestPassword = await bcrypt.hash('guest123', 10);
  const ownerPassword = await bcrypt.hash('owner123', 10);

  for (const p of Object.values(PHONES)) {
    await migratePhone(p.old, p.next, p.email);
  }

  const superadmin = await upsertUser(PHONES.superadmin.next, PHONES.superadmin.email, 'Super Admin', password, UserRole.SUPERADMIN);
  const owner = await upsertUser(PHONES.owner.next, PHONES.owner.email, 'Владелец клуба', ownerPassword, UserRole.GUEST);
  const admin = await upsertUser(PHONES.admin.next, PHONES.admin.email, 'Администратор смены', password, UserRole.GUEST);
  const guest = await upsertUser(PHONES.guest.next, PHONES.guest.email, 'Демо-гость', guestPassword, UserRole.GUEST);
  const techPass = await bcrypt.hash('tech123', 10);
  const supportPass = await bcrypt.hash('support123', 10);
  const cashPass = await bcrypt.hash('cash123', 10);
  const barPass = await bcrypt.hash('bar123', 10);
  const mgrPass = await bcrypt.hash('manager123', 10);
  const tech = await upsertUser('+375291000005', 'tech@rudemir.by', 'Тех. администратор', techPass, UserRole.GUEST);
  const support = await upsertUser('+375291000006', 'support@rudemir.by', 'Поддержка сети', supportPass, UserRole.SUPPORT);
  const cashier = await upsertUser('+375291000007', 'cashier@rudemir.by', 'Кассир', cashPass, UserRole.GUEST);
  const bartender = await upsertUser('+375291000008', 'bar@rudemir.by', 'Бармен', barPass, UserRole.GUEST);
  const manager = await upsertUser('+375291000009', 'manager@rudemir.by', 'Управляющий', mgrPass, UserRole.GUEST);

  await prisma.wallet.upsert({
    where: { userId: guest.id },
    update: { balanceKopecks: 8_000 },
    create: { userId: guest.id, balanceKopecks: 8_000, bonusKopecks: 200 },
  });
  for (const u of [owner, admin, superadmin, tech, support, cashier, bartender, manager]) {
    await prisma.wallet.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, balanceKopecks: 0 },
    });
  }

  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { name: 'RUDEMIR' },
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'RUDEMIR' },
  });

  const minskExisting =
    (await prisma.club.findUnique({ where: { slug: 'rudemir-minsk' } })) ??
    (await prisma.club.findUnique({ where: { slug: 'neon-arena' } }));

  const minsk = minskExisting
    ? await prisma.club.update({
        where: { id: minskExisting.id },
        data: {
          slug: 'rudemir-minsk',
          name: 'RUDEMIR Arena',
          description: 'Киберклуб в центре Минска: 144Hz мониторы, RTX-станции и бар. Сеть RUDEMIR.',
          city: 'Минск',
          address: 'пр-т Независимости, 58',
          lat: 53.9045,
          lng: 27.5615,
          timezone: 'Europe/Minsk',
          amenities: ['wifi', 'bar', 'vr', 'tournament', 'parking'],
          isPublished: true,
        },
      })
    : await prisma.club.create({
        data: {
          organizationId: org.id,
          slug: 'rudemir-minsk',
          name: 'RUDEMIR Arena',
          description: 'Киберклуб в центре Минска: 144Hz мониторы, RTX-станции и бар. Сеть RUDEMIR.',
          city: 'Минск',
          address: 'пр-т Независимости, 58',
          lat: 53.9045,
          lng: 27.5615,
          timezone: 'Europe/Minsk',
          amenities: ['wifi', 'bar', 'vr', 'tournament', 'parking'],
        },
      });

  await prisma.userClubRole.upsert({
    where: { userId_clubId: { userId: owner.id, clubId: minsk.id } },
    update: { role: UserRole.OWNER },
    create: { userId: owner.id, clubId: minsk.id, role: UserRole.OWNER },
  });
  await prisma.userClubRole.upsert({
    where: { userId_clubId: { userId: admin.id, clubId: minsk.id } },
    update: { role: UserRole.CLUB_ADMIN },
    create: { userId: admin.id, clubId: minsk.id, role: UserRole.CLUB_ADMIN },
  });

  const staffSeed: { user: { id: string; phone: string }; role: UserRole; point: string }[] = [
    { user: owner, role: UserRole.OWNER, point: 'Минск' },
    { user: admin, role: UserRole.CLUB_ADMIN, point: 'Минск' },
    { user: tech, role: UserRole.TECH_ADMIN, point: 'Минск' },
    { user: cashier, role: UserRole.CASHIER, point: 'Стойка' },
    { user: bartender, role: UserRole.BARTENDER, point: 'Бар' },
    { user: manager, role: UserRole.MANAGER, point: 'Минск' },
  ];
  for (const s of staffSeed) {
    await prisma.userClubRole.upsert({
      where: { userId_clubId: { userId: s.user.id, clubId: minsk.id } },
      update: { role: s.role },
      create: { userId: s.user.id, clubId: minsk.id, role: s.role },
    });
    await prisma.staffProfile.upsert({
      where: { clubId_userId: { clubId: minsk.id, userId: s.user.id } },
      update: { status: 'ACTIVE', workPoint: s.point, dismissedAt: null },
      create: { clubId: minsk.id, userId: s.user.id, login: s.user.phone, workPoint: s.point, status: 'ACTIVE' },
    });
  }

  const hw = await prisma.hardwareProfile.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      clubId: minsk.id,
      name: 'RTX 4070',
      cpu: 'Ryzen 7 5800X',
      gpu: 'RTX 4070',
      ram: '32 GB',
      monitor: '27" 144Hz',
    },
  });

  let standard = await prisma.zone.findFirst({ where: { clubId: minsk.id, name: 'Standard' } });
  if (!standard) {
    standard = await prisma.zone.create({
      data: { clubId: minsk.id, name: 'Standard', sortOrder: 1, color: '#38bdf8' },
    });
  }
  let vip = await prisma.zone.findFirst({ where: { clubId: minsk.id, name: 'VIP' } });
  if (!vip) {
    vip = await prisma.zone.create({
      data: { clubId: minsk.id, name: 'VIP', sortOrder: 2, color: '#a855f7' },
    });
  }

  const seatsSpec = [
    ...Array.from({ length: 6 }).map((_, i) => ({
      label: `PC-0${i + 1}`,
      zoneId: standard!.id,
      posX: 40 + (i % 3) * 80,
      posY: 40 + Math.floor(i / 3) * 80,
      type: SeatType.PC,
    })),
    { label: 'VIP-01', zoneId: vip!.id, posX: 320, posY: 40, type: SeatType.PC },
    { label: 'VIP-02', zoneId: vip!.id, posX: 400, posY: 40, type: SeatType.CONSOLE },
  ];

  for (const s of seatsSpec) {
    await prisma.seat.upsert({
      where: { clubId_label: { clubId: minsk.id, label: s.label } },
      update: {},
      create: {
        clubId: minsk.id,
        zoneId: s.zoneId,
        hardwareProfileId: hw.id,
        label: s.label,
        type: s.type,
        status: SeatStatus.FREE,
        posX: s.posX,
        posY: s.posY,
      },
    });
  }

  const stdTariff = await prisma.tariff.findFirst({ where: { clubId: minsk.id, name: { in: ['Standard hour', 'Стандарт'] } } });
  if (stdTariff) {
    await prisma.tariff.update({
      where: { id: stdTariff.id },
      data: { name: 'Стандарт', pricePerHourKopecks: 1_200 },
    });
  } else {
    await prisma.tariff.create({
      data: { clubId: minsk.id, zoneId: standard!.id, name: 'Стандарт', pricePerHourKopecks: 1_200, minMinutes: 30 },
    });
  }
  const vipTariff = await prisma.tariff.findFirst({ where: { clubId: minsk.id, name: { in: ['VIP hour', 'VIP'] } } });
  if (vipTariff) {
    await prisma.tariff.update({
      where: { id: vipTariff.id },
      data: { name: 'VIP', pricePerHourKopecks: 1_800 },
    });
  } else {
    await prisma.tariff.create({
      data: { clubId: minsk.id, zoneId: vip!.id, name: 'VIP', pricePerHourKopecks: 1_800, minMinutes: 30 },
    });
  }

  const products = [
    { name: 'Cola 0.5', priceKopecks: 350, category: 'bar' },
    { name: 'Energy drink', priceKopecks: 420, category: 'bar' },
    { name: 'Nachos', priceKopecks: 800, category: 'bar' },
    { name: 'Худи RUDEMIR', priceKopecks: 7_900, category: 'merch' },
  ];
  for (const p of products) {
    const found = await prisma.product.findFirst({ where: { clubId: minsk.id, name: p.name } });
    if (!found) await prisma.product.create({ data: { clubId: minsk.id, ...p } });
    else await prisma.product.update({ where: { id: found.id }, data: { priceKopecks: p.priceKopecks } });
  }

  for (let i = 1; i <= 12; i++) {
    const number = String(i).padStart(2, '0');
    await prisma.locker.upsert({
      where: { clubId_number: { clubId: minsk.id, number } },
      update: {},
      create: { clubId: minsk.id, number },
    });
  }

  const apps = [
    { name: 'Steam', path: 'C:\\Program Files (x86)\\Steam\\steam.exe' },
    { name: 'Discord', path: 'C:\\Users\\Public\\Discord\\Update.exe' },
    { name: 'Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  ];
  for (const a of apps) {
    const found = await prisma.clubApp.findFirst({ where: { clubId: minsk.id, name: a.name } });
    if (!found) await prisma.clubApp.create({ data: { clubId: minsk.id, ...a } });
  }

  await prisma.guestCard.upsert({
    where: { cardNumber: '10000004' },
    update: { userId: guest.id },
    create: {
      userId: guest.id,
      cardNumber: '10000004',
      pinHash: await bcrypt.hash('1234', 10),
    },
  });

  let gomel = await prisma.club.findUnique({ where: { slug: 'rudemir-gomel' } });
  if (!gomel) {
    gomel = await prisma.club.create({
      data: {
        organizationId: org.id,
        slug: 'rudemir-gomel',
        name: 'RUDEMIR Gomel',
        description: 'Филиал RUDEMIR в Гомеле: 4 ПК и консоль-зона.',
        city: 'Гомель',
        address: 'ул. Советская, 18',
        lat: 52.4345,
        lng: 30.9754,
        timezone: 'Europe/Minsk',
        amenities: ['wifi', 'bar'],
      },
    });
    const gz = await prisma.zone.create({ data: { clubId: gomel.id, name: 'Hall', sortOrder: 1 } });
    for (let i = 1; i <= 4; i++) {
      await prisma.seat.create({
        data: {
          clubId: gomel.id,
          zoneId: gz.id,
          label: `PC-0${i}`,
          posX: 40 + ((i - 1) % 2) * 80,
          posY: 40 + Math.floor((i - 1) / 2) * 80,
          type: SeatType.PC,
        },
      });
    }
    await prisma.tariff.create({
      data: { clubId: gomel.id, name: 'Стандарт', pricePerHourKopecks: 1_000, minMinutes: 30 },
    });
    await prisma.userClubRole.upsert({
      where: { userId_clubId: { userId: owner.id, clubId: gomel.id } },
      update: { role: UserRole.OWNER },
      create: { userId: owner.id, clubId: gomel.id, role: UserRole.OWNER },
    });
  }

  await prisma.achievement.upsert({
    where: { code: 'first_session' },
    update: { name: 'Первый фраг', description: 'Завершите первую сессию в RUDEMIR' },
    create: { code: 'first_session', name: 'Первый фраг', description: 'Завершите первую сессию в RUDEMIR' },
  });
  await prisma.achievement.upsert({
    where: { code: 'first_topup' },
    update: { name: 'Первое пополнение', description: 'Пополните баланс через bePaid или ЕРИП' },
    create: { code: 'first_topup', name: 'Первое пополнение', description: 'Пополните баланс через bePaid или ЕРИП' },
  });
  await prisma.achievement.upsert({
    where: { code: 'regular_5' },
    update: { name: 'Свой человек', description: 'Завершите 5 игровых сессий' },
    create: { code: 'regular_5', name: 'Свой человек', description: 'Завершите 5 игровых сессий' },
  });

  await prisma.newsArticle.upsert({
    where: { slug: 'welcome-to-rudemir' },
    update: {
      title: 'RUDEMIR запускает сеть киберклубов в Беларуси',
      excerpt: 'Бронируйте места в Минске и Гомеле, оплата в белорусских рублях.',
      body: 'RUDEMIR — белорусская платформа управления компьютерными клубами: сессии, брони, бар, аналитика. Эквайринг bePaid / ЕРИП.',
    },
    create: {
      slug: 'welcome-to-rudemir',
      title: 'RUDEMIR запускает сеть киберклубов в Беларуси',
      excerpt: 'Бронируйте места в Минске и Гомеле, оплата в белорусских рублях.',
      body: 'RUDEMIR — белорусская платформа управления компьютерными клубами: сессии, брони, бар, аналитика. Эквайринг bePaid / ЕРИП.',
    },
  });
  await prisma.newsArticle.updateMany({
    where: { slug: 'welcome-to-arenaos' },
    data: { slug: 'welcome-to-rudemir-legacy', title: 'Архив' },
  });

  await prisma.clubMedia.deleteMany({ where: { clubId: minsk.id } });

  console.log('Seed OK — RUDEMIR / BY');
  console.log('  Сеть        +375291000001 / admin123');
  console.log('  Владелец    +375291000002 / owner123');
  console.log('  Смена       +375291000003 / admin123');
  console.log('  Гость       +375291000004 / guest123');
  console.log('  Тех.админ   +375291000005 / tech123');
  console.log('  Поддержка   +375291000006 / support123');
  console.log('  Кассир      +375291000007 / cash123');
  console.log('  Бармен      +375291000008 / bar123');
  console.log('  Управляющий +375291000009 / manager123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
