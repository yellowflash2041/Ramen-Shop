const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const stocklistSchema = new Schema({
  name: String,
  stocks: Array
}, {
  collection: 'fcc-chartsm'
});

module.exports = mongoose.model('Stocklist', stocklistSchema);