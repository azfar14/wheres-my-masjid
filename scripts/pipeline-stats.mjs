#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const file = process.argv[2] || 'data/chennai-pipeline-snapshot.json';
const inputPath = path.resolve(process.cwd(), file);
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
console.log('City pipeline stats');
console.table(Array.isArray(data) ? data : [data]);
