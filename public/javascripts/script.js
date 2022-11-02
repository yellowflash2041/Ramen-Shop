let stockList; // Globals, for easy debugging...
let socket;
let parEle;
let stocksObj;
let stocksArr = [];
let chartData;

let chart;
let cMargin;
let cWidth;
let cHeight;

const ttWidth = 50; // Tooltip width
const ttHeight = 50;

let x;
let xAxis;

let y;
let yAxis;
let yDomain;

$(() => { // Document ready
  $('.tooltip-wrapper').tooltip(); // Turn on Bootstrap tooltips...

  $.ajax({
    method: 'GET',
    url: '/fetchStocks'
  })
  .done(data => {
    stocksObj = data;
    const objKeys = Object.keys(data);
    const objLength = objKeys.length;
    for (let i = 0; i < objLength; i++) {
      addStock(data[objKeys[i]]);
    }
  });

  const sioConStr = document.location.protocol + '//' + document.location.host;

  socket = io.connect(sioConStr);

  socket.on('stockadd', stockSymbol => {
    addStock(stockSymbol);
  });

  socket.on('stockremove', stockSymbol => {
    removeStock(stockSymbol);
  });

  const errFlash = () => {
    $('#add_new')[0].style.backgroundColor = '#aa0000';
    setTimeout(() => {
      $('#add_new')[0].removeAttribute('style');
    }, 1000);
  };

  $('#stock_list').on('click', 'span.close', () => {
    parEle = this.parentElement;
    const stock2Remove = $(parEle).find('.stock_name')[0].innerText;
    socket.emit('stockremove', stock2Remove);
  });

  $('#button_add').click(() => {
    if ($('#input_add')[0].value.length === 0) {
      errFlash();
      return false;
    }
    const addedStock = $("#input_add")[0].value;

    socket.emit('stockadd', addedStock);
    $('#input_add')[0].value = '';
  });

  $('#button_draw').click(() => {
    $('#sd_warning')[0].style.display = 'none';
    $('#chart')[0].style.display = 'block';
    chartInit();
  })

  $('#input_add').keypress(e => {
    if (e.keyCode === 13) { // Enter key
      $('#button_add')[0].click();
    }
  });

  $('#button_fetch').click(() => {
    const stockElems = $('.stock_name').contents();
    const stockObj = {};
    for (let i = 0; i < stockElems.length; i++) {
      stockObj[`stock_${i}`] = stockElems[i].textContent;
    }
    $.ajax({
      method: 'POST',
      data: stockObj,
      url: 'fetchCharts'
    })
    .done(data => {
      console.dir(data);
      chartData = data;
      console.info('%c Chart data copied to chartData', 'color: blue; font-size: 14px;');
      updateStockStatus();    
    });
  });

  // Update the UI feedback for stocks to show if data is pending or ready
  const updateStockStatus = () => {
    for (let i = 0; i < $('.stock_name').length; i++) {
      const curSymbol = $('.stock_name')[i].innerText;

      // We have the symbol and results
      if (chartData.hasOwnProperty(curSymbol) && chartData[curSymbol].length > 0) {
        $($('.stock_name')[i].parentElement).removeClass('data_pending').addClass('data_ready');
        allowDraw();
      }

      // We have the symbol, but no data was returned
      if (chartData.hasOwnProperty(curSymbol) && chartData[curSymbol].length === 0) {
        $($('.stock_name')[i].parentElement).removeClass('data_pending').addClass('data_unavailable');
      }
    }
  };

  const allowDraw = () => {
    $('#draw_warning').removeClass('disabled');
    $('#button_draw').removeAttr('disabled');
    // Removes the Bootstrap tooltip warning a chart cannot be drawn before data is fetched
    $('#draw_warning').tooltip('disable');
  }

  const addStock = symbol => {
    if (stocksArr.indexOf(symbol) !== -1) {
      console.info(`Stock ${symbol} already added.`);
      return false; 
    }
    const newDiv = $('<div class="col-md-4"></div>');
    newDiv.append('<span class="close">x</span>');
    const stockDiv = $('<div class="stock_name"></div>');
    stockDiv[0].innerText = symbol;
    stockDiv[0].dataset.snid = symbol; // SNID = Stock Name ID, stored in HTML5 data-* attr
    newDiv.append(stockDiv);
    if (
      typeof chartData == "undefined" ||
      !chartData.hasOwnProperty(symbol) ||
      chartData[symbol].length === 0
    ) {
      newDiv.addClass('data_pending');
    } else {
      newDiv.addClass('data_ready');
    }
    $('#stock_list').append(newDiv);
    updateStockList();
  };

  const removeStock = symbol => {
    $(`.stock_name:contains(${symbol})`)[0].parentElement.remove();
    const symIndex = stocksArr.indexOf(symbol);
    if (typeof symIndex === 'number') {
      stocksArr.splice(symIndex, 1);
    }
  }

  const updateStockList = () => {
    stocksArr = [];
    const stockList = $('.stock_name');
    for (let i = 0; i < stockList.length; i++) {
      stocksArr.push(stockList[i].innerText);
    }
  };
});

let colors;
yDomain = [0, 100];
let tickerSymbols;
let yMin;
let yMax;
let interval;
let intervalMultiple;
let stockLine;

let tooltip; // Remove when done testing and place inside code...

var chartInit = function() {
  console.info(`D3 version is ${d3.version}`);

  if (
    typeof chartData !== 'object' ||
    Object.keys(chartData).length <= 0
  ) {
    console.error('%c chartData is not defined with 1 or more keys.  Unable to chartInit().', 'color: red; font-size: 16px;');
    return false;
  }

  colors = d3.scaleOrdinal(d3.schemeCategory10);

  const fromDate = new Date(chartData[Object.keys(chartData)[0]][0].date);
  const toDate = new Date(chartData[Object.keys(chartData)[0]][(chartData[Object.keys(chartData)[0]].length - 1)].date);
  const xDomain = [fromDate, toDate];
  console.dir(xDomain);

  tickerSymbols = Object.keys(chartData);

  // Init with the first values in the first stock, and go from there...
  let yMin = chartData[tickerSymbols[0]][0].low;
  let yMax = chartData[tickerSymbols[0]][0].high;  

  for (let i = 0; i < tickerSymbols.length; i++) {
    const symLength = chartData[tickerSymbols[i]].length;
    for (let i2 = 0; i2 < symLength; i2++) {
      if (chartData[tickerSymbols[i]][i2].low < yMin) {
        yMin = chartData[tickerSymbols[i]][i2].low;
      }
      if(chartData[tickerSymbols[i]][i2].high > yMax) {
        yMax = chartData[tickerSymbols[i]][i2].high;
      }
    }
  }

  const intervalMultiple = 5; // Means that intervals should be in multiples of 25 (e.g., 25, 50, 75, etc...)

  const interval = intervalMultiple * Math.ceil(yMax / yMin / intervalMultiple);

  let yStart;
  if (yMin < interval) {
    yStart = 0;
  } else {
    yStart = Math.floor(yMin / interval) * interval;
  }

  const yEnd = Math.ceil(yMax / interval) * interval;

  yDomain = [yStart, yEnd];

  $('#chart').empty();

  chart = d3.select('#chart');
  console.dir(chart);

  const chartDOM = $('#chart')[0];
  // Margins, which we'll subtract from the container dimensions defined in CSS
  const cMargin = { top: 20, right: 20, bottom: 10, left: 50 };
  cHeight = chartDOM.clientHeight - cMargin.top - cMargin.bottom;
  cWidth = chartDOM.clientWidth - cMargin.left - cMargin.right;

  // d3.time.scale() in v3 is d3.scaleTime() in v4
  x = d3.scaleTime().domain(xDomain).range([0, cWidth]);

  xAxis = d3.axisBottom(x).tickFormat(d3.timeFormat('%b %d'));

  y = d3.scaleLinear().domain(yDomain).range([cHeight, 0]);
  yAxis = d3.axisLeft(y);

  // Remember, in D3v4, it is d3.line and NOT d3.svg.line
  stockLine = d3.line()
  .x(d => {
    return x(new Date(d.date));
  })
  .y(d => {
    return y(d.close);
  });

  // Remember, you have to use .append on D3 selections, in order for it to work correctly...

  chart.append('g')
    .attr('class', 'x axis')
    .attr('transform', `translate(${cMargin.left}, ${cHeight})`)
    .call(xAxis);

  chart.append('g')
    .attr('class', 'y axis')
    .attr('transform', `translate(${cMargin.left}, 0)`)
    .call(yAxis);

  const fetchCol = (stockSym, x0) => {
    const xDate = new Date(x0);
    if (typeof chartData[stockSym] !== 'undefined') {
      for (let i = 0; i < chartData[stockSym].length; i++) {
        if (new Date(chartData[stockSym][i].date) > xDate) {
          return chartData[stockSym][i];
        }
      }
    }
  };

  /**
   * Provide UI feedback to the end-user on the stock he/she moused over on the chart
   */
  const stockAddUIFeedback = () => {
    // D3 binds to the DOM the data it used to graph the selected element. If we crawl back up to the __data__ property, we can determine which stock symbol the user is hovering over in the chart
    const stockSym = d3.select(this)._groups[0][0]['__data__'][0].symbol;
    const stockEle = $(`[data-snid="${stockSym}"]`)[0].parentElement;
    tooltip.select('#tt_stocksym').text(stockSym);
    $(stockEle).addClass('stockline_hover');
  };

  const stockRemoveUIFeedback = () => {
    // D3 binds to the DOM the data it used to graph the selected element. If we crawl back up to the __data__ property, we can determine which stock symbol the user is hovering over in the chart
    const stockSym = d3.select(this)._groups[0][0]['__data__'][0].symbol;
    const stockEle = $(`[data-snid="${stockSym}"]`)[0].parentElement;
    $(stockEle).removeClass('stockline_hover');
    tooltip.style('display', 'none');
  };

  const stockTooltipFeedback = () => {
    // This is the "X" value the cursor is hovered over. Remember, from chartInit(), these are Date objects
    let x0 = d3.mouse(this)[0];
    const y0 = d3.mouse(this)[1];
    let yd;
    if (y0 < $('#chart')[0].height.baseVal.value / 2) {
      yd = y0 + 15;
    } else {
      yd = y0 - 60;
    }
    console.dir(d3.mouse(this));
    tooltip.style('display', 'block'); // Makes visible, if hidden before
    tooltip.attr('transform', `translate(${x0}, ${yd})`);
    const stockSym = d3.select(this)._groups[0][0]['__data__'][0].symbol;
    x0 = x.invert(d3.mouse(this)[0]);
    const col = fetchCol(stockSym, x0);
    console.dir(col);
    const date = new Date(col.date);
    const dateText = `${date.getMonth() + 1}/${date.getDate()}`;
    const ocText = `Op:${parseFloat(col.open).toFixed(2)} Cl:${parseFloat(col.close).toFixed(2)}`;
    tooltip.select('#tt_date').text(dateText);
    tooltip.select('#tt_oc').text(ocText);
  }

  for (let i = 0; i < tickerSymbols.length; i++) {
    if (chartData[tickerSymbols[i]].length > 0) {
      chart.append('path')
        .datum(chartData[tickerSymbols[i]])
        .attr('class', 'stock_line')
        .attr('transform', `translate(${cMargin.left}, 0)`)
        .attr('d', stockLine)
        .style('stroke', d => { return colors(i); })
        .on('mouseover', stockAddUIFeedback)
        .on('mouseout', stockRemoveUIFeedback)
        .on('mousemove', stockTooltipFeedback);
    }
  }

  tooltip = chart.append('g').attr('style', 'display: none;');
  tooltip.append('rect')
    .attr('class', 'hover_tip')
    .attr('width', ttWidth)
    .attr('height', ttHeight)
    .attr('rx', '20')
    .attr('ry', '20');
  tooltip.append('text')
    .attr('class', 'hover_tiptext')
    .attr('id', 'tt_stocksym')
    .attr('fill', 'black')
    .attr('dx', '1em')
    .attr('dy', '1em');
  tooltip.append('text')
    .attr('class', 'hover_tiptext')
    .attr('id', 'tt_date')
    .attr('fill', 'black')
    .attr('dx', '1em')
    .attr('dy', '2em');
  tooltip.append('text')
    .attr('class', 'hover_tiptext')
    .attr('id', 'tt_oc')
    .attr('fill', 'black')
    .attr('dx', '1em')
    .attr('dy', '3em');
};