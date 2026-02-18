// Legacy Express stub preserved in /legacy for reference
const express = require('express');
const app = express();
app.use(express.json());

const API_PREFIX = '/api/v1';

app.get(API_PREFIX + '/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Minimal ticket endpoints (stubs)
app.get(API_PREFIX + '/tickets', (req, res) => {
  res.json({ data: [], meta: { total: 0 } });
});

app.post(API_PREFIX + '/tickets', (req, res) => {
  // TODO: validate and create ticket
  res.status(201).json({ id: 'stub-ticket-id' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Legacy Express backend listening on port ${PORT}`));
