const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB ✅"))
  .catch((err) => console.error("MongoDB connection error ❌:", err));

// 2. Define a Simple Schema & Model
const ItemSchema = new mongoose.Schema({
  code: String,
  name: String,
  adname: String,
  stext: String,
});
const Item = mongoose.model('Item', ItemSchema);

// 3. API Routes
app.get('/api/items', async (req, res) => {
  const items = await Item.find();
  res.json(items);
});

app.post('/api/items', async (req, res) => {
  const newItem = new Item(req.body);
  await newItem.save();
  res.status(201).json(newItem);
});

// Get a specific person by their unique code
app.get('/api/person/:code', async (req, res) => {
  try {
    // This finds the code regardless of Uppercase/Lowercase
    const person = await Item.findOne({ 
      code: { $regex: new RegExp("^" + req.params.code + "$", "i") } 
    });
    
    if (person) {
      res.json(person);
    } else {
      res.status(404).json({ message: "Person not found" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


//server port
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
