import fs from 'fs';
import path from 'path';

function fixFile(fileName: string) {
  const filePath = path.resolve(process.cwd(), 'src', 'pages', fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/const ok = \/\/ no-op for DB views;/g, 'const ok = true;');
  content = content.replace(/const ok = \/\/ no-op;/g, 'const ok = true;');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${fileName}`);
}

fixFile('ServiciosDB.tsx');
fixFile('EntregaDeLlavesDB.tsx');
fixFile('IncidenciasDB.tsx');
