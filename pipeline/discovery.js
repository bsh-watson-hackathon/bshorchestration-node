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
//var debug = require('debug')('bot:api:discovery');
var pick = require('object.pick');
var format = require('string-template');
var extend = require('extend');
var requestDefaults = {
  auth: {
    username: process.env.DISCOVERY_USERNAME || '69e4ecb5-bd24-4343-997b-7da8c8d15f29',
    password: process.env.DISCOVERY_PASSWORD || 'KzLLO0FIRRV5'
  }
};

var request;
var DISCOVERY_URL = process.env.DISCOVERY_URL || 'https://gateway.watsonplatform.net/discovery/api';
var ENVIRONMENT_ID = process.env.ENVIRONMENT_ID || 'c118617d-8831-41d9-a7b0-c6f2bb536fa1';
var COLLECTION_ID = process.env.COLLECTION_ID || 'da539a54-4e36-46de-b327-1e4f019bd5c2';


module.exports = {
  /**
   * Returns the list of documents based on the query string
   * @param  {string}   params.name  The city name
   * @param  {Function} callback The callback
   * @return {void}
   */
	callDiscovery: function(query, callback) {
    console.log('DISCOVERY_URL: ' + DISCOVERY_URL);
    
    request = require('request').defaults(requestDefaults);
    // If API Key is not provided use auth. credentials from Bluemix
    var qString = {
		query: query,
        version: '2016-11-07',
        count: '3',
        return: 'id,title,content',
        format : 'json'
    };    
    
    request({
      method: 'GET',
      //qs: qString,
      //url: DISCOVERY_URL + '/v1/environments/environments/' + ENVIRONMENT_ID + '/collections/' + COLLECTION_ID +'/query',
      url: "https://gateway.watsonplatform.net/discovery/api/v1/environments/c118617d-8831-41d9-a7b0-c6f2bb536fa1/collections/da539a54-4e36-46de-b327-1e4f019bd5c2/query?version=2016-11-07&query='Connecting%20to%20a%20wireless%20Internet%20network'&count=3&return=id,title,content"      
    }, function(err, response, body) {
      if (err) {
        callback(err);
      } else if(response.statusCode != 200) {
        console.log(response.statusCode);
        callback('Error http status: ' + response.statusCode);
      } else if (body.errors && body.errors.length > 0){
        callback(body.errors[0].error.message);
      } else {
        //console.log('/nDiscover Responce:/n' + body);
        callback(null, body);
      }
    });
  }
}
