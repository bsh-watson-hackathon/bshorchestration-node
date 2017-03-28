/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
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
process.env.SUPPRESS_NO_CONFIG_WARNING = true;

// library requires
const express = require('express'),
  extend = require('util')._extend,
  config = require('config'),
  vcapServices = require('vcap_services'),
  compression = require('compression'),
  bodyParser = require('body-parser'),  // parser for post requests
  watson = require('watson-developer-cloud');

//The following requires are needed for logging purposes
const uuid = require('uuid'),
  csv = require('express-csv'),
  basicAuth = require('basic-auth-connect');

// local module requires
const context_manager = require('./pipeline/context_manager'),
  fulfillment = require('./pipeline/fulfillment');

// load from .env file
require('dotenv').config({silent: true});

// load from (default).json file
if(config.has('VCAP_SERVICES')) process.env['VCAP_SERVICES'] = JSON.stringify(config.get('VCAP_SERVICES'));

//The app owner may optionally configure a cloudand db to track user input.
//This cloudand db is not required, the app will operate without it.
//If logging is enabled the app must also enable basic auth to secure logging
//endpoints
 var cloudantCredentials = vcapServices.getCredentials('cloudantNoSQLDB-service');
 var cloudantUrl = null;
 if (cloudantCredentials) {
   cloudantUrl = cloudantCredentials.url;
 }
 cloudantUrl = cloudantUrl || process.env.CLOUDANT_URL; // || '<cloudant_url>';

 var cloudant = require('cloudant')(process.env.CLOUDANT_URL);
 var dbname = 'userdb';
 var userdb = null;

 try{
   userdb = cloudant.db.create(dbname);
   if (userdb != null){
     userdb = cloudant.db.use(dbname);
   }
 }catch(e){
   userdb = cloudant.db.use(dbname);
 }
// var logs = null;

var app = express();

// Redirect http to https if we're in Bluemix
if(process.env.VCAP_APP_PORT)
  app.use(requireHTTPS);

app.use(compression());
app.use(bodyParser.json());
//static folder containing UI
app.use(express.static(__dirname + "/dist"));

// Create the service wrapper
var conversationConfig = extend({
  username: process.env.CONVERSATION_USERNAME || '<username>',
  password: process.env.CONVERSATION_PASSWORD || '<password>',
  version_date: '2016-09-20',
  version: 'v1'
}, vcapServices.getCredentials('conversation'));
var conversation = watson.conversation(conversationConfig);
//TODO: throw error if conversation creds are not correctly set

//The conversation workspace id
var workspace_id = process.env.WORKSPACE_ID || null;
console.log('Using Workspace ID '+workspace_id);

var pi = require('./pipeline/personality_insights');

var user_model = {
  name: '',
  email: '',
  twitter: '',
  movie_preference: '',
  location: '',
  ingredient_like: '',
  ingredient_dislike: '',
  food_style: ''
};

var fs = require('fs');
// Get content from file
 var contents = fs.readFileSync('resources/movie_food.json');
// Define to JSON type
 var movie_food = JSON.parse(contents);

// Endpoint to be called from the client side
app.post('/api/message', function (req, res) {
  if (!workspace_id) {
    console.error('WORKSPACE_ID is missing');
    return res.json({
      'output': {
        'text': 'Oops! It doesn\'t look like I have been configured correctly...'
      }
    });
  }

  var payload = {
    workspace_id: workspace_id,
    context: {},
    user_model: {}
  };
  if (req.body) {
    if (req.body.input) {
      payload.input = req.body.input;
      payload.input.text = payload.input.text.trim();
    }
    if (req.body.context) {
      // The client must maintain context/state
      payload.context = req.body.context;
      console.log('Payload context '+payload.context);
    }
  }

  // Update the context before sending payload to the Watson Conversation service
  context_manager.update_context(payload, function(new_payload) {

    if (new_payload.input.text){
      var message1 = 'ask a few questions';
      var message2 = 'Twitter handle';
      var message3 = 'What is your Home address';
      var message4 = 'are all set';

      // 1. Look up user by user name in Cloudant. If new user, create new record them else greet them and load their profile
      // into the cotext
      userdb.find({selector:{name:new_payload.input.text.toLowerCase().trim()}}, function(er, result) {
        if (er) {
          throw er;
        }
        if (result.docs.length > 0){
          console.log('Found user in the database.');
          new_payload.context.username = new_payload.input.text;
          new_payload.input.text = 'known user';
          var genre = result.docs[0].movie_preference;
          new_payload.context.genre = genre;
          new_payload.user_model.movie_preference = genre;
          for (var pairing in movie_food.movie_food_pairing) {
            if (movie_food.movie_food_pairing[pairing].movie == genre) {
              new_payload.context.recipe = movie_food.movie_food_pairing[pairing].recipe;
              new_payload.context.recipe_name = movie_food.movie_food_pairing[pairing].recipe_name;
              break;
            };
          };
          // 2. Invoke Conversation API
          conversation.message(new_payload, function (err, data) {
            if (err) {
              console.error('conversation.message error: '+JSON.stringify(err));
              return res.status(err.code || 500).json(err);
            }
            // 3. Full calls to other services here
            fulfillment.handle_message(res, data);
          })
        } else {
          // 1a. New User
          console.log('New user.');
          new_payload.context.username = new_payload.input.text;
          // 2a. Assume a movie genre for the new user
          if (!(new_payload.context.genre)) {
            new_payload.context.genre = 'comedy';
            for (var pairing in movie_food.movie_food_pairing) {
              if (movie_food.movie_food_pairing[pairing].movie == new_payload.context.genre) {
                new_payload.context.recipe = movie_food.movie_food_pairing[pairing].recipe;
                new_payload.context.recipe_name = movie_food.movie_food_pairing[pairing].recipe_name;
                break;
              };
            };
          };
          // 3. Invoke Conversation API
          conversation.message(new_payload, function (err, data) {
            if (err) {
              console.error('conversation.message error: '+JSON.stringify(err));
              return res.status(err.code || 500).json(err);
            }

            if (data.output.text[0].indexOf(message1) > -1){
              user_model.name = data.input.text.toLowerCase().trim();
              new_payload.user_model.name = data.input.text.toLowerCase().trim();
              console.log('User name: ', user_model.name);
            };
            if (data.output.text[0].indexOf(message2) > -1){
              user_model.email = data.input.text;
              new_payload.user_model.email = data.input.text;
              console.log('email: ', user_model.email);
            };

            if (data.output.text[0].indexOf(message3) > -1){
              user_model.twitter = data.input.text;
              new_payload.user_model.twitter = data.input.text;
              console.log('Twitter handle: ', user_model.twitter);

            };
            if (data.output.text[0].indexOf(message4) > -1){
                user_model.location = data.input.text;
                new_payload.user_model.location = data.input.text;
                console.log('location: ', user_model.location);
                // 4. Get Consumption Preferences from PI (Hardcoded from a pre-defined set of personalities)
                pi.get_profile(function(err, response) {
                  if (err) {
                  response.status(err.code || 400).json({error: err.error || err.message});
                } else {
                  var movie_preferences = [];
                    for (var item in response.consumption_preferences[4].consumption_preferences) {
                    var preference = response.consumption_preferences[4].consumption_preferences[item];
                    if (preference.score == 1) {
                    var regex = /^Likely to like ([a-zA-Z ]+) movies$/;
                    var result = preference.name.match(regex);
                    var genre = result[1];
                    user_model.movie_preference = genre;
                    new_payload.user_model.movie_preference = genre;
                    userdb.insert(user_model);
                    };
                    break;
                    };
                }
            });
                data.context.genre = user_model.movie_preference;
            new_payload.context.genre = user_model.movie_preference;
                            

            };
            fulfillment.handle_message(res, data);
          });
        }
      });

    } else {
      // Send the input to the conversation service
      conversation.message(new_payload, function (err, data) {
        if (err) {
          console.error('conversation.message error: '+JSON.stringify(err));
          return res.status(err.code || 500).json(err);
        }

        fulfillment.handle_message(res, data);
      });
    }
  });

});


//Endpoint to be called from the client side for discovery
app.get('/api/discovery', function (req, res) {
	var query = 'Connecting to a wireless Internet network';
	fulfillment.callDiscovery(res, query);
});


app.use('/api/speech-to-text/', require('./speech/stt-token.js'));
app.use('/api/text-to-speech/', require('./speech/tts-token.js'));

function requireHTTPS(req, res, next) {
  if (req.headers && req.headers.$wssp === "80") {
    return res.redirect('https://' + req.get('host') + req.url);
  }
  next();
}

module.exports = app;
