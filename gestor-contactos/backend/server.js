const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// ─── Utilidades ───────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    if (vals.length < 2) continue;
    const obj = { _id: i };
    header.forEach((h, idx) => {
      obj[h] = (vals[idx] || '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function sortData(data, field, direction) {
  const dir = direction === 'desc' ? -1 : 1;
  return [...data].sort((a, b) => {
    const va = (a[field] || '').toLowerCase();
    const vb = (b[field] || '').toLowerCase();
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

function filterData(data, query) {
  if (!query) return data;
  const q = query.toLowerCase();
  return data.filter(row =>
    Object.values(row).some(v => String(v).toLowerCase().includes(q))
  );
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

// POST /api/upload — recibe el archivo y devuelve los datos procesados
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    const text = fs.readFileSync(filePath, 'utf-8');
    fs.unlinkSync(filePath); // limpiar archivo temporal

    const parsed = parseCSV(text);

    if (parsed.length === 0) {
      return res.status(422).json({ error: 'El archivo no contiene datos válidos.' });
    }

    const fields = Object.keys(parsed[0]).filter(k => k !== '_id');

    res.json({
      success: true,
      total: parsed.length,
      fields,
      data: parsed,
    });

  } catch (err) {
    console.error('Error al procesar archivo:', err);
    res.status(500).json({ error: 'Error interno al procesar el archivo.' });
  }
});

// POST /api/process — ordena, filtra y pagina los datos enviados
app.post('/api/process', (req, res) => {
  try {
    const {
      data = [],
      sortField = 'apellido1',
      sortDirection = 'asc',
      search = '',
      page = 1,
      perPage = 20,
    } = req.body;

    let result = filterData(data, search);
    result = sortData(result, sortField, sortDirection);

    const total = result.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * perPage;
    const slice = result.slice(start, start + perPage);

    res.json({
      success: true,
      total,
      totalPages,
      currentPage,
      perPage,
      data: slice,
    });

  } catch (err) {
    console.error('Error al procesar datos:', err);
    res.status(500).json({ error: 'Error interno al procesar los datos.' });
  }
});

// GET /api/health — verificar que el servidor está vivo
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor activo' });
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Backend corriendo en http://localhost:${PORT}`);
  console.log(`   Endpoints disponibles:`);
  console.log(`   POST http://localhost:${PORT}/api/upload`);
  console.log(`   POST http://localhost:${PORT}/api/process`);
  console.log(`   GET  http://localhost:${PORT}/api/health\n`);
});
