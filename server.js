const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store user balances (in a real app, this would be in a database)
const userBalances = {};

// Generate random price data
function generateRandomPrice(lastPrice) {
  // Generate a random change between -5 and 5
  const change = (Math.random() - 0.5) * 10;
  // Calculate new price
  let newPrice = lastPrice + change;
  // Ensure price doesn't go below 10
  if (newPrice < 10) newPrice = 10;
  return parseFloat(newPrice.toFixed(2));
}

// Store active bets
const activeBets = {};

// Initialize price data
let currentPrice = 100;
let priceHistory = [{ time: Date.now(), price: currentPrice }];

// WebSocket connection
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Initialize user balance if not exists
  if (!userBalances[socket.id]) {
    userBalances[socket.id] = 1000; // Default starting balance
  }
  
  // Send initial data to the client
  socket.emit('initialData', {
    priceHistory: priceHistory,
    balance: userBalances[socket.id]
  });
  
  // Handle bet placement
  socket.on('placeBet', (data) => {
    const { direction, amount } = data;
    const betAmount = parseFloat(amount);
    
    // Validate bet
    if (isNaN(betAmount) || betAmount <= 0) {
      socket.emit('betResult', { success: false, message: 'Invalid bet amount' });
      return;
    }
    
    if (betAmount > userBalances[socket.id]) {
      socket.emit('betResult', { success: false, message: 'Insufficient balance' });
      return;
    }
    
    // Place bet
    userBalances[socket.id] -= betAmount;
    
    // Store bet
    activeBets[socket.id] = {
      direction,
      amount: betAmount,
      priceAtBet: currentPrice,
      timestamp: Date.now()
    };
    
    socket.emit('betResult', { 
      success: true, 
      message: `Bet placed: ${direction} with ${betAmount}`,
      newBalance: userBalances[socket.id]
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // Clean up any active bets
    delete activeBets[socket.id];
  });
});

// Update price and resolve bets every 5 seconds
setInterval(() => {
  // Generate new price
  const previousPrice = currentPrice;
  currentPrice = generateRandomPrice(currentPrice);
  
  // Add to price history
  priceHistory.push({ time: Date.now(), price: currentPrice });
  
  // Keep only the last 50 price points
  if (priceHistory.length > 50) {
    priceHistory.shift();
  }
  
  // Resolve bets
  Object.keys(activeBets).forEach(socketId => {
    const bet = activeBets[socketId];
    const socket = io.sockets.sockets.get(socketId);
    
    if (!socket) return; // Skip if socket is no longer connected
    
    // Determine if bet wins
    const priceWentUp = currentPrice > previousPrice;
    const betWins = (bet.direction === 'up' && priceWentUp) || 
                   (bet.direction === 'down' && !priceWentUp);
    
    // Calculate winnings
    let winnings = 0;
    if (betWins) {
      winnings = bet.amount * 1.9; // 90% profit
    }
    
    // Update balance
    userBalances[socketId] += winnings;
    
    // Notify client
    socket.emit('betResolved', {
      success: betWins,
      winnings: winnings,
      newBalance: userBalances[socketId],
      previousPrice: previousPrice,
      currentPrice: currentPrice
    });
    
    // Remove resolved bet
    delete activeBets[socketId];
  });
  
  // Broadcast new price to all clients
  io.emit('priceUpdate', {
    time: Date.now(),
    price: currentPrice
  });
  
}, 5000);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
