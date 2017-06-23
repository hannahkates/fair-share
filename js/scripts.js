var gAPI = 'AIzaSyC6SuU3stxfZpRVoxa5kwVH21C0gKeBJA4';

// Instantiating the map object
var map = L.map('mapContainer').setView([40.735021, -73.994787], 11);

// Adding a light basemap from carto's free basemaps
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attribution">CARTO</a>'
}).addTo(map);

// Defining color for each Facility Domain
function getColor(facdomain) {
  return facdomain == 'Education, Child Welfare, and Youth' ? '#f7ca00' :
  facdomain == 'Health and Human Services' ? '#BA68C8' :
  facdomain == 'Libraries and Cultural Programs' ? '#73E5F4' :
  facdomain == 'Parks, Gardens, and Historical Sites' ? '#4CAF50' :
  facdomain == 'Public Safety, Emergency Services, and Administration of Justice' ? '#2979FF' :
  facdomain == 'Core Infrastructure and Transportation' ? '#8D8EAA' :
  facdomain == 'Administration of Government' ? '#CBCBD6' : '#FFF'
};

var inputIDs = ['agency', 'addressnum', 'streetname', 'borough', 'facsubgrp'];
var inputOrig = ['Agency or Entity', 'Address Number', 'Street Name', 'Borough', 'Type of Facility'];
var inputs = [$('#agency').val(), $('#addressnum').val(), $('#streetname').val(), $('#borough').val(), $('#facsubgrp').val()];
var siteLat;
var siteLong;
var valid;

// Getting form input values
$('#submit-button').on('click', function(event) {
  valid = true;
  event.preventDefault();
  for(i=0; i<inputs.length; i++) {
    var value = '#' + inputIDs[i];
    // If value is different from orig value, update value
    if($(value).val() != inputOrig[i]) {
      inputs[i] = $(value).val();
    } else {
      // If value is same as original value, turn input box red
      $(value).css('background', '#FFCCCC');
      valid = false;
    }
  }
  if (valid == true) {
    var geoURL = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + inputs[1] + '+' + inputs[2] + '+' + inputs[3] + '+NY&key=' + gAPI;
    // var geoURL = 'https://api.cityofnewyork.us/geoclient/v1/address.json?houseNumber=' + inputs[1] +'&street=' + inputs[2] + '&borough=' + inputs[3] + '&app_id=' + app_id + '&app_key=' + app_key;
    var geoOutput = $.getJSON(geoURL, function(data) {      
      siteLat = data.results["0"].geometry.location.lat;
      siteLong = data.results["0"].geometry.location.lng;
      createLayers(siteLat, siteLong);
    });
  };
});

// Function that creates all map layers and populate the facility list table
var createLayers = function(siteLat, siteLong) {

  // Creating and adding the SITE to the map
  var siteURL = 'https://cartoprod.capitalplanning.nyc/user/cpp/api/v2/sql?q=SELECT ST_Transform(ST_SetSRID(ST_MakePoint(' + siteLong + ',' + siteLat + '),4326), 3857) AS the_geom_webmercator, ST_SetSRID(ST_MakePoint(' + siteLong + ',' + siteLat + '),4326) AS the_geom, 1 AS cartodb_id, \'Proposed Site\' AS label&format=geojson&filename=download';
  $.getJSON(siteURL, function(sitePoint) {
    L.geoJson(sitePoint, {
      pointToLayer: function (feature, latlng) {
          var geojsonMarkerOptions = {
              radius: 8,
              fillColor: "black",
              color: "#000",
              weight: 1,
              opacity: 1,
              fillOpacity: 0.9
          };
          return L.circleMarker(latlng, geojsonMarkerOptions);
      }
    }).addTo(map);
  });

  // Creating and adding the BUFFER polygons to the map
  var bufferURL = 'https://cartoprod.capitalplanning.nyc/user/cpp/api/v2/sql?q=WITH site AS (SELECT ST_Transform(ST_SetSRID(ST_MakePoint(' + siteLong + ', ' + siteLat + '),4326), 3857) AS the_geom_webmercator) SELECT ST_Buffer( site.the_geom_webmercator, 121.92) AS the_geom_webmercator, ST_Transform(ST_Buffer( site.the_geom_webmercator, 121.92), 4326) AS the_geom FROM site UNION SELECT ST_Buffer(site.the_geom_webmercator, 804.672) AS the_geom_webmercator, ST_Transform(ST_Buffer( site.the_geom_webmercator, 804.672), 4326) AS the_geom FROM site&format=geojson&filename=download';
  var bufferPoly;
  $.getJSON(bufferURL, function(bufferPoly) {
   bufferPoly = L.geoJson(bufferPoly, {
      style: {
        color: "#000",
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0
      }
    }).addTo(map);
    map.fitBounds(bufferPoly.getBounds());
  });

  // Getting and adding the filtered FACILITIES to the map
  var facURL = 'https://cartoprod.capitalplanning.nyc/user/cpp/api/v2/sql?q=WITH site AS (SELECT ST_Transform(ST_SetSRID(ST_MakePoint(' + siteLong + ', ' + siteLat + '),4326), 3857) AS the_geom_webmercator), buffer AS ( SELECT ST_Buffer(the_geom_webmercator, 804.672) AS the_geom_webmercator, ST_Transform(ST_Buffer(the_geom_webmercator, 804.672), 4326) AS the_geom FROM site) SELECT row_number() over (ORDER BY ST_Distance(f.the_geom_webmercator, site.the_geom_webmercator)) AS label, f.* FROM facdb_facilities AS f, site, buffer WHERE ST_Intersects(f.the_geom_webmercator, buffer.the_geom_webmercator) ORDER BY label ASC&format=geojson&filename=download';
  var facPoints;
  $.getJSON(facURL, function(facPoints) {
    // Populate table with facility list
    for (var i=0; i<facPoints.features.length; i++) {
      var myRow = '<tr>'
        + '<td width="5%">' + facPoints.features[i].properties.label + '</td>'
        + '<td width="30%">' + facPoints.features[i].properties.facname + '</td>'
        + '<td width="25%">' + facPoints.features[i].properties.facsubgrp + '</td>'
        + '<td width="25%">' + facPoints.features[i].properties.address + '</td>'
        + '<td width="15%"><a href=\'https://capitalplanning.nyc/facility/' + facPoints.features[i].properties.uid + '\' target=\'_blank\'>More details</a></td>'
      + '</tr>';
      $('.table-body').append(myRow);
    };
    facsubset = L.geoJson(facPoints, {
      // Display points
      pointToLayer: function (feature, latlng) {
        var d = feature.properties; 
        var geojsonMarkerOptions = {
            radius: 5,
            fillColor: getColor(d.facdomain),
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.9
        };
        var label = d.label;
        return L.circleMarker(latlng, geojsonMarkerOptions)
      },
      // Create label and popup content
      onEachFeature: function(feature, layer) {
        var d = feature.properties;   
        var label = d.label + '';
        layer.bindTooltip(label, {permanent: true});
      },
      onEachFeature: function(feature, layer) {
        var d = feature.properties;   
        var popupText = 'Label: ' + d.label + '<br />'
          + 'Name: <b>' + d.facname + '</b><br />' 
          + 'Category: ' + d.facsubgrp + '<br />' 
          + 'Address: ' + d.address;
        layer.bindPopup(popupText);
      }
    }).addTo(map);
  });
}

// Creating csv download URL
var facsubset_download = '<a href=\"https://cartoprod.capitalplanning.nyc/user/cpp/api/v2/sql?q=WITH site AS (SELECT ST_Transform(ST_SetSRID(ST_MakePoint(' + siteLong + ', ' + siteLat + '),4326), 3857) AS the_geom_webmercator), buffer AS ( SELECT ST_Buffer(the_geom_webmercator, 804.672) AS the_geom_webmercator, ST_Transform(ST_Buffer(the_geom_webmercator, 804.672), 4326) AS the_geom FROM site) SELECT row_number() over (ORDER BY ST_Distance(f.the_geom_webmercator, site.the_geom_webmercator)) AS label, f.* FROM facdb_facilities AS f, site, buffer WHERE ST_Intersects(f.the_geom_webmercator, buffer.the_geom_webmercator) ORDER BY label ASC&format=csv&filename=FairShareList\"><span id="download-icon" class="glyphicon glyphicon-download-alt"></span></a>';
$('#btn-download').append(facsubset_download);