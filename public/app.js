const socket = io();

const balanceElement = document.getElementById('balance');
const tabButtons = document.querySelectorAll('.tab-button');
const chartPanels = document.querySelectorAll('.chart-panel');
const betHistoryElement = document.getElementById('betHistory');


const charts = {
    normal: {
        canvas: document.getElementById('normalChart'),
        ctx: null,
        chart: null,
        timeLabels: [],
        priceData: [],
        betAmount: document.getElementById('normalBetAmount'),
        betUpButton: document.getElementById('normalBetUp'),
        betDownButton: document.getElementById('normalBetDown'),
        betStatus: document.getElementById('normalBetStatus')
    },
    risky: {
        canvas: document.getElementById('riskyChart'),
        ctx: null,
        chart: null,
        timeLabels: [],
        priceData: [],
        betAmount: document.getElementById('riskyBetAmount'),
        betUpButton: document.getElementById('riskyBetUp'),
        betDownButton: document.getElementById('riskyBetDown'),
        betStatus: document.getElementById('riskyBetStatus')
    },
    extreme: {
        canvas: document.getElementById('extremeChart'),
        ctx: null,
        chart: null,
        timeLabels: [],
        priceData: [],
        betAmount: document.getElementById('extremeBetAmount'),
        betUpButton: document.getElementById('extremeBetUp'),
        betDownButton: document.getElementById('extremeBetDown'),
        betStatus: document.getElementById('extremeBetStatus')
    }
};


let chartTypes = {};


function initCharts() {
    Object.keys(charts).forEach(chartType => {
        const chartConfig = charts[chartType];
        chartConfig.ctx = chartConfig.canvas.getContext('2d');
        
        chartConfig.chart = new Chart(chartConfig.ctx, {
            type: 'bar',
            data: {
                labels: chartConfig.timeLabels,
                datasets: [{
                    label: 'Цена',
                    data: chartConfig.priceData,
                    borderColor: getChartColor(chartType),
                    backgroundColor: getChartBackgroundColor(chartType),
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointHoverBackgroundColor: getChartColor(chartType),
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Время'
                        },
                        ticks: {
                            maxTicksLimit: 10,
                            color: '#aaa',
                            callback: function(value, index, values) {
                                if (chartConfig.timeLabels[index]) {
                                    const date = new Date(chartConfig.timeLabels[index]);
                                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                }
                                return '';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Цена',
                            color: '#aaa'
                        },
                        beginAtZero: false,
                        ticks: {
                            color: '#aaa'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Цена: ${context.parsed.y}`;
                            },
                            title: function(context) {
                                const date = new Date(chartConfig.timeLabels[context[0].dataIndex]);
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
    });
}


function getChartColor(chartType) {
    switch(chartType) {
        case 'normal':
            return '#3498db';
        case 'risky':
            return '#f39c12';
        case 'extreme':
            return '#e74c3c';
        default:
            return '#3498db';
    }
}


function getChartBackgroundColor(chartType) {
    switch(chartType) {
        case 'normal':
            return 'rgba(52, 152, 219, 0.1)';
        case 'risky':
            return 'rgba(243, 156, 18, 0.1)';
        case 'extreme':
            return 'rgba(231, 76, 60, 0.1)';
        default:
            return 'rgba(52, 152, 219, 0.1)';
    }
}


function updateChart(chartType, newTimeLabel, newPrice) {
    const chartConfig = charts[chartType];
    
    chartConfig.timeLabels.push(newTimeLabel);
    chartConfig.priceData.push(newPrice);
    
    if (chartConfig.timeLabels.length > 50) {
        chartConfig.timeLabels.shift();
        chartConfig.priceData.shift();
    }
    
    chartConfig.chart.update();
}


function formatCurrency(amount) {
    return amount.toFixed(2);
}


function addBetToHistory(bet) {
    const betRecord = document.createElement('div');
    betRecord.className = `bet-record ${bet.success ? 'win' : 'loss'}`;
    
    const betInfo = document.createElement('div');
    betInfo.className = 'bet-info';
    
    const chartTypeBadge = document.createElement('span');
    chartTypeBadge.className = `chart-type-badge ${bet.chartType}`;
    chartTypeBadge.textContent = chartTypes[bet.chartType].name;
    
    betInfo.appendChild(chartTypeBadge);
    betInfo.appendChild(document.createTextNode(
        ` Ставка ${bet.amount} на ${bet.direction === 'up' ? 'рост' : 'падение'}`
    ));
    
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
    
    if (betHistoryElement.children.length > 10) {
        betHistoryElement.removeChild(betHistoryElement.lastChild);
    }
}


function updateBalance(newBalance) {
    balanceElement.textContent = formatCurrency(newBalance);
}


function showBetStatus(chartType, message, isSuccess) {
    const statusElement = charts[chartType].betStatus;
    statusElement.textContent = message;
    statusElement.className = 'bet-status ' + (isSuccess ? 'success' : 'error');
    
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'bet-status';
    }, 5000);
}


tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const chartType = button.getAttribute('data-chart');
        
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        chartPanels.forEach(panel => panel.classList.remove('active'));
        document.getElementById(`${chartType}-panel`).classList.add('active');
    });
});

Object.keys(charts).forEach(chartType => {
    const chartConfig = charts[chartType];
    
    chartConfig.betUpButton.addEventListener('click', () => {
        const amount = parseFloat(chartConfig.betAmount.value);
        if (isNaN(amount) || amount <= 0) {
            showBetStatus(chartType, 'Пожалуйста, введите корректную сумму ставки', false);
            return;
        }
        
        socket.emit('placeBet', {
            chartType: chartType,
            direction: 'up',
            amount: amount
        });
        
        chartConfig.betUpButton.disabled = true;
        chartConfig.betDownButton.disabled = true;
        
        setTimeout(() => {
            chartConfig.betUpButton.disabled = false;
            chartConfig.betDownButton.disabled = false;
        }, 1000);
    });
    
    chartConfig.betDownButton.addEventListener('click', () => {
        const amount = parseFloat(chartConfig.betAmount.value);
        if (isNaN(amount) || amount <= 0) {
            showBetStatus(chartType, 'Пожалуйста, введите корректную сумму ставки', false);
            return;
        }
        
        socket.emit('placeBet', {
            chartType: chartType,
            direction: 'down',
            amount: amount
        });
        
        chartConfig.betUpButton.disabled = true;
        chartConfig.betDownButton.disabled = true;
        
        setTimeout(() => {
            chartConfig.betUpButton.disabled = false;
            chartConfig.betDownButton.disabled = false;
        }, 1000);
    });
});


socket.on('connect', () => {
    console.log('Connected to server');
});


socket.on('initialData', (data) => {
    chartTypes = data.chartTypes;
    
    Object.keys(data.priceData).forEach(chartType => {
        const chartHistory = data.priceData[chartType].priceHistory;
        chartHistory.forEach(point => {
            charts[chartType].timeLabels.push(point.time);
            charts[chartType].priceData.push(point.price);
        });
    });
    
    initCharts();
    
    updateBalance(data.balance);
});

socket.on('priceUpdate', (data) => {
    updateChart(data.chartType, data.time, data.price);
});

socket.on('betResult', (data) => {
    if (data.success) {
        showBetStatus(data.chartType || 'normal', data.message, true);
        updateBalance(data.newBalance);
    } else {
        showBetStatus(data.chartType || 'normal', data.message, false);
    }
});

socket.on('betResolved', (data) => {
    const bet = {
        chartType: data.chartType,
        direction: data.direction,
        amount: data.betAmount,
        success: data.success,
        winnings: data.winnings
    };
    
    addBetToHistory(bet);
    
    updateBalance(data.newBalance);
    
    if (data.success) {
        showBetStatus(data.chartType, `Ваша ставка выиграла! +${formatCurrency(data.winnings)}`, true);
    } else {
        showBetStatus(data.chartType, 'Ваша ставка проиграла', false);
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});
