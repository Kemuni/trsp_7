// Connect to the server via Socket.io
const socket = io();

// DOM elements
const balanceElement = document.getElementById('balance');
const betAmountInput = document.getElementById('betAmount');
const betUpButton = document.getElementById('betUp');
const betDownButton = document.getElementById('betDown');
const betStatusElement = document.getElementById('betStatus');
const betHistoryElement = document.getElementById('betHistory');
const chartCanvas = document.getElementById('priceChart');

// Chart configuration
const ctx = chartCanvas.getContext('2d');
let priceChart;
let priceData = [];
let timeLabels = [];

// Initialize the chart
function initChart() {
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [{
                label: 'Цена',
                data: priceData,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#3498db',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Время'
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        callback: function(value, index, values) {
                            if (timeLabels[index]) {
                                const date = new Date(timeLabels[index]);
                                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            }
                            return '';
                        }
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Цена'
                    },
                    beginAtZero: false
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Цена: ${context.parsed.y}`;
                        },
                        title: function(context) {
                            const date = new Date(timeLabels[context[0].dataIndex]);
                            return date.toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit' 
                            });
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            animation: {
                duration: 500
            }
        }
    });
}

// Update chart with new data
function updateChart(newTimeLabel, newPrice) {
    // Add new data
    timeLabels.push(newTimeLabel);
    priceData.push(newPrice);
    
    // Keep only the last 50 data points
    if (timeLabels.length > 50) {
        timeLabels.shift();
        priceData.shift();
    }
    
    // Update chart
    priceChart.update();
}

// Format currency
function formatCurrency(amount) {
    return amount.toFixed(2);
}

// Add bet to history
function addBetToHistory(bet) {
    const betRecord = document.createElement('div');
    betRecord.className = `bet-record ${bet.success ? 'win' : 'loss'}`;
    
    const betInfo = document.createElement('div');
    betInfo.className = 'bet-info';
    betInfo.textContent = `Ставка ${bet.amount} на ${bet.direction === 'up' ? 'рост' : 'падение'}`;
    
    const betResult = document.createElement('div');
    betResult.className = 'bet-result';
    if (bet.success) {
        betResult.textContent = `Выигрыш: +${formatCurrency(bet.winnings)}`;
    } else {
        betResult.textContent = 'Проигрыш';
    }
    
    betRecord.appendChild(betInfo);
    betRecord.appendChild(betResult);
    
    betHistoryElement.prepend(betRecord);
    
    // Keep only last 10 records
    if (betHistoryElement.children.length > 10) {
        betHistoryElement.removeChild(betHistoryElement.lastChild);
    }
}

// Update balance display
function updateBalance(newBalance) {
    balanceElement.textContent = formatCurrency(newBalance);
}

// Show bet status message
function showBetStatus(message, isSuccess) {
    betStatusElement.textContent = message;
    betStatusElement.className = 'bet-status ' + (isSuccess ? 'success' : 'error');
    
    // Clear message after 5 seconds
    setTimeout(() => {
        betStatusElement.textContent = '';
        betStatusElement.className = 'bet-status';
    }, 5000);
}

// Event listeners for bet buttons
betUpButton.addEventListener('click', () => {
    const amount = parseFloat(betAmountInput.value);
    if (isNaN(amount) || amount <= 0) {
        showBetStatus('Пожалуйста, введите корректную сумму ставки', false);
        return;
    }
    
    socket.emit('placeBet', {
        direction: 'up',
        amount: amount
    });
    
    // Disable buttons temporarily
    betUpButton.disabled = true;
    betDownButton.disabled = true;
    
    setTimeout(() => {
        betUpButton.disabled = false;
        betDownButton.disabled = false;
    }, 1000);
});

betDownButton.addEventListener('click', () => {
    const amount = parseFloat(betAmountInput.value);
    if (isNaN(amount) || amount <= 0) {
        showBetStatus('Пожалуйста, введите корректную сумму ставки', false);
        return;
    }
    
    socket.emit('placeBet', {
        direction: 'down',
        amount: amount
    });
    
    // Disable buttons temporarily
    betUpButton.disabled = true;
    betDownButton.disabled = true;
    
    setTimeout(() => {
        betUpButton.disabled = false;
        betDownButton.disabled = false;
    }, 1000);
});

// Socket.io event handlers
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('initialData', (data) => {
    // Initialize price data
    data.priceHistory.forEach(point => {
        timeLabels.push(point.time);
        priceData.push(point.price);
    });
    
    // Initialize chart
    initChart();
    
    // Update balance
    updateBalance(data.balance);
});

socket.on('priceUpdate', (data) => {
    updateChart(data.time, data.price);
});

socket.on('betResult', (data) => {
    if (data.success) {
        showBetStatus(data.message, true);
        updateBalance(data.newBalance);
    } else {
        showBetStatus(data.message, false);
    }
});

socket.on('betResolved', (data) => {
    // Create bet record
    const bet = {
        direction: data.previousPrice < data.currentPrice ? 'up' : 'down',
        amount: (data.success ? data.winnings / 1.9 : data.winnings), // Calculate original bet amount
        success: data.success,
        winnings: data.winnings
    };
    
    // Add to history
    addBetToHistory(bet);
    
    // Update balance
    updateBalance(data.newBalance);
    
    // Show status message
    if (data.success) {
        showBetStatus(`Ваша ставка выиграла! +${formatCurrency(data.winnings)}`, true);
    } else {
        showBetStatus('Ваша ставка проиграла', false);
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});
