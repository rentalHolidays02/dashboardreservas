import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PagoRecord, Incidencia, NormalCleanRecord, HandymanRecord } from './mockData';

export interface ReportData {
  pagos: PagoRecord[];
  incidencias: Incidencia[];
  cleans: NormalCleanRecord[];
  handyman: HandymanRecord[];
}

export interface ReportOptions {
  pagos: boolean;
  limpiezas: boolean;
  incidencias: boolean;
  handyman: boolean;
}

export interface ReportFilters {
  periodo: string;
  workerName: string | null;
  accName: string | null;
}

const C = {
  black:     [15,  15,  15]  as [number, number, number],
  darkGray:  [60,  60,  60]  as [number, number, number],
  midGray:   [130, 130, 130] as [number, number, number],
  lightGray: [210, 210, 210] as [number, number, number],
  bg:        [248, 248, 248] as [number, number, number],
  divider:   [240, 240, 240] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
};

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtDate = (s: string) =>
  new Date(s.length === 10 ? s + 'T00:00:00' : s)
    .toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

const PERIOD_LABELS: Record<string, string> = {
  'este-mes':      'Este mes',
  'mes-pasado':    'Mes pasado',
  'trimestre':     'Último trimestre',
  'personalizado': 'Personalizado',
};

// Carga la imagen como base64 desde una URL
async function loadImageBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function generatePDF(
  data: ReportData,
  options: ReportOptions,
  filters: ReportFilters,
  logoUrl: string,
): Promise<void> {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const margin = 16;
  let y = 0;

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.white);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setDrawColor(...C.divider);
  doc.setLineWidth(0.25);
  doc.line(margin, 22, pageW - margin, 22);

  // Logo como imagen (altura 10mm, ancho proporcional)
  try {
    const logoB64 = await loadImageBase64(logoUrl);
    const logoH   = 8;
    const logoW   = logoH * 3; // ajusta según la proporción real del logo
    doc.addImage(logoB64, 'PNG', margin, 7, logoW, logoH);
  } catch {
    // Fallback de texto si la imagen falla
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(234, 88, 12);
    doc.text('RH Pagos', margin, 15);
  }

  // Fecha
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.midGray);
  const dateStr = new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  doc.text(dateStr, pageW - margin, 15, { align: 'right' });

  y = 32;

  // ── TÍTULO ───────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...C.black);
  doc.text('Informe de Actividad', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.midGray);
  const meta = [
    PERIOD_LABELS[filters.periodo] ?? filters.periodo,
    filters.workerName ?? 'Todos los trabajadores',
    filters.accName    ?? 'Todos los alojamientos',
  ].join('  ·  ');
  doc.text(meta, margin, y);
  y += 10;

  // ── KPI CARDS ────────────────────────────────────────────────────────────────
  const totalPagado    = data.pagos.filter(p => p.estado === 'pagado').reduce((s, p) => s + p.importe, 0);
  const totalPendiente = data.pagos.filter(p => p.estado === 'pendiente').reduce((s, p) => s + p.importe, 0);

  const kpis = [
    { label: 'Total pagado',  value: fmtCurrency(totalPagado)    },
    { label: 'Pendiente',     value: fmtCurrency(totalPendiente) },
    { label: 'Limpiezas',     value: String(data.cleans.length)         },
    { label: 'Incidencias',   value: String(data.incidencias.length)    },
  ];

  const cardW = (pageW - margin * 2 - 9) / 4;
  kpis.forEach((kpi, i) => {
    const x = margin + i * (cardW + 3);
    doc.setFillColor(...C.bg);
    doc.setDrawColor(...C.divider);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, cardW, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.midGray);
    doc.text(kpi.label.toUpperCase(), x + 4, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.black);
    doc.text(kpi.value, x + 4, y + 11);
  });
  y += 20;

  // ── TABLAS ───────────────────────────────────────────────────────────────────
  const tableStyles = {
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: C.darkGray,
      lineColor: C.divider,
      lineWidth: 0.15,
    } as const,
    headStyles: {
      fillColor: C.bg,
      textColor: C.midGray,
      fontStyle: 'normal' as const,
      fontSize: 7,
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: [252, 252, 252] as [number, number, number] },
    margin: { left: margin, right: margin },
  };

  if (options.pagos && data.pagos.length > 0) {
    y = drawSectionTitle(doc, 'Pagos y Liquidaciones', y, pageW, pageH, margin);
    autoTable(doc, {
      ...tableStyles, startY: y,
      head: [['Trabajador', 'Fecha', 'Concepto', 'Limpiezas', 'Km', 'Importe', 'Estado']],
      body: data.pagos.map(p => [
        p.workerName, fmtDate(p.fecha), p.concepto,
        p.limpiezas, p.km, fmtCurrency(p.importe),
        p.estado === 'pagado' ? 'Pagado' : 'Pendiente',
      ]),
      columnStyles: { 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'center' } },
      didParseCell(d) {
        if (d.column.index === 6 && d.section === 'body')
          d.cell.styles.textColor = d.cell.raw === 'Pagado' ? [34, 197, 94] : [245, 158, 11];
      },
    });
    const endY = (doc as any).lastAutoTable.finalY;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.midGray);
    doc.text(
      `Pagado ${fmtCurrency(totalPagado)}   Pendiente ${fmtCurrency(totalPendiente)}`,
      pageW - margin, endY + 5, { align: 'right' },
    );
    y = endY + 12;
  }

  if (options.limpiezas && data.cleans.length > 0) {
    y = drawSectionTitle(doc, 'Registro de Limpiezas', y, pageW, pageH, margin);
    autoTable(doc, {
      ...tableStyles, startY: y,
      head: [['Limpiador/a', 'Apartamento', 'Entrada', 'Salida', 'Km', 'Observaciones']],
      body: data.cleans.map(c => [
        `${c.nombre} ${c.apellidos}`, c.apartamento,
        c.horaEntrada, c.horaSalida, c.km, c.observaciones || '—',
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  if (options.incidencias && data.incidencias.length > 0) {
    y = drawSectionTitle(doc, 'Reporte de Incidencias', y, pageW, pageH, margin);
    autoTable(doc, {
      ...tableStyles, startY: y,
      head: [['Reportado por', 'Alojamiento', 'Fecha', 'Descripción', 'Coste', 'Pagado por']],
      body: data.incidencias.map(i => [
        i.userName, i.accommodationName, fmtDate(i.timestamp),
        i.description, fmtCurrency(i.coste),
        i.pagadoPor === 'empresa' ? 'Empresa' : 'Limpiador',
      ]),
      columnStyles: { 4: { halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  if (options.handyman && data.handyman.length > 0) {
    y = drawSectionTitle(doc, 'Tareas de Mantenimiento', y, pageW, pageH, margin);
    autoTable(doc, {
      ...tableStyles, startY: y,
      head: [['Técnico', 'Alojamiento', 'Inicio', 'Fin', 'Min.', 'Tarea', 'Estado']],
      body: data.handyman.map(h => [
        `${h.nombre} ${h.apellidos}`, h.alojamiento,
        h.horaInicioTarea, h.horaFinTarea, h.cantidadMinutos,
        h.observacionesTarea, h.estadoCompletado,
      ]),
      columnStyles: { 4: { halign: 'center' } },
    });
  }

  // ── FOOTER (todas las páginas) ───────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setDrawColor(...C.lightGray);
    doc.setLineWidth(0.25);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.lightGray);
    doc.text('RH Pagos — Documento confidencial generado automáticamente', margin, pageH - 7);
    doc.text(`${pg} / ${totalPages}`, pageW - margin, pageH - 7, { align: 'right' });
  }

  const fileName = `informe_rh_${filters.periodo}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

function drawSectionTitle(
  doc: jsPDF, title: string, y: number,
  pageW: number, pageH: number, margin: number,
): number {
  if (y > pageH - 55) { doc.addPage(); y = 22; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.midGray);
  doc.text(title.toUpperCase(), margin, y);
  doc.setDrawColor(...C.divider); doc.setLineWidth(0.25);
  const tw = doc.getTextWidth(title.toUpperCase());
  doc.line(margin + tw + 2, y - 1, pageW - margin, y - 1);
  return y + 5;
}
