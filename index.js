const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// 1. Connect to MongoDB
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("⚠️ MONGO_URI is not defined in environment variables!");
} else {
  mongoose.connect(mongoUri)
    .then(() => console.log("Connected to MongoDB ✅"))
    .catch((err) => console.error("MongoDB connection error ❌:", err));
}

// 2. Define Mongoose Schema & Model
const ItemSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Code is required'],
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    adname: {
      type: String,
      default: '',
      trim: true,
    },
    stext: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Item = mongoose.model('Item', ItemSchema);

// 3. API Routes

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongoConnected: mongoose.connection.readyState === 1,
  });
});

// GET all items (with optional search query ?q=)
app.get('/api/items', async (req, res) => {
  try {
    const { q } = req.query;
    let query = {};

    if (q && q.trim()) {
      const searchRegex = new RegExp(q.trim(), 'i');
      query = {
        $or: [
          { code: searchRegex },
          { name: searchRegex },
          { adname: searchRegex },
          { stext: searchRegex },
        ],
      };
    }

    const items = await Item.find(query).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ message: 'Failed to fetch items', error: err.message });
  }
});

// GET single item by ID
app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching item', error: err.message });
  }
});

// POST create a single item
app.post('/api/items', async (req, res) => {
  try {
    const { code, name, adname, stext } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ message: 'Code is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const trimmedCode = code.trim();

    // Check for duplicate code (case-insensitive)
    const existing = await Item.findOne({
      code: { $regex: new RegExp('^' + trimmedCode + '$', 'i') },
    });

    if (existing) {
      return res.status(400).json({ message: `Invitation code "${trimmedCode}" already exists` });
    }

    const newItem = new Item({
      code: trimmedCode,
      name: name.trim(),
      adname: adname ? adname.trim() : '',
      stext: stext ? stext.trim() : '',
    });

    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    console.error('Error creating item:', err);
    res.status(500).json({ message: 'Failed to create item', error: err.message });
  }
});

// POST bulk create items
app.post('/api/items/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' });
    }

    const created = [];
    const skipped = [];

    for (const raw of items) {
      if (!raw.code || !raw.name) {
        skipped.push({ item: raw, reason: 'Missing code or name' });
        continue;
      }

      const trimmedCode = String(raw.code).trim();
      const existing = await Item.findOne({
        code: { $regex: new RegExp('^' + trimmedCode + '$', 'i') },
      });

      if (existing) {
        skipped.push({ item: raw, reason: 'Duplicate code' });
        continue;
      }

      const itemDoc = new Item({
        code: trimmedCode,
        name: String(raw.name).trim(),
        adname: raw.adname ? String(raw.adname).trim() : '',
        stext: raw.stext ? String(raw.stext).trim() : '',
      });

      await itemDoc.save();
      created.push(itemDoc);
    }

    res.status(201).json({
      message: `Successfully created ${created.length} items (${skipped.length} skipped)`,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
  } catch (err) {
    console.error('Error in bulk import:', err);
    res.status(500).json({ message: 'Failed bulk import', error: err.message });
  }
});

// PUT update an item by ID
app.put('/api/items/:id', async (req, res) => {
  try {
    const { code, name, adname, stext } = req.body;
    const { id } = req.params;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (code && code.trim()) {
      const trimmedCode = code.trim();
      // If code changed, verify it doesn't collide with another record
      if (trimmedCode.toLowerCase() !== item.code.toLowerCase()) {
        const existing = await Item.findOne({
          _id: { $ne: id },
          code: { $regex: new RegExp('^' + trimmedCode + '$', 'i') },
        });
        if (existing) {
          return res.status(400).json({ message: `Invitation code "${trimmedCode}" is already in use` });
        }
      }
      item.code = trimmedCode;
    }

    if (name !== undefined) item.name = name.trim();
    if (adname !== undefined) item.adname = adname.trim();
    if (stext !== undefined) item.stext = stext.trim();

    await item.save();
    res.json(item);
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ message: 'Failed to update item', error: err.message });
  }
});

// DELETE an item by ID
app.delete('/api/items/:id', async (req, res) => {
  try {
    const deleted = await Item.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully', id: req.params.id, item: deleted });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ message: 'Failed to delete item', error: err.message });
  }
});

// GET specific person by their unique invitation code (public endpoint for guests)
app.get('/api/person/:code', async (req, res) => {
  try {
    const codeParam = (req.params.code || '').trim();
    if (!codeParam) {
      return res.status(400).json({ message: 'Code is required' });
    }

    const person = await Item.findOne({
      code: { $regex: new RegExp('^' + codeParam + '$', 'i') },
    });

    if (person) {
      res.json(person);
    } else {
      res.status(404).json({ message: 'Person not found' });
    }
  } catch (err) {
    console.error('Error finding person by code:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Server listener
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
