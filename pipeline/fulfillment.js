/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
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

module.exports.handle_message = function(res, watson_data) {

  // watson_data.output.text = "My custom output"
  // watson_data.context.variable = "My custom variable value"
  // console.log('res: ', res);
  var message4 = 'the weather forecast';
  const weather = require('./weather');

  console.log('watson_data: ', watson_data)

  // get weather
  if (watson_data.output.text[0].indexOf(message4) > -1){
    var weatherLinkInfo = "For a detailed forecast, open the Weather Channel App."
    console.log("Looking up weather for " + watson_data.entities[0].value);
    var city = watson_data.entities[0].value;
    weather.geoLocation(city, function(err, response) {
      if (err){
        response.status(err.code || 400).json({error: err.error || err.message});
      }else{
        console.log("Found Geolocation " + response);
        params = response;
        if (!params){
          console.log("Unable to get geoLocation for " + city);
        }else{
          weather.forecastByGeoLocation(params, function(err, resp) {
            currentDay = new Date().getDay();
            var weekday = new Array(7);
            weekday[0] =  "Sunday";
            weekday[1] = "Monday";
            weekday[2] = "Tuesday";
            weekday[3] = "Wednesday";
            weekday[4] = "Thursday";
            weekday[5] = "Friday";
            weekday[6] = "Saturday";

            var dayForecast = resp[weekday[currentDay]].day;

            if (dayForecast.narrative){
              console.log(dayForecast.narrative);
              dayForecast = dayForecast.narrative.toLowerCase();
            }else{
              dayForecast = null;
            }
            var nightForecast = resp[weekday[currentDay]].night.narrative.toLowerCase();
            var currentForecast = "";
            if (!dayForecast){
              currentForecast = nightForecast;
            }else{
              currentForecast = dayForecast;
            }
            console.log("Current Forecast " + currentForecast);
            watson_data.output.text[0] = " The weather for " + city + " is supposed to be " + currentForecast + " " + weatherLinkInfo
            return res.json(watson_data);
          });
        };
      };
    });
  }else{
    return res.json(watson_data);
  };
};

module.exports.callDiscovery = function(res, query) {

	const discovery = require('./discovery');
	discovery.callDiscovery(query, function(err, response) {
		if (err){
			res.status(err.code || 400).json({error: err.error || err.message});
	      }else{
	        console.log("Found Docs " + response);
	        if (!response){
	          console.log("Unable to get docs for the query: " + query);
	        }else{
	        	return res.json(response);
	        }
	      }
	});
};
