#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run pipeline:audit -- data/your-masjids.json');
  process.exit(1);
}
const inputPath = path.resolve(process.cwd(), file);
const raw = fs.readFileSync(inputPath, 'utf8');
let rows;
try {
  rows = JSON.parse(raw);
} catch (error) {
  console.error('Invalid JSON:', error.message);
  process.exit(1);
}
if (!Array.isArray(rows)) rows = [rows];
const stats = {
  total: rows.length,
  hasName: 0,
  hasCoordinates: 0,
  verified: 0,
  navigationReady: 0,
  withJumuah: 0,
  errors: []
};
rows.forEach((row, index) => {
  if (row.name || row.placeName || row.masjidName) stats.hasName += 1;
  const lat = Number(row.lat ?? row.latitude ?? row.coordinates?.lat);
  const lng = Number(row.lng ?? row.longitude ?? row.coordinates?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) stats.hasCoordinates += 1;
  else stats.errors.push(`row ${index + 1}: missing lat/lng`);
  if (row.verificationStatus === 'admin_verified' || row.verificationStatus === 'community_checked') stats.verified += 1;
  if (row.navigationVerified === true) stats.navigationReady += 1;
  if ((Array.isArray(row.jumuah) && row.jumuah.length) || (Array.isArray(row.jummah) && row.jummah.length)) stats.withJumuah += 1;
});
console.log(JSON.stringify(stats, null, 2));
if (stats.errors.length) process.exitCode = 1;
