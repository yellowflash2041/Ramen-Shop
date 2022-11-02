var express = require('express');
var mongoose = require('mongoose');
var yahooFinance = require('yahoo-finance');
var chalk = require('chalk');
console.log(chalk.bgBlue.white('Initializing Socket.IO...'));
var Stocklist = require('./../models/stocklist.js');
var router = express.Router();
var io = global.io;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'StockWatch' });
});

router.post('/fetchCharts', (req, res, next) => {
  console.dir(req.body);
  const queryArr = [];
  const objKeys = Object.keys(req.body);
  for (let i = 0; i < objKeys.length; i++) {
    // The data from the client must be in an Object, but the data we query stocks for must be an array...
    queryArr.push(req.body[objKeys[i]]);
  }

  const tmpDate = new Date();
  const fromDate = tmpDate.setDate(tmpDate.getDate() - 30);
  const fromDateFormatted = (new Date(fromDate)).toISOString().split('T')[0];
  const toDateFormatted = (new Date()).toISOString().split('T')[0];

  yahooFinance.historical({
    symbols: queryArr,
    from: fromDateFormatted,
    to: toDateFormatted,
    period: 'd'
  }, (err, quotes) => {
    res.json(quotes);
  });
});

// Returns the stocks currently added
router.get('/fetchStocks', (req, res, next) => {
  Stocklist.find({}, (err, stocklist) => {
    if (err) {
      console.error(err);
    }
    if (stocklist.stocks) {
      const jsonStr = {}; // Empty object for AJAX
      for (let i = 0; i < stocklist.stocks.length; i++) {
        jsonStr[i] = stocklist.stocks[i];
      }
      res.json(jsonStr);
    }
  });
});

io.on('connection', socket => {
  socket.on('stockadd', function(stockSymbol) {
    Stocklist.findOne({
      stocks: { $nin: [stockSymbol] }, // $nin = NOT IN
      name: 'stock-list' 
    }, (err, stocklist) => {
      if (err) {
        console.error(err);
      }
      if (stocklist) {
        stocklist.stocks.push(stockSymbol);
        stocklist.save(err => {
          if (err) {
            console.error(err);
          }
          // Send that broadcast to everyone...
          io.emit('stockadd', stockSymbol);
        });
      } else {
        console.error('No document found...');
      }
    });        
  });
  socket.on('stockremove', stockSymbol => {
    Stocklist.findOne({}, (err, stocklist) => {
      if (err) {
        console.error(err);
      }
      if (stocklist) {
        stocklist.stocks.pull(stockSymbol);
        stocklist.save(err => {
          if (err) {
            console.error(err);
          }
          // Send that broadcast to everyone...
          io.emit('stockremove', stockSymbol);
        });
      }
    });
  });
});

module.exports = router;
