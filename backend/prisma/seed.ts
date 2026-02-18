import { PrismaClient, TicketStatus, TicketPriority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding VAT rates...');
  const vatRates = [
    { code: 'VAT23', percent: 23.00, isExempt: false, name: 'Stawka podstawowa 23%' },
    { code: 'VAT8', percent: 8.00, isExempt: false, name: 'Stawka obniżona 8%' },
    { code: 'VAT5', percent: 5.00, isExempt: false, name: 'Stawka obniżona 5%' },
    { code: 'VAT0', percent: 0.00, isExempt: false, name: 'Stawka 0%' },
    { code: 'ZW', percent: 0.00, isExempt: true, name: 'Zwolniony z VAT' },
  ];

  for (const rate of vatRates) {
    await prisma.vatRate.upsert({
      where: { code: rate.code },
      update: rate,
      create: rate,
    });
  }
  console.log('VAT rates seeded.');

  console.log('Seeding users...');
  const user1 = await prisma.user.upsert({
    where: { email: 'jan.kowalski@example.com' },
    update: {},
    create: {
      email: 'jan.kowalski@example.com',
      name: 'Jan Kowalski',
      role: 'AGENT',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'anna.nowak@example.com' },
    update: {},
    create: {
      email: 'anna.nowak@example.com',
      name: 'Anna Nowak',
      role: 'ADMIN',
    },
  });
  console.log('Users seeded.');

  console.log('Seeding tickets...');
  const ticket1 = await prisma.ticket.create({
    data: {
      title: 'Problem z drukarką',
      description: 'Drukarka w dziale księgowości nie drukuje. Świeci się czerwona lampka.',
      status: TicketStatus.NEW,
      priority: TicketPriority.HIGH,
      ownerUserId: user2.id,
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      title: 'Nie działa internet',
      description: 'W całym biurze na 2. piętrze nie ma dostępu do internetu.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.URGENT,
      assignedAgentId: user1.id,
      ownerUserId: user2.id,
    },
  });

  const ticket3 = await prisma.ticket.create({
    data: {
      title: 'Wymiana myszki',
      description: 'Myszka w moim komputerze przestała działać, przycisk nie klika.',
      status: TicketStatus.CLOSED,
      priority: TicketPriority.LOW,
      assignedAgentId: user2.id,
      closedAt: new Date(),
      ownerUserId: user2.id,
    },
  });
  console.log('Tickets seeded.');

  console.log('Seeding comments...');
  await prisma.comment.create({
    data: {
      body: 'Jestem na miejscu, sprawdzam co się stało.',
      ticketId: ticket2.id,
      authorUserId: user1.id,
    },
  });
  await prisma.comment.create({
    data: {
      body: 'Problem dotyczy przełącznika sieciowego. Restartuję urządzenie.',
      ticketId: ticket2.id,
      authorUserId: user1.id,
    },
  });
  console.log('Comments seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });