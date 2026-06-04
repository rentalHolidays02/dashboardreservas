import fs from 'fs';
import path from 'path';

function refactorFile(fileName: string, replacements: {from: string | RegExp, to: string}[]) {
  const filePath = path.resolve(process.cwd(), 'src', 'pages', fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Refactored ${fileName}`);
}

// 1. ServiciosDB.tsx
refactorFile('ServiciosDB.tsx', [
  { from: 'const Cleans:', to: 'const ServiciosDB:' },
  { from: 'export default Cleans;', to: 'export default ServiciosDB;' },
  { from: `import { appsScriptApi, getDistanceMeters, parseCoords, geocodeAddress } from '../services/api';`, to: `import { appsScriptApi, getDistanceMeters, parseCoords, geocodeAddress } from '../services/api';\nimport { supabaseOperationsApi } from '../services/supabaseOperationsApi';` },
  { from: /const fetchAllData = async \(\) => \{[\s\S]*?finally \{\s*setLoading\(false\);\s*\}\s*\};\s*fetchAllData\(\);/, to: `const fetchAllData = async () => {\n      setLoading(true);\n      try {\n        const { normal, initial, handyman } = await supabaseOperationsApi.getCleans();\n        setNormalCleans(normal);\n        setInitialCleans(initial);\n        setHandymanRecords(handyman);\n        setCleansLoadStatus(normal.length + initial.length + handyman.length === 0 ? 'empty' : 'ok');\n      } catch (error) {\n        console.error(error);\n        setCleansLoadStatus('error');\n      } finally {\n        setLoading(false);\n      }\n    };\n    fetchAllData();` },
  { from: /const refreshCleans = async \(\) => \{[\s\S]*?setCleansLoadError\(''\);\s*\}\s*else\s*\{\s*setCleansLoadStatus\('ok'\);\s*setCleansLoadError\(''\);\s*\}\s*\};/, to: `const refreshCleans = async () => {\n    try {\n      const { normal, initial, handyman } = await supabaseOperationsApi.getCleans();\n      setNormalCleans(normal);\n      setInitialCleans(initial);\n      setHandymanRecords(handyman);\n      setCleansLoadStatus(normal.length + initial.length + handyman.length === 0 ? 'empty' : 'ok');\n    } catch(e) { console.error(e); setCleansLoadStatus('error'); }\n  };` },
  { from: /await appsScriptApi.deleteCheckoutRecord\(type, id\)/g, to: `await supabaseOperationsApi.deleteRecord('service_reports', id)` },
  { from: /await appsScriptApi.updateCleanStatus\(type, id, checked\)/g, to: `// no-op for DB views` }
]);

// 2. EntregaDeLlavesDB.tsx
refactorFile('EntregaDeLlavesDB.tsx', [
  { from: 'const EntregaDeLlaves:', to: 'const EntregaDeLlavesDB:' },
  { from: 'export default EntregaDeLlaves;', to: 'export default EntregaDeLlavesDB;' },
  { from: `import { appsScriptApi } from '../services/api';`, to: `import { appsScriptApi } from '../services/api';\nimport { supabaseOperationsApi } from '../services/supabaseOperationsApi';` },
  { from: /const loadData = async \(\) => \{[\s\S]*?finally \{\s*setLoading\(false\);\s*\}\s*\};/, to: `const loadData = async () => {\n    setLoading(true);\n    try {\n      const data = await supabaseOperationsApi.getEntregaLlaves();\n      setEntregas(data);\n      setLoadStatus(data.length === 0 ? 'empty' : 'ok');\n    } catch (e) {\n      console.error(e);\n      setLoadStatus('error');\n    } finally {\n      setLoading(false);\n    }\n  };` },
  { from: /await appsScriptApi.deleteEntregaLlaves\(id\)/g, to: `await supabaseOperationsApi.deleteRecord('key_deliveries', id)` },
  { from: /await appsScriptApi.updateEntregaLlavesStatus\(id, checked\)/g, to: `// no-op` }
]);

// 3. IncidenciasDB.tsx
refactorFile('IncidenciasDB.tsx', [
  { from: 'const Incidencias:', to: 'const IncidenciasDB:' },
  { from: 'export default Incidencias;', to: 'export default IncidenciasDB;' },
  { from: `import { appsScriptApi } from '../services/api';`, to: `import { appsScriptApi } from '../services/api';\nimport { supabaseOperationsApi } from '../services/supabaseOperationsApi';` },
  { from: /const fetchData = async \(\) => \{[\s\S]*?finally \{\s*setLoading\(false\);\s*\}\s*\};/, to: `const fetchData = async () => {\n    setLoading(true);\n    try {\n      const data = await supabaseOperationsApi.getIncidencias();\n      setIncidencias(data);\n      setLoadStatus(data.length === 0 ? 'empty' : 'ok');\n    } catch (e) {\n      console.error(e);\n      setLoadStatus('error');\n    } finally {\n      setLoading(false);\n    }\n  };` },
  { from: /await appsScriptApi.deleteIncidencia\(id\)/g, to: `await supabaseOperationsApi.deleteRecord('incident_reports', id)` },
  { from: /await appsScriptApi.updateIncidenciaStatus\(id, checked\)/g, to: `// no-op` }
]);
