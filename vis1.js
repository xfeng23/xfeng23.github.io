var mapResources = {
  basemap: "us_states.geojson",
  salesDiff: "cityLocation+SalesDiff.csv",
  salesDiff10Year: "salesDifference10y.csv",
  rentalDiff: "cityLocation+rentalDiff.csv",
  rentalDiff10Year: "rentalDifference10y.csv"
};

// Color scheme by Tableau
const colors = {
  "salesDiff": "#1d7e49",
  "rentalDiff": "#01519b",
}

// Setup color scale
const colorScale = d3.scaleOrdinal()
.range(Object.entries(colors).map(e => e[1]))
.domain(Object.entries(colors).map(e => e[0]));

var svg = d3.select("body").select("svg#vis");

var attr = {
  margin: {
    top: 25,
    right: 160
  },
  plotWidth: svg.node().getBoundingClientRect().width,
  plotHeight: svg.node().getBoundingClientRect().height,
}

var g = {
  basemap: svg.select("g#basemap"),
  outline: svg.select("g#outline"),
  salesDiff: svg.select("g#salesDiff"),
  rentalDiff: svg.select("g#rentalDiff"),
  tooltip: svg.select("g#tooltip"),
  details: svg.select("g#details")
};

// setup tooltip (shows U.S. states names)
var tip = g.tooltip.append("text").attr("id", "tooltip");
tip.attr("text-anchor", "end");
tip.attr("dx", -5);
tip.attr("dy", -5);
tip.style("visibility", "hidden");

// add details widget
// https://bl.ocks.org/mbostock/1424037
var details = g.details.append("foreignObject")
.attr("id", "details")
.attr("width", attr.plotWidth)
.attr("height", attr.plotHeight)
.attr("x", 0)
.attr("y", 0);

var body = details.append("xhtml:body")
.style("text-align", "left")
.style("background", "none")
.html("<p>N/A</p>");

details.style("visibility", "hidden");

// setup projection
// D3 Projection
var projection = d3.geoAlbersUsa()
.translate([attr.plotWidth/2, attr.plotHeight/2])    // translate to center of screen
.scale([1000]);          // scale things down so see entire US

// setup path generator
var path = d3.geoPath().projection(projection);

d3.json(mapResources.basemap).then(function(json) {
  // makes sure to adjust projection to fit all of our regions
  projection.fitSize([attr.plotWidth, attr.plotHeight], json);

  // draw the land and neighborhood outlines
  drawBasemap(json);
  // now that projection has been set trigger loading the other files
  d3.csv(mapResources.salesDiff).then(function(d1){
    d3.csv(mapResources.salesDiff10Year).then(function(d2){
      difference = {}
      d2.forEach(function(d) {
        entries = []
        for(var p in d){
          if (p != "City"){
            entries.push({
              years:p,
              diffs:+d[p]
            })
          }
        }
        difference[d.City] = entries
      });
      console.log(difference)
      drawSalesDiff(d1, difference);
    });
  });
});


function drawBasemap(json) {
  //console.log("basemap", json);

  let basemap = g.basemap.selectAll("path.land")
  .data(json.features)
  .enter()
  .append("path")
  .attr("d", path)
  .attr("class", "land");

  let outline = g.outline.selectAll("path.neighborhood")
  .data(json.features)
  .enter()
  .append("path")
  .attr("d", path)
  .attr("class", "neighborhood")
  .each(function(d) {
    // save selection in data for interactivity
    // saves search time finding the right outline later
    d.properties.outline = this;
  });

  // add highlight
  basemap.on("mouseover.highlight", function(d) {
    //console.log(d)
    d3.select(d.properties.outline).raise();
    d3.select(d.properties.outline).classed("active", true);
  })
  .on("mouseout.highlight", function(d) {
    d3.select(d.properties.outline).classed("active", false);
  });

  // add tooltip
  basemap.on("mouseover.tooltip", function(d) {
    tip.text(d.properties.name);
    tip.style("visibility", "visible");
  })
  .on("mousemove.tooltip", function(d) {
    var coords = d3.mouse(g.basemap.node());
    tip.attr("x", coords[0]);
    tip.attr("y", coords[1]);
  })
  .on("mouseout.tooltip", function(d) {
    tip.style("visibility", "hidden");
  });
}


function drawSalesDiff(data1, difference) {
  //console.log("salesDiff", data);
  // loop through and add projected (x, y) coordinates
  // (just makes our d3 code a bit more simple later)
  console.log(data1)
  data1.forEach(function(d) {
    let latitude = parseFloat(d.Latitude);
    let longitude = parseFloat(d.Longitude);
    let pixels = projection([longitude, latitude]);
    console.log(pixels);
    console.log(d.City);
    d.x = pixels[0];
    d.y = pixels[1];
  });

  var radius = d3.scaleLinear()
  .domain([-1e5, 1e5])
  .range([0, 5]);

  var tool_tip = d3.tip()
  .attr("class", "d3-tip")
  .offset([20, 20])
  .html("<div id='tipDiv'></div>");

  let symbols = g.salesDiff.selectAll("circle")
  .data(data1)
  .enter()
  .append("circle")
  .attr("cx", d => d.x)
  .attr("cy", d => d.y)
  .attr("r", d => radius(d.TenYrSalesDiff))
  .attr("class", "symbol")
  .style("fill", "#C46210")
  .style("opacity", 1);

  symbols.transition()
  .duration(200)
  .style("opacity", 1);
  svg.call(tool_tip)
  symbols.on("mouseover", function(d) {
    d3.select(this).raise();
    d3.select(this).classed("active", true);

    // the alt attribute in img tag is an alternate text for an image, if the image cannot be displayed
    body.html("<center>10-Year-Sales Price Difference in " + "<b>" + d['City'] + ", " + d['State'] + "</b>" + " is" + "<b> $" + d['TenYrSalesDiff'] + ".</b></center>");
    details.style("visibility", "visible");
    // show the tip svg charset
    tool_tip.show();
    tipAttr = {
      width:335,
      height:210,
    }
    tipMargin = {
      top: 50, right: 20, bottom: 20, left: 20,
    }

    var tipSVG = d3.select("#tipDiv")
    .append("svg")
    .attr("width", tipAttr.width)
    .attr("height", tipAttr.height);

    // set the ranges
    var tipx = d3.scaleBand()
    .range([0, tipAttr.width - tipMargin.left - tipMargin.right])
    .padding(0.1);
    var tipy = d3.scaleLinear()
    .range([tipAttr.height - tipMargin.top - tipMargin.bottom, 0]);

    // format the data
    data = difference[d['City']]
    console.log(data)
    let years = data.map(function(d){return d.years})
    let diff = data.map(function(d){return Math.abs(d.diffs)})
    tipx.domain(years);
    tipy.domain([0, d3.max(diff)]);
    console.log(tipy)

    tipSVG.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("class", function(d){return d.diffs < 0 ? "negative" : "positive";})
    .attr("x", function(d) { return tipx(d.years); })
    .attr("width", tipx.bandwidth())
    .attr("y", function(d) {
      if (d.diffs > 0){
        return tipy(d.diffs) + tipMargin.top;
      }
      else{
        return tipy(-d.diffs)+ tipMargin.top;
      }})
      .attr("height", function(d) {
        if (d.diffs > 0){
          return tipAttr.height - tipy(d.diffs) - tipMargin.top - 20;
        }
        else{
          return tipAttr.height - tipy(-d.diffs) - tipMargin.top - 20;
        }
      })
      .attr("transform", "translate(40,0)");

      tipSVG.append("g")
      .attr("transform", "translate(40,190)")
      .call(d3.axisBottom(tipx));

      // add the y Axis
      tipSVG.append("g")
      .call(d3.axisLeft(tipy))
      .attr("transform", "translate(40, 50)");

      tipSVG.append("text")
      .attr("font-size", "14px")
      .attr("x", 40)
      .attr("y", 20)
      .transition()
      .duration(1000)
      .text(d["City"] + " Yearly House Price Growth Trend")

      tipSVG.append("text")
      .attr("font-size", "12px")
      .attr("x", 98)
      .attr("y", 37)
      .transition()
      .duration(1000)
      .text("Red: Getting More Expensive")

    });

    symbols.on("mouseout", function(d) {
      d3.select(this).classed("active", false);
      tool_tip.hide();
      details.style("visibility", "hidden");
    });
  }

  function drawrentalDiff(data) {
    //console.log("salesDiff", data);
    // loop through and add projected (x, y) coordinates
    // (just makes our d3 code a bit more simple later)
    data.forEach(function(d) {
      let latitude = parseFloat(d.Latitude);
      let longitude = parseFloat(d.Longitude);
      let pixels = projection([longitude, latitude]);
      console.log(pixels);
      console.log(d.City);
      d.x = pixels[0];
      d.y = pixels[1];
    });

    var radius = d3.scaleLinear()
    .domain([-1e5, 1e5])
    .range([0, 5]);

    let symbols = g.salesDiff.selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", d => radius(d.TenYrSalesDiff))
    .attr("class", "symbol")
    .style("fill", "#1d7e49")
    .style("opacity", 1);

    symbols.transition()
    .duration(200)
    .style("opacity", 1);


    symbols.on("mouseover", function(d) {
      d3.select(this).raise();
      d3.select(this).classed("active", true);

      // the alt attribute in img tag is an alternate text for an image, if the image cannot be displayed
      body.html("<table border=0 cellspacing=0 cellpadding=2>" + "\n" +
      "<tr><th>Request Type:</th><td>" + d['Request Type'] + "</td></tr>" + "\n" +
      "<tr><th>Opened:</th><td>" + new Date(d.Opened).toDateString() + "</td></tr>" + "\n" +
      "<tr><th>Neighborhood:</th><td>" + d.Neighborhood + "</td></tr>" + "\n" +
      "<tr><th>Address:</th><td>" + d.Address + "</td></tr>" + "\n" +
      "<tr><th>Request Details:</th><td>" + d['Request Details'] + "</td></tr>" + "\n" +
      "</table>" + "\n" + (d["Media URL"] == "" ? "" :"<img src=\"" + d["Media URL"] + "\" class=\"detailImage\" alt=\"Image Not Found\">"));
      g.legends.selectAll(".legendBackground")
      .filter(e => (d['Request Type'] == e))
      .transition()
      .duration(100)
      .style("fill", "#646C6E");

      details.style("visibility", "visible");
    });

    symbols.on("mouseout", function(d) {
      d3.select(this).classed("active", false);
      details.style("visibility", "hidden");
      g.legends.selectAll(".legendBackground")
      .filter(e => (d['Request Type'] == e))
      .transition()
      .duration(100)
      .style("fill", "hsl(48, 100%, 67%)");

    });
  }

  function translate(x, y) {
    return "translate(" + String(x) + "," + String(y) + ")";
  }
