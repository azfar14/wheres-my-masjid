const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const targetFiles = [
  'lib/providers/common.ts',
  'lib/providers/foursquare.ts',
  'lib/providers/googlePlaces.ts',
  'lib/providers/mappls.ts',
  'lib/navigationTrust.ts',
  'lib/providerHealthGridKey.ts',
  'lib/precisionDiscovery.ts',
  'components/MasjidNavigationLink.tsx',
  'components/MasjidCard.tsx',
  'app/page.tsx',
  'app/nearby/page.tsx',
  'app/masjid/[id]/page.tsx',
  'app/admin/verification/page.tsx',
  'app/admin/analytics/page.tsx',
  'app/admin/data-pipeline/page.tsx',
  'app/qibla/page.tsx'
];

let failed = false;
for (const file of targetFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failed = true;
    console.error(`Missing file: ${file}`);
    continue;
  }

  const source = fs.readFileSync(full, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020
    },
    reportDiagnostics: true,
    fileName: file
  });

  const diagnostics = result.diagnostics || [];
  if (diagnostics.length) {
    failed = true;
    console.error(`Diagnostics for ${file}:`);
    for (const diagnostic of diagnostics) {
      console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  }
}

if (failed) process.exit(1);
console.log(`Syntax check passed for ${targetFiles.length} upgraded files.`);
