const menuList = document.getElementById("menuList");
const menuMessage = document.getElementById("menuMessage");
const searchInput = document.getElementById("search");
const categoryInput = document.getElementById("category");
const cart = [];

function money(value) {
  return "₹" + Number(value).toFixed(0);
}

async function loadMenu() {
  menuMessage.textContent = "Loading menu...";
  try {
    const query = new URLSearchParams({
      search: searchInput.value,
      category: categoryInput.value
    });
    const response = await fetch("/api/menu?" + query);
    if (!response.ok) throw new Error("Unable to load menu.");
    const foods = await response.json();
    menuList.replaceChildren();
    menuMessage.textContent = foods.length + " food item(s) available.";

    foods.forEach(food => {
      const column = document.createElement("div");
      column.className = "col-sm-6 col-lg-4";
      const card = document.createElement("article");
      card.className = "food-card";
      const emoji = document.createElement("div");
      emoji.className = "food-emoji";
      emoji.textContent = food.emoji;
      const info = document.createElement("div");
      info.className = "food-info";
      const title = document.createElement("h3");
      title.textContent = food.name;
      const category = document.createElement("p");
      category.className = "text-muted small";
      category.textContent = food.category;
      const bottom = document.createElement("div");
      bottom.className = "food-bottom";
      const price = document.createElement("span");
      price.className = "food-price";
      price.textContent = money(food.price);
      const button = document.createElement("button");
      button.className = "btn btn-dark btn-sm";
      button.textContent = "Add to Cart";
      button.addEventListener("click", () => addToCart(food));
      bottom.append(price, button);
      info.append(title, category, bottom);
      card.append(emoji, info);
      column.append(card);
      menuList.append(column);
    });
  } catch (error) {
    menuMessage.textContent = error.message;
  }
}

function addToCart(food) {
  const existing = cart.find(item => item.id === food.id);
  if (existing) existing.quantity += 1;
  else cart.push({ id: food.id, name: food.name, price: food.price, quantity: 1 });
  renderCart();
}

function renderCart() {
  const cartItems = document.getElementById("cartItems");
  cartItems.replaceChildren();
  if (cart.length === 0) cartItems.textContent = "Your cart is empty.";

  let total = 0;
  let count = 0;
  cart.forEach(item => {
    total += item.price * item.quantity;
    count += item.quantity;
    const row = document.createElement("div");
    row.className = "cart-row";
    const label = document.createElement("span");
    label.textContent = `${item.name} × ${item.quantity} — ${money(item.price * item.quantity)}`;
    const controls = document.createElement("div");
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "Decrease quantity");
    minus.addEventListener("click", () => changeQuantity(item.id, -1));
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "Increase quantity");
    plus.addEventListener("click", () => changeQuantity(item.id, 1));
    controls.append(minus, document.createTextNode(" "), plus);
    row.append(label, controls);
    cartItems.append(row);
  });
  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartTotal").textContent = money(total);
}

function changeQuantity(id, amount) {
  const item = cart.find(food => food.id === id);
  if (!item) return;
  item.quantity += amount;
  if (item.quantity <= 0) cart.splice(cart.indexOf(item), 1);
  renderCart();
}

document.getElementById("orderForm").addEventListener("submit", async event => {
  event.preventDefault();
  const message = document.getElementById("orderMessage");
  if (cart.length === 0) {
    message.textContent = "Please add food items to your cart first.";
    return;
  }
  const payload = {
    name: document.getElementById("customerName").value.trim(),
    phone: document.getElementById("customerPhone").value.trim(),
    cart: cart.map(item => ({ id: item.id, quantity: item.quantity }))
  };
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Order could not be placed.");
    message.textContent = `${result.message} Order number: ${result.orderId}. Total: ${money(result.total)}.`;
    cart.length = 0;
    renderCart();
    event.target.reset();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.getElementById("reservationForm").addEventListener("submit", async event => {
  event.preventDefault();
  const message = document.getElementById("reservationMessage");
  const payload = {
    name: document.getElementById("resName").value.trim(),
    phone: document.getElementById("resPhone").value.trim(),
    date: document.getElementById("resDate").value,
    time: document.getElementById("resTime").value,
    guests: Number(document.getElementById("guests").value)
  };
  try {
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Reservation failed.");
    message.textContent = `${result.message} Booking number: ${result.reservationId}.`;
    event.target.reset();
  } catch (error) {
    message.textContent = error.message;
  }
});

searchInput.addEventListener("input", loadMenu);
categoryInput.addEventListener("change", loadMenu);

// Set today's date as the earliest reservation date.
const dateInput = document.getElementById("resDate");
const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
  .toISOString().split("T")[0];
dateInput.min = localDate;

loadMenu();
renderCart();
