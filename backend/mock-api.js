/**
 * Mock API Server - Development Only
 * Serves as temporary backend for frontend development
 * Replaces Backend NestJS until PostgreSQL+Prisma is configured
 */

const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());
app.use(cors());

const API_PREFIX = '/api/v1';

// ============= MOCK DATA STORE =============
let ticketsDB = [
  {
    id: '36',
    title: 'Nie działa internet na 2. piętrze',
    description: 'W całym biurze na 2. piętrze nie ma dostępu do internetu. Diody na switchu mrugają na pomarańczowo. Próbowaliśmy restartu routera, ale nie pomogło. Proszę o pilną interwencję, dział handlowy nie może pracować.',
    status: 'in_progress',
    priority: 'urgent',
    deviceType: 'Mac mini',
    deviceSN: 'C02A1234567890',
    customerName: 'Jan Kowalski',
    customerEmail: 'jan@example.com',
    customerPhone: '+48 123 456 789',
    assignedTo: 'Anna Nowak',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    comments: [
      { id: 'c1', author: 'Anna Nowak', text: 'Przyjęłam zgłoszenie. Jadę na miejsce sprawdzić główny switch.', isInternal: false, createdAt: new Date().toISOString() },
    ],
    costItems: [
      { id: 'ci1', description: 'Wentylator do switcha Cisco', quantity: 1, unitPrice: 450, vat: 23, total: 554.50 },
    ],
    estimatedCost: 923.50,
    actualCost: 0,
    publicToken: 'pub_token_36_xyz',
    qrToken: 'qr_36_abc123',
  },
  {
    id: '35',
    title: 'Wymiana myszki w foyer',
    description: 'Myszka biurowa nie reaguje na kliknięcia. Pytanie: co to Apple mouse czy zwykła? Potrzebna wymiana ASAP.',
    status: 'new',
    priority: 'low',
    deviceType: 'Apple Mouse',
    deviceSN: 'N/A',
    customerName: 'Marek Kamiński',
    customerEmail: 'marek@example.com',
    customerPhone: '+48 987 654 321',
    assignedTo: 'Nieprzypisany',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    comments: [],
    costItems: [{ id: 'ci2', description: 'Apple Magic Mouse 2', quantity: 1, unitPrice: 320, vat: 23, total: 393.60 }],
    estimatedCost: 393.60,
    actualCost: 0,
    publicToken: 'pub_token_35_yyy',
    qrToken: 'qr_35_def456',
  },
];

let usersDB = [
  { id: 'u1', name: 'Anna Nowak', email: 'anna@apple-service.pl', role: 'ADMIN', status: 'active', joinDate: '2024-01-15' },
  { id: 'u2', name: 'Piotr Kowalczyk', email: 'piotr@apple-service.pl', role: 'AGENT', status: 'active', joinDate: '2024-02-10' },
  { id: 'u3', name: 'Marta Lewandowska', email: 'marta@apple-service.pl', role: 'AGENT', status: 'active', joinDate: '2024-02-10' },
];

let vatRatesDB = [
  { id: '1', rate: 0, label: 'Zwolnienie z VAT', description: 'Towary i usługi zwolnione z podatku VAT', isActive: true },
  { id: '2', rate: 5, label: 'Stawka obniżona (5%)', description: 'Podstawowe artykuły żywnościowe, leki, książki', isActive: true },
  { id: '3', rate: 8, label: 'Stawka obniżona (8%)', description: 'Usługi publiczne, oprawy, paliwo do ogrzewania', isActive: true },
  { id: '4', rate: 23, label: 'Stawka standardowa (23%)', description: 'Większość towarów i usług', isActive: true },
];

// ============= HEALTH CHECK =============
app.get(API_PREFIX + '/health', (req, res) => {
  res.json({ status: 'ok', service: 'mock-api', timestamp: new Date().toISOString() });
});

app.get(API_PREFIX + '/diagnostics', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      database: { status: 'mock', latency: 0 },
      storage: { status: 'mock', latency: 0 },
      cache: { status: 'mock', latency: 0 },
    },
    memory: process.memoryUsage(),
  });
});

// ============= TICKETS ENDPOINTS =============

// GET /api/v1/tickets - Pobierz listę ticketów
app.get(API_PREFIX + '/tickets', (req, res) => {
  const { status, priority, search, assignedTo } = req.query;

  let filtered = [...ticketsDB];

  if (status) filtered = filtered.filter(t => t.status === status);
  if (priority) filtered = filtered.filter(t => t.priority === priority);
  if (assignedTo) filtered = filtered.filter(t => t.assignedTo === assignedTo);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(t =>
      t.id.includes(q) || t.title.toLowerCase().includes(q) || t.customerName.toLowerCase().includes(q)
    );
  }

  res.json({
    success: true,
    data: filtered,
    meta: { total: filtered.length, timestamp: new Date().toISOString() },
  });
});

// GET /api/v1/tickets/:id - Pobierz szczegóły ticketu
app.get(API_PREFIX + '/tickets/:id', (req, res) => {
  const ticket = ticketsDB.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
  res.json({ success: true, data: ticket });
});

// POST /api/v1/tickets - Utwórz nowy ticket
app.post(API_PREFIX + '/tickets', (req, res) => {
  const { title, description, priority, deviceType, deviceSN, customerName, customerEmail, customerPhone } = req.body;

  if (!title || !description || !customerName) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const newTicket = {
    id: String(Math.max(...ticketsDB.map(t => parseInt(t.id) || 0)) + 1),
    title,
    description,
    status: 'new',
    priority: priority || 'normal',
    deviceType: deviceType || 'Inne',
    deviceSN: deviceSN || 'N/A',
    customerName,
    customerEmail: customerEmail || '',
    customerPhone: customerPhone || '',
    assignedTo: 'Nieprzypisany',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    costItems: [],
    estimatedCost: 0,
    actualCost: 0,
    publicToken: `pub_token_${Date.now()}`,
    qrToken: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };

  ticketsDB.push(newTicket);

  res.status(201).json({
    success: true,
    data: newTicket,
    message: `Ticket #${newTicket.id} created successfully`,
  });
});

// PATCH /api/v1/tickets/:id - Edytuj ticket
app.patch(API_PREFIX + '/tickets/:id', (req, res) => {
  const ticket = ticketsDB.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

  const updates = req.body;
  Object.assign(ticket, updates, { updatedAt: new Date().toISOString() });

  res.json({ success: true, data: ticket });
});

// POST /api/v1/tickets/:id/comments - Dodaj komentarz
app.post(API_PREFIX + '/tickets/:id/comments', (req, res) => {
  const ticket = ticketsDB.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

  const { author, text, isInternal } = req.body;
  const comment = {
    id: `comment_${Date.now()}`,
    author: author || 'Anonymous',
    text,
    isInternal: isInternal || false,
    createdAt: new Date().toISOString(),
  };

  ticket.comments.push(comment);
  ticket.updatedAt = new Date().toISOString();

  res.status(201).json({ success: true, data: comment });
});

// POST /api/v1/tickets/:id/cost-items - Dodaj koszt
app.post(API_PREFIX + '/tickets/:id/cost-items', (req, res) => {
  const ticket = ticketsDB.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

  const { description, quantity, unitPrice, vat } = req.body;
  const costItem = {
    id: `cost_${Date.now()}`,
    description,
    quantity: quantity || 1,
    unitPrice: unitPrice || 0,
    vat: vat || 23,
    total: (quantity || 1) * (unitPrice || 0) * (1 + (vat || 23) / 100),
  };

  ticket.costItems.push(costItem);
  ticket.updatedAt = new Date().toISOString();

  res.status(201).json({ success: true, data: costItem });
});

// POST /api/v1/tickets/:id/generate-qr - Generuj QR
app.post(API_PREFIX + '/tickets/:id/generate-qr', async (req, res) => {
  const ticket = ticketsDB.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

  try {
    // Generate QR code as Data URL (PNG)
    const qrData = `TICKET:${ticket.id}|TOKEN:${ticket.qrToken}|TIME:${Date.now()}`;
    const qrImage = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: { dark: '#000', light: '#FFF' },
    });

    res.json({
      success: true,
      data: {
        ticketId: ticket.id,
        qrToken: ticket.qrToken,
        qrImage: qrImage,
        publicUrl: `http://localhost:3002/ticket/${ticket.publicToken}`,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'QR generation failed' });
  }
});

// ============= USERS ENDPOINTS =============

app.get(API_PREFIX + '/users', (req, res) => {
  res.json({ success: true, data: usersDB, meta: { total: usersDB.length } });
});

app.post(API_PREFIX + '/users', (req, res) => {
  const { name, email, role } = req.body;
  const newUser = {
    id: `u${usersDB.length + 1}`,
    name,
    email,
    role: role || 'AGENT',
    status: 'active',
    joinDate: new Date().toISOString().split('T')[0],
  };
  usersDB.push(newUser);
  res.status(201).json({ success: true, data: newUser });
});

// ============= VAT RATES ENDPOINTS =============

app.get(API_PREFIX + '/vat-rates', (req, res) => {
  res.json({ success: true, data: vatRatesDB, meta: { total: vatRatesDB.length } });
});

app.post(API_PREFIX + '/vat-rates', (req, res) => {
  const { rate, label, description } = req.body;
  const newRate = {
    id: String(vatRatesDB.length + 1),
    rate,
    label,
    description: description || '',
    isActive: true,
  };
  vatRatesDB.push(newRate);
  res.status(201).json({ success: true, data: newRate });
});

// ============= ATTACHMENTS ENDPOINTS =============

app.post(API_PREFIX + '/attachments/presigned-url', (req, res) => {
  const { ticketId, fileName, fileType } = req.body;

  res.json({
    success: true,
    data: {
      uploadUrl: `https://mock-s3.example.com/upload?ticket=${ticketId}&file=${Date.now()}.tmp`,
      downloadUrl: `https://mock-s3.example.com/download/${fileName}`,
      expiresIn: 3600,
    },
  });
});

// ============= PUBLIC ENDPOINTS =============

app.get('/ticket/:publicToken', (req, res) => {
  const ticket = ticketsDB.find(t => t.publicToken === req.params.publicToken);
  if (!ticket) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Ticket Not Found</title></head>
        <body style="text-align: center; padding: 50px; font-family: Arial;">
          <h1>❌ Ticket Not Found</h1>
          <p>Token: ${req.params.publicToken}</p>
        </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Ticket #${ticket.id}</title></head>
      <body style="padding: 20px; font-family: Arial; max-width: 800px; margin: 0 auto;">
        <h1>Ticket #${ticket.id}</h1>
        <h2>${ticket.title}</h2>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
        <p><strong>Description:</strong><br>${ticket.description}</p>
        <p><strong>Estimated Cost:</strong> ${ticket.estimatedCost} PLN</p>
        <hr>
        <h3>Comments</h3>
        ${ticket.comments.length > 0 ? ticket.comments.map(c => `<p><strong>${c.author}:</strong> ${c.text}</p>`).join('') : '<p>No comments yet.</p>'}
      </body>
    </html>
  `);
});

// ============= ERROR HANDLING =============

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ============= START SERVER =============

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Mock API Server running on http://localhost:${PORT}`);
  console.log(`📍 API Prefix: /api/v1`);
  console.log(`📊 Tickets: ${ticketsDB.length}`);
  console.log(`👥 Users: ${usersDB.length}`);
  console.log(`💰 VAT Rates: ${vatRatesDB.length}\n`);
});
