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

const watson = require('watson-developer-cloud'); // watson sdk
var request = require('request');
var vcapServices = require('vcap_services');


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

try {
    userdb = cloudant.db.create(dbname);
    if (userdb != null) {
        userdb = cloudant.db.use(dbname);
    }
} catch (e) {
    userdb = cloudant.db.use(dbname);
}
// var logs = null;

// Create the service wrapper
const conversation = watson.conversation({
    // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
    // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
    // username: '<username>',
    // password: '<password>',
    version_date: '2016-10-21',
    version: 'v1'
});
const workspace = process.env.WORKSPACE_ID || '<workspace-id>';


/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */

const updateMessage = (input, response, httpresponse) => {
    console.log("got from conversation: " + JSON.stringify(response, null, 2));
    if (!response.output) {
        response.output = {};
    } else {

        if (response.output.action) {
            //got an action
            if (response.output.action.stopRecording) {
                // do the start recording stuff
                request('https://bsh-image-recognition.mybluemix.net/stop_recording', function (error, videoResponse, body) {
                    console.log('error:', error); // Print the error if one occurred
                    console.log('statusCode:', videoResponse && videoResponse.statusCode); // Print the response status code if a response was received
                    //return result
                    var videoURL = JSON.parse(body).url;

                    // now call the recipe put api

                    /*  request({
                     url: 'https://bshrecipes.mybluemix.net/recipes/'+recipeId+'/step/'+recipeStep+'/video',
                     method: "PUT",
                     body: videoURL
                     }, function (error, videoResponse, body) {
                     console.log('error:', error); // Print the error if one occurred
                     console.log('statusCode:', videoResponse && videoResponse.statusCode); // Print the response status code if a response was received
                     //return result
                     return {};
                     });*/



                    return {};
                });


            }

            if (response.output.action.startRecording) {
                // do the start recording stuff

                request('https://bsh-image-recognition.mybluemix.net/start_recording', function (error, videoResponse, body) {
                    console.log('error:', error); // Print the error if one occurred
                    console.log('statusCode:', videoResponse && videoResponse.statusCode); // Print the response status code if a response was received
                    //return result
                    return {};
                });


            }



            if (response.output.action.recipeSearch && response.context.recipe) {
                //recipe search

                //first get user stuff
                var message = {
                    workspace_id: workspace,
                    input: {},
                    context: response.context,


                }


                var user = response.context.user;
                //user = 'roland';
                console.log("***user***" + user);
                userdb.find({selector: {name: user}}, function (er, result) {
                    if (er) {
                        throw er;
                    }
                    if (result.docs.length > 0) {
                        console.log('Found user in the database.');
                        message.context.user = result.docs[0];

                    }

                    // now get fridge content

                    request('https://bsh-image-recognition.mybluemix.net/fridge_contents', function (error, fridgeresponse, body) {
                        console.log('error:', error); // Print the error if one occurred
                        console.log('statusCode:', fridgeresponse && fridgeresponse.statusCode); // Print the response status code if a response was received
                        //return result
                        if (fridgeresponse.statusCode===200) {
                            var fridgeContent = JSON.parse(body);
                            message.context.fridgeContent = fridgeContent;
                        }


                        request('https://bshrecipes.mybluemix.net/recipesmetadata?title=' + response.context.recipe, function (error, reciperesponse, body) {
                            console.log('error:', error); // Print the error if one occurred
                            console.log('statusCode:', reciperesponse && reciperesponse.statusCode); // Print the response status code if a response was received
                            //return result

                            var recipes = JSON.parse(body);
                            message.context.recipeInformation = {
                                foundNumber: recipes.length,
                                excludedNumber: 1,
                                selectedRecipe: {

                                    "id": recipes[0].identifier,
                                    "name": recipes[0].data[0].title

                                }
                            };

                            //getting recipe details

                            request('https://bshrecipes.mybluemix.net/recipes/' + message.context.recipeInformation.selectedRecipe.id, function (error, recipedetailsresponse, body) {
                                console.log('error:', error); // Print the error if one occurred
                                console.log('statusCode:', recipedetailsresponse && recipedetailsresponse.statusCode); // Print the response status code if a response was received
                                //return result

                                var recipedetails = JSON.parse(body);
                                message.context.recipeInformation.selectedRecipe.details = recipedetails;


                                sendMessage(message, httpresponse, updateMessage);
                                return {};


                            });


                        });
                    });



                });


            } else {
                response.output.text = "Sorry I did not get that";
                return response;
            }
        } else {
            return response;
        }

    }
    /* if (response.intents && response.intents[0]) {
     var intent = response.intents[0];
     // Depending on the confidence of the response the app can return different messages.
     // The confidence will vary depending on how well the system is trained. The service will always try to assign
     // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
     // user's intent . In these cases it is usually best to return a disambiguation message
     // ('I did not understand your intent, please rephrase your question', etc..)
     if (intent.confidence >= 0.75) {
     responseText = 'I understood your intent was ' + intent.intent;
     } else if (intent.confidence >= 0.5) {
     responseText = 'I think your intent was ' + intent.intent;
     } else {
     responseText = 'I did not understand your intent';
     }
     }
     response.output.text = responseText;*/
    return response;
};

const sendMessage = (payload, result, callback) => {
    console.log("sending to conversation: " + JSON.stringify(payload, null, 2));
    conversation.message(payload, (error, data) => {
        if (error) {
            console.log("error " + JSON.stringify(error));
            return error.message;
        }
        var answer = updateMessage(payload, data, result);
        if (answer && answer.output && answer.output.text && answer.output.text.length > 0) {
            console.log("returning" + JSON.stringify(answer));
            return result.send(answer);
        }
    });
}


module.exports = function (app) {

    app.post('/api/message', (req, res, next) => {
        //  const workspace = process.env.WORKSPACE_ID || '<workspace-id>';
        if (!workspace || workspace === '<workspace-id>') {
            return res.send({
                output: {
                    text: 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' +
                    '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> ' +
                    'documentation on how to set this variable. <br>' +
                    'Once a workspace has been defined the intents may be imported from ' +
                    '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> ' +
                    'in order to get a working application.'
                }
            });
        }
        const payload = {
            workspace_id: workspace,
            context: req.body.context || {},
            input: req.body.input || {}
        };

        // Send the input to the conversation service
        sendMessage(payload, res, updateMessage);
    });
};
