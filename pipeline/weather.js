/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
//var debug = require('debug')('bot:api:weather');
var pick = require('object.pick');
var format = require('string-template');
var extend = require('extend');
var fields = ['temp', 'pop', 'uv_index', 'narrative', 'phrase_12char', 'phrase_22char', 'phrase_32char'];
var requestDefaults = {
  auth: {
    username: process.env.WEATHER_USERNAME,
    password: process.env.WEATHER_PASSWORD,
    sendImmediately: true
  },
  jar: true,
  json: true
};
var requestNoAuthDefaults = {
  jar: true,
  json: true
};
var weatherKey = process.env.WEATHER_API_KEY;
var request;
var WEATHER_URL = process.env.WEATHER_URL || 'https://twcservice.mybluemix.net/api/weather';

module.exports = {
  /**
   * Returns the Geo location based on a city name
   * @param  {string}   params.name  The city name
   * @param  {Function} callback The callback
   * @return {void}
   */
  geoLocation: function(params, callback) {
    if (!params) {
      callback('city name cannot be null')
    }else{
      console.log("Got city " + params)
    }

    // If API Key is not provided use auth. credentials from Bluemix
    var qString;
    console.log(WEATHER_URL + " " + weatherKey);
    if (!weatherKey) {
        request = require('request').defaults(requestDefaults);
        qString = {
                query: params,
                locationType: 'city',
                countryCode: 'US',
                language: 'en-US'
                };
     }else{
        request = require('request').defaults(requestNoAuthDefaults);
        qString = {
                    query: params,
                    locationType: 'city',
                    language: 'en-US',
                    apiKey: weatherKey,
                    format : 'json'
                  };
     }
                   //countryCode: 'US',
    request({
      method: 'GET',
      url: WEATHER_URL + '/v3/location/search',
      qs: qString
    }, function(err, response, body) {
      if (err) {
        callback(err);
      } else if(response.statusCode != 200) {
        console.log(response.statusCode);
        callback('Error http status: ' + response.statusCode);
      } else if (body.errors && body.errors.length > 0){
        callback(body.errors[0].error.message);
      } else {
        console.log('geoLocation for: %s is: %', params, JSON.stringify(body.location));

        var lat = body.location.latitude[0];
        var long = body.location.longitude[0];
        var city = body.location.address[0];

        var geoLocatedCity = {
            longitude: long,
            latitude: lat
          };
        console.log(geoLocatedCity);
        callback(null, geoLocatedCity);
      }
    });
  },

/**
 * Gets the forecast based on a location and time range
 * @param  {[string]}   params.latitute   The Geo latitude
 * @param  {[string]}   params.longitude   The Geo longitude
 * @param  {[string]}   params.range   (Optional) The forecast range: 10day, 48hour, 5day...
 * @param  {Function} callback The callback
 * @return {void}
 */
  forecastByGeoLocation : function(params, callback) {
    var _params = extend({ range: '7day' }, params);

    if (!_params.latitude || !_params.longitude) {
      callback('latitude and longitude cannot be null')
    }
       var qString;
       if (!weatherKey) {
            request = require('request').defaults(requestDefaults);
            qString = {
                     units: 'm',
                     language: 'en-US'
                     };
         } else {
            request = require('request').defaults(requestNoAuthDefaults);
             qString = {
                     units: 'm',
                     language: 'en-US',
                     apiKey: weatherKey
                     };
          }
     request({
      method: 'GET',
      url: format(WEATHER_URL + '/v1/geocode/{latitude}/{longitude}/forecast/daily/{range}.json', _params),
      qs: qString
    }, function(err, response, body) {
      if (err) {
        callback(err);
      } else if(response.statusCode != 200) {
        callback('Error getting the forecast: HTTP Status: ' + response.statusCode);
      } else {
        var forecastByDay = {};
        body.forecasts.forEach(function(f) {
          if (!forecastByDay[f.dow]) {
          forecastByDay[f.dow] = {
            day: pick(f.day, fields),
            night: pick(f.night, fields)
          };
        };
        });
        //console.log('forecast for: %s is: %s', JSON.stringify(params), JSON.stringify(forecastByDay, null, 2));
        callback(null, forecastByDay);
      }
    });
  }
}
