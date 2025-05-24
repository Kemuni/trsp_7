const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const userBalances = {};

const chartTypes = {
  normal: {
    name: 'Нормальный',
    winMultiplier: 1.9,
    volatility: 1.0,
    description: 'Стандартный риск, выигрыш x1.9'
  },
  risky: {
    name: 'Рискованный',
    winMultiplier: 3.0,
    volatility: 1.5,
    description: 'Средний риск, выигрыш x3.0'
  },
  extreme: {
    name: 'Экстремальный',
    winMultiplier: 5.0,
    volatility: 2.5,
    description: 'Высокий риск, выигрыш x5.0'
  }
};


function generateRandomPrice(lastPrice, volatility = 1.0) {
  // Добавляем псевдоволатильность
  const change = (Math.random() - 0.5) * 10 * volatility;
  let newPrice = lastPrice + change;
  if (newPrice < 10) newPrice = 10;
  return parseFloat(newPrice.toFixed(2));
}


const activeBets = {};


const priceData = {
  normal: {
    currentPrice: 100,
    priceHistory: [{ time: Date.now(), price: 100 }]
  },
  risky: {
    currentPrice: 100,
    priceHistory: [{ time: Date.now(), price: 100 }]
  },
  extreme: {
    currentPrice: 100,
    priceHistory: [{ time: Date.now(), price: 100 }]
  }
};


io.on('connection', (socket) => {
  console.log('New client connected');
  

  // Для новых пользователей
  if (!userBalances[socket.id]) {
    userBalances[socket.id] = 1000;
  }


  socket.emit('initialData', {
    priceData: priceData,
    balance: userBalances[socket.id],
    chartTypes: chartTypes
  });
  

  // Ставят ставочку
  socket.on('placeBet', (data) => {
    const { chartType, direction, amount } = data;
    const betAmount = parseFloat(amount);

    if (!chartTypes[chartType]) {
      socket.emit('betResult', { success: false, message: 'Такого графика не существует' });
      return;
    }

    if (isNaN(betAmount) || betAmount <= 0) {
      socket.emit('betResult', { success: false, message: 'Неверная сумма ставки' });
      return;
    }
    
    if (betAmount > userBalances[socket.id]) {
      socket.emit('betResult', { success: false, message: 'Недостаточно средств' });
      return;
    }

    userBalances[socket.id] -= betAmount;

    if (!activeBets[socket.id]) {
      activeBets[socket.id] = [];
    }
    
    activeBets[socket.id].push({
      chartType,
      direction,
      amount: betAmount,
      priceAtBet: priceData[chartType].currentPrice,
      timestamp: Date.now()
    });
    
    socket.emit('betResult', { 
      success: true, 
      message: `Ставка поставлена на ${chartTypes[chartType].name}: ${direction} суммой ${betAmount}`,
      newBalance: userBalances[socket.id]
    });
  });


  socket.on('disconnect', () => {
    console.log('Client disconnected');
    delete activeBets[socket.id];
  });
});


// Каждые N время делаем
setInterval(() => {
  // Двигаем графики
  Object.keys(chartTypes).forEach(chartType => {
    const volatility = chartTypes[chartType].volatility;
    const previousPrice = priceData[chartType].currentPrice;
    priceData[chartType].currentPrice = generateRandomPrice(previousPrice, volatility);

    priceData[chartType].priceHistory.push({ 
      time: Date.now(), 
      price: priceData[chartType].currentPrice 
    });

    if (priceData[chartType].priceHistory.length > 50) {
      priceData[chartType].priceHistory.shift();
    }

    io.emit('priceUpdate', {
      chartType: chartType,
      time: Date.now(),
      price: priceData[chartType].currentPrice
    });
  });
  

  // Проверяем ставки
  Object.keys(activeBets).forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;
    
    const clientBets = activeBets[socketId];
    if (!clientBets || clientBets.length === 0) return;

    const resolvedBets = [];
    
    clientBets.forEach(bet => {
      const chartType = bet.chartType;
      const previousPrice = bet.priceAtBet;
      const currentPrice = priceData[chartType].currentPrice;

      const priceWentUp = currentPrice > previousPrice;
      const betWins = (bet.direction === 'up' && priceWentUp) || 
                     (bet.direction === 'down' && !priceWentUp);

      let winnings = 0;
      if (betWins) {
        winnings = bet.amount * chartTypes[chartType].winMultiplier;
      }
      
      userBalances[socketId] += winnings;
      
      socket.emit('betResolved', {
        chartType: chartType,
        success: betWins,
        betAmount: bet.amount,
        winnings: winnings,
        newBalance: userBalances[socketId],
        previousPrice: previousPrice,
        currentPrice: currentPrice,
        direction: bet.direction
      });
      
      resolvedBets.push(bet);
    });
    
    activeBets[socketId] = clientBets.filter(bet => !resolvedBets.includes(bet));
  });
  
}, 2000);


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
