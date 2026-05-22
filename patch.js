const fs = require('fs');
let c = fs.readFileSync('pages/index.js', 'utf8');

// 1. Fix parseDate string trimming
c = c.replace(/if \(!str\) return null;/g, 'if (!str) return null;\n  str = String(str).trim();');

// 2. State variables
c = c.replace(/const \[alarmsEnabled, setAlarmsEnabled\] = useState\(true\);[\s\S]*?const audioCtx = useRef\(null\);/m, `const [alarmsEnabled, setAlarmsEnabled] = useState(true);
  const [edits, setEdits] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const audioCtx = useRef(null);`);

// 3. saveEdit function
c = c.replace(/function savePhone\(id\) \{[\s\S]*?\}/m, `function saveEdit(id, field) {
    setEdits(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: editInput
      }
    }));
    setEditingCell(null);
    setEditInput('');
  }`);

// 4. Headers parsing
c = c.replace(/const idxSalida = cabeceras\.findIndex\(c => c\.includes\("SALIDA"\)\);[\s\S]*?const idxDatosKiko = cabeceras\.findIndex\(c => c\.includes\("DATOS KIKO"\)\);/m, `const idxSalida = cabeceras.findIndex(c => c.includes("SALIDA"));
          const idxObs = cabeceras.findIndex(c => c === "OBSERVACIONES" || c.includes("OBSERVAC"));
          const idxNombre = cabeceras.findIndex(c => c.includes("NOMBRE"));
          const idxTelefono = cabeceras.findIndex(c => c.includes("TELEFONO") || c.includes("TELÉFONO"));`);

// 5. Registros pushing
c = c.replace(/salida: idxSalida > -1 \? fila\[idxSalida\] : '',[\s\S]*?datosKiko: idxDatosKiko > -1 \? fila\[idxDatosKiko\] : ''/m, `salida: idxSalida > -1 ? fila[idxSalida] : '',
              nombre: idxNombre > -1 ? fila[idxNombre] : '',
              telefono: idxTelefono > -1 ? fila[idxTelefono] : '',
              observaciones: idxObs > -1 ? fila[idxObs] : ''`);

// 6. setKeys
c = c.replace(/setKeys\(\{[\s\S]*?\}\);/m, `setKeys({
            alojamiento: 'alojamiento',
            origen: 'origen',
            entrada: 'entrada',
            salida: 'salida',
            nombre: 'nombre',
            telefono: 'telefono',
            observaciones: 'observaciones'
          });`);

// 7. Remove 'Ya llamados' stat box
c = c.replace(/<div className="stat">\s*<div className="stat-label">Ya llamados<\/div>[\s\S]*?<\/div>/m, ``);

// 8. Remove tabs UI
c = c.replace(/<div className="tabs">[\s\S]*?<\/div>\s*<div className="stats">/m, `<div className="stats">`);

// 9. Change tab condition
c = c.replace(/\) : tab === 'reservas' \? \(/m, `) : (`);

// 10. Table Headers
c = c.replace(/<th>Teléfono<\/th>\s*<th>Acción<\/th>\s*<th>Observaciones<\/th>\s*<th>Datos Kiko<\/th>/m, `<th>Nombre</th>\n                    <th>Teléfono</th>\n                    <th>Observaciones</th>`);

// 11. Render rows logic and editable cell function
c = c.replace(/const isCalled = called\[id\];[\s\S]*?let nights = '—';/m, `const customNombre = edits[id]?.nombre !== undefined ? edits[id].nombre : (row.nombre || '');
                    const customTelefono = edits[id]?.telefono !== undefined ? edits[id].telefono : (row.telefono || '');
                    const customObs = edits[id]?.observaciones !== undefined ? edits[id].observaciones : (row.observaciones || '');
                    
                    let nights = '—';
                    if (row._entrada && row._salida)
                      nights = Math.round((row._salida - row._entrada) / 86400000);

                    const renderEditableCell = (field, value, placeholder) => {
                      const isEditing = editingCell?.id === id && editingCell?.field === field;
                      if (isEditing) {
                        return (
                          <div className="phone-cell" onClick={e => e.stopPropagation()}>
                            <input
                              className="phone-input"
                              value={editInput}
                              placeholder={placeholder}
                              onChange={e => setEditInput(e.target.value)}
                              onKeyDown={e => { 
                                if (e.key === 'Enter') saveEdit(id, field); 
                                if (e.key === 'Escape') setEditingCell(null); 
                              }}
                              autoFocus
                            />
                            <button className="btn btn-accent btn-xs" onClick={() => saveEdit(id, field)}>✓</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => setEditingCell(null)}>✕</button>
                          </div>
                        );
                      }
                      return (
                        <div className="phone-cell" onClick={e => e.stopPropagation()}>
                          {value ? <span className="phone-val">{value}</span> : <span className="phone-empty">Vacío</span>}
                          <button className="btn btn-ghost btn-xs" onClick={() => { 
                            setEditingCell({ id, field }); 
                            setEditInput(value); 
                          }}>✏️</button>
                        </div>
                      );
                    };`);

// 12. Fix the tr class and eHoy/sHoy
c = c.replace(/className={\`\$\{eHoy \? 'in-today' : sHoy \? 'out-today' : ''\} \$\{isCalled \? 'is-called' : ''\}\`}/m, "className={`${eHoy ? 'in-today' : sHoy ? 'out-today' : ''}`}");

// 13. Replace table cells
c = c.replace(/<td className="ac" onClick={e => e\.stopPropagation\(\)}>\s*<div className="phone-cell">[\s\S]*?<\/tr>,/m, `<td className="ac">{renderEditableCell('nombre', customNombre, 'Nombre...')}</td>
                        <td className="ac">{renderEditableCell('telefono', customTelefono, '+34...')}</td>
                        <td className="ac" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {renderEditableCell('observaciones', customObs, 'Observaciones...')}
                        </td>
                      </tr>,`);

// 14. Fix expanded view
c = c.replace(/\{phones\[id\] && \([\s\S]*?\}\)/m, `{edits[id] && Object.entries(edits[id]).map(([fk, fv]) => (
                                <div className="exp-item" key={fk}>
                                  <label>{fk} (modificado)</label>
                                  <span>{fv}</span>
                                </div>
                              ))}`);

// 15. Remove financiero tab block completely
c = c.replace(/<div className="footer-bar">\s*\{displayed\.length\} reservas · \{data\.length\} total Booking \+ Airbnb · Haz clic en una fila para ver todos los datos\s*<\/div>\s*<\/>\s*\) : \(\s*\/\* Financiero \*\/[\s\S]*?<\/div>\s*\)\}\s*<\/>\s*\);\s*\}/m, `<div className="footer-bar">
            {displayed.length} reservas · {data.length} total Booking + Airbnb · Haz clic en una fila para ver todos los datos
          </div>
        </>
      )}
    </>
  );
}`);

fs.writeFileSync('pages/index.js', c);
console.log('Patch complete.');
