#!/usr/bin/env node
// ticketctl CLI — szkic
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const cmd = args[0];

function install() {
  console.log('Instalacja backendu, bazy i storage...');
  // Tu: tworzenie katalogów, generowanie QR admina, migracje, seed
}

function generateQR() {
  const ticketId = args[1] || 'admin';
  console.log(`Generowanie QR dla ticketId: ${ticketId}`);
  // Tu: wywołanie endpointu backendu lub lokalna generacja
}

function migrate() {
  console.log('Migracja bazy danych...');
  // Tu: wywołanie npx prisma migrate
}

function provisionPair() {
  console.log('Provisioning QR pairing...');
  // Tu: wywołanie endpointu /api/v1/provision/qr-accept
}

switch (cmd) {
  case 'install': install(); break;
  case 'generate-qr': generateQR(); break;
  case 'migrate': migrate(); break;
  case 'provision': provisionPair(); break;
  default:
    console.log('ticketctl <install|generate-qr|migrate|provision>');
}
