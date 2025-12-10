const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Configuração do PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'taskdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Criar tabela de itens se não existir
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shopping_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 1,
        purchased BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database initialized - Shopping items table ready');
  } catch (err) {
    console.error('❌ Error initializing database:', err);
  }
};

initDB();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET - Listar todos os itens
app.get('/api/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shopping_items ORDER BY purchased ASC, created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Error fetching items' });
  }
});

// GET - Buscar item por ID
app.get('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM shopping_items WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Error fetching item' });
  }
});

// POST - Adicionar novo item
app.post('/api/items', async (req, res) => {
  try {
    const { name, quantity } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Item name is required' });
    }
    
    const qty = quantity && quantity > 0 ? quantity : 1;
    
    const result = await pool.query(
      'INSERT INTO shopping_items (name, quantity) VALUES ($1, $2) RETURNING *',
      [name, qty]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Error creating item' });
  }
});

// PUT - Atualizar item
app.put('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, quantity, purchased } = req.body;
    
    const result = await pool.query(
      'UPDATE shopping_items SET name = COALESCE($1, name), quantity = COALESCE($2, quantity), purchased = COALESCE($3, purchased) WHERE id = $4 RETURNING *',
      [name, quantity, purchased, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Error updating item' });
  }
});

// DELETE - Deletar item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM shopping_items WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Error deleting item' });
  }
});

// GET - Estatísticas
app.get('/api/stats', async (req, res) => {
  try {
    const total = await pool.query('SELECT COUNT(*) as total FROM shopping_items');
    const purchased = await pool.query('SELECT COUNT(*) as purchased FROM shopping_items WHERE purchased = true');
    const pending = await pool.query('SELECT COUNT(*) as pending FROM shopping_items WHERE purchased = false');
    
    res.json({
      success: true,
      data: {
        total: parseInt(total.rows[0].total),
        purchased: parseInt(purchased.rows[0].purchased),
        pending: parseInt(pending.rows[0].pending)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Error fetching stats' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Shopping List API running on port ${PORT}`);
});