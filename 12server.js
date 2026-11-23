const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("foodiehub.db");
const PORT = process.env.PORT || 3000;

db.exec(`
  CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    emoji TEXT NOT NULL,
    available INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    guests INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const count = db.prepare("SELECT COUNT(*) AS total FROM menu").get().total;
if (count === 0) {
  const add = db.prepare("INSERT INTO menu (name, category, price, emoji) VALUES (?, ?, ?, ?)");
  const items = [
    ["Margherita Pizza", "Pizza", 249, "🍕"],
    ["Farmhouse Pizza", "Pizza", 329, "🍕"],
    ["Classic Burger", "Burger", 149, "🍔"],
    ["Cheese Burger", "Burger", 189, "🍔"],
    ["White Sauce Pasta", "Pasta", 219, "🍝"],
    ["Red Sauce Pasta", "Pasta", 199, "🍝"],
    ["Cold Coffee", "Drinks", 99, "🥤"],
    ["Fresh Lime Soda", "Drinks", 79, "🍹"],
    ["Chocolate Brownie", "Dessert", 119, "🍫"]
  ];
  const insertMany = db.transaction(rows => rows.forEach(item => add.run(...item)));
  insertMany(items);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "style-src": ["'self'", "https://cdn.jsdelivr.net"],
      "img-src": ["'self'", "data:", "https://images.unsplash.com"]
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }));

// REST API: show menu and optional category/search filters.
app.get("/api/menu", (req, res) => {
  const search = String(req.query.search || "").trim().slice(0, 60);
  const category = String(req.query.category || "").trim().slice(0, 30);
  const rows = db.prepare(`
    SELECT id, name, category, price, emoji
    FROM menu
    WHERE available = 1 AND name LIKE ? AND category LIKE ?
    ORDER BY category, name
  `).all(`%${search}%`, `%${category}%`);
  res.json(rows);
});

// REST API: create a food order.
app.post("/api/orders", (req, res) => {
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const cart = req.body.cart;

  if (name.length < 2 || name.length > 60) {
    return res.status(400).json({ error: "Enter a name between 2 and 60 characters." });
  }
  if (!/^[0-9]{10}$/.test(phone)) {
    return res.status(400).json({ error: "Enter a valid 10-digit phone number." });
  }
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 20) {
    return res.status(400).json({ error: "Your cart is empty or contains too many items." });
  }

  let total = 0;
  const orderItems = [];
  for (const item of cart) {
    const id = Number(item.id);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ error: "Invalid cart item." });
    }
    const food = db.prepare("SELECT id, name, price FROM menu WHERE id = ? AND available = 1").get(id);
    if (!food) return res.status(400).json({ error: "A selected food item is unavailable." });
    total += food.price * quantity;
    orderItems.push({ id: food.id, name: food.name, price: food.price, quantity });
  }

  const result = db.prepare(
    "INSERT INTO orders (customer_name, phone, items, total) VALUES (?, ?, ?, ?)"
  ).run(name, phone, JSON.stringify(orderItems), total);

  res.status(201).json({
    message: "Your order has been placed successfully!",
    orderId: result.lastInsertRowid,
    total
  });
});

// REST API: save a table reservation.
app.post("/api/reservations", (req, res) => {
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const date = String(req.body.date || "");
  const time = String(req.body.time || "");
  const guests = Number(req.body.guests);

  if (name.length < 2 || name.length > 60) {
    return res.status(400).json({ error: "Enter a valid name." });
  }
  if (!/^[0-9]{10}$/.test(phone)) {
    return res.status(400).json({ error: "Enter a valid 10-digit phone number." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !["12:00", "13:00", "14:00", "18:00", "19:00", "20:00", "21:00"].includes(time)) {
    return res.status(400).json({ error: "Choose a valid date and available time." });
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > 12) {
    return res.status(400).json({ error: "Guest count must be between 1 and 12." });
  }

  const result = db.prepare(`
    INSERT INTO reservations (customer_name, phone, booking_date, booking_time, guests)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, phone, date, time, guests);

  res.status(201).json({
    message: "Your table reservation has been saved!",
    reservationId: result.lastInsertRowid
  });
});

app.get("/api/health", (req, res) => res.json({ status: "OK" }));

app.listen(PORT, () => console.log(`FoodieHub is running at http://localhost:${PORT}`));
