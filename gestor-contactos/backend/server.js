const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

const OUTPUT_HEADERS = [
  'cedula',
  'nombre1',
  'nombre2',
  'apellido1',
  'apellido2',
  'Numcelular',
  'correo',
];

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeKey(key) {
  return String(key || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

const KEY_MAP = {
  cedula: 'cedula',
  documento: 'cedula',
  identificacion: 'cedula',
  id: 'cedula',
  nombre1: 'nombre1',
  primernombre: 'nombre1',
  nombre: 'nombre1',
  nombre2: 'nombre2',
  segundonombre: 'nombre2',
  apellido1: 'apellido1',
  primerapellido: 'apellido1',
  apellido: 'apellido1',
  apellido2: 'apellido2',
  segundoapellido: 'apellido2',
  numcelular: 'Numcelular',
  celular: 'Numcelular',
  telefono: 'Numcelular',
  numerocelular: 'Numcelular',
  correo: 'correo',
  email: 'correo',
  correoelectronico: 'correo',
};

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const rawHeaders = splitCsvLine(lines[0]);
  const normalizedHeaders = rawHeaders.map(header => KEY_MAP[normalizeKey(header)] || header.trim());

  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const row = {};
    normalizedHeaders.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

function escapeCsv(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toOrderedCsv(rows) {
  const lines = [OUTPUT_HEADERS.join(',')];

  for (const row of rows) {
    const line = OUTPUT_HEADERS.map(header => escapeCsv(row[header] || ''));
    lines.push(line.join(','));
  }

  return lines.join('\n');
}

function sortRows(rows, sortField = 'apellido1', sortDirection = 'asc') {
  const safeField = OUTPUT_HEADERS.includes(sortField) ? sortField : 'apellido1';
  const dir = sortDirection === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const av = String(a[safeField] || '').toLowerCase();
    const bv = String(b[safeField] || '').toLowerCase();
    return av.localeCompare(bv, 'es', { sensitivity: 'base' }) * dir;
  });
}

function filterRows(rows, search = '') {
  const term = String(search || '').trim().toLowerCase();
  if (!term) return rows;

  return rows.filter(row =>
    OUTPUT_HEADERS.some(header => String(row[header] || '').toLowerCase().includes(term))
  );
}

app.get('/', (req, res) => {
  res.send('Backend funcionando correctamente. Usa POST /api/upload o abre tu frontend.');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor activo' });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo.' });
    }

    const text = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path);

    let rows = parseCsv(text);
    if (!rows.length) {
      return res.status(422).json({ ok: false, error: 'El archivo no contiene datos válidos.' });
    }

    rows = filterRows(rows, req.body.search || '');
    rows = sortRows(rows, req.body.sortField || 'apellido1', req.body.sortDirection || 'asc');

    const csv = toOrderedCsv(rows);
    const originalBase = path.parse(req.file.originalname || 'contactos').name;
    const downloadName = `${originalBase}_ordenado.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error('Error al procesar archivo:', error);
    return res.status(500).json({ ok: false, error: 'Error interno al procesar el archivo.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});
