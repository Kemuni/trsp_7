const socket = io();

const balanceElement = document.getElementById('balance');
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
                    label: chartTypes[chartType].name,
                    data: chartConfig.priceData,
                    backgroundColor: getChartBackgroundColor(chartType),
                    borderColor: getChartColor(chartType),
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
                            maxTicksLimit: 5
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Цена'
                        },
                        suggestedMin: 50,
                        suggestedMax: 150
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `Цена: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 500
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    });
}


function getChartColor(chartType) {
    switch(chartType) {
        case 'normal':
            return '#0d6efd';
        case 'risky':
            return '#fd7e14';
        case 'extreme':
            return '#dc3545';
        default:
            return '#0d6efd';
    }
}


function getChartBackgroundColor(chartType) {
    switch(chartType) {
        case 'normal':
            return 'rgba(13, 110, 253, 0.2)';
        case 'risky':
            return 'rgba(253, 126, 20, 0.2)';
        case 'extreme':
            return 'rgba(220, 53, 69, 0.2)';
        default:
            return 'rgba(13, 110, 253, 0.2)';
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
    
    const betDirection = document.createElement('span');
    betDirection.textContent = ` Ставка ${bet.direction === 'up' ? 'ВВЕРХ' : 'ВНИЗ'}: ${formatCurrency(bet.amount)}`;
    
    betInfo.appendChild(chartTypeBadge);
    betInfo.appendChild(betDirection);
    
    const betResult = document.createElement('div');
    betResult.className = 'bet-result';
    betResult.textContent = bet.success ? `+${formatCurrency(bet.winnings)}` : `-${formatCurrency(bet.amount)}`;
    
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
    statusElement.className = isSuccess ? 'bet-status success alert alert-success' : 'bet-status error alert alert-danger';
    
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'bet-status';
    }, 5000);
}


document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(button => {
    button.addEventListener('shown.bs.tab', event => {
        const chartType = event.target.getAttribute('data-chart');
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
            charts[chartType].timeLabels.push(new Date(point.time).toLocaleTimeString());
            charts[chartType].priceData.push(point.price);
        });
    });
    
    initCharts();
    
    updateBalance(data.balance);
});

socket.on('priceUpdate', (data) => {
    updateChart(data.chartType, new Date(data.time).toLocaleTimeString(), data.price);
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
        showBetStatus(data.chartType, `Ваша ставка проиграла! -${formatCurrency(data.betAmount)}`, false);
    }
});
