/*
 * Copyright © 2016 I.B.M. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the “License”);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an “AS IS” BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* The Conversation module handles the display and behavior of the chat section
 * of the application, including the messages to and from Watson and the input box
 */

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Conversation$" }] */
/* global Api: true, Common: true */

var handfotointerval;
var Conversation = (function() {
  'use strict';
  var ids = {
    userInput: 'user-input',
    userInputDummy: 'user-input-dummy',
    chatFlow: 'chat-flow',
    chatScrollWrapper: 'chat-scroll-wrapper'
  };
  var classes = {
    messageWrapper: 'message-wrapper',
    preBar: 'pre-bar',
    underline: 'underline'
  };
  var authorTypes = {
    user: 'user',
    watson: 'watson'
  };

  // Publicly accessible methods defined
  return {
    init: init,
    setMessage: setMessage,
    sendMessage: sendMessage,
    focusInput: focusInput
  };

  // Initialize Conversation module
  function init() {
    chatSetup();
    initEnterSubmit();
    setupInputBox();
    setupGetHandsWSConnection();
  }

  // Hide chat box until there are messages,
  // set up messages to display when user or Watson sends message
  function chatSetup() {
    document.getElementById(ids.chatScrollWrapper).style.display = 'none';

    var currentRequestPayloadSetter = Api.setUserPayload;
    Api.setUserPayload = function(payload) {
      currentRequestPayloadSetter.call(Api, payload);
      displayMessage(payload, authorTypes.user);
    };

    var currentResponsePayloadSetter = Api.setWatsonPayload;
    Api.setWatsonPayload = function(payload) {
      currentResponsePayloadSetter.call(Api, payload);
      displayMessage(payload, authorTypes.watson);
    };
  }

  // Set up the input box to submit a message when enter is pressed
  function initEnterSubmit() {
    document.getElementById(ids.userInput)
        .addEventListener('keypress', function(event) {
          if (event.keyCode === 13) {
            sendMessage();
            event.preventDefault();
          }
        }, false);
  }

  // Set up the input box to underline text as it is typed
  // This is done by creating a hidden dummy version of the input box that
  // is used to determine what the width of the input text should be.
  // This value is then used to set the new width of the visible input box.
  function setupInputBox() {
    var input = document.getElementById(ids.userInput);
    var dummy = document.getElementById(ids.userInputDummy);
    var minFontSize = 9;
    var maxFontSize = 16;
    var minPadding = 5;
    var maxPadding = 9;

    // If no dummy input box exists, create one
    if (dummy === null) {
      var dummyJson = {
        'tagName': 'div',
        'attributes': [{
          'name': 'id',
          'value': (ids.userInputDummy)
        }]
      };

      dummy = Common.buildDomElement(dummyJson);
      document.body.appendChild(dummy);
    }


    function adjustInput() {
      if (input.value === '') {
        // If the input box is empty, remove the underline
        Common.removeClass(input, 'underline');
        input.setAttribute('style', 'width:' + '100%');
        input.style.width = '100%';
      } else {
        // otherwise, adjust the dummy text to match, and then set the width of
        // the visible input box to match it (thus extending the underline)
        Common.addClass(input, classes.underline);
        var txtNode = document.createTextNode(input.value);
        ['font-size', 'font-style', 'font-weight', 'font-family', 'line-height',
          'text-transform', 'letter-spacing'].forEach(function(index) {
            dummy.style[index] = window.getComputedStyle(input, null).getPropertyValue(index);
          });
        dummy.textContent = txtNode.textContent;

        var padding = 0;
        var htmlElem = document.getElementsByTagName('html')[0];
        var currentFontSize = parseInt(window.getComputedStyle(htmlElem, null).getPropertyValue('font-size'), 10);
        if (currentFontSize) {
          padding = Math.floor((currentFontSize - minFontSize) / (maxFontSize - minFontSize)
            * (maxPadding - minPadding) + minPadding);
        } else {
          padding = maxPadding;
        }

        var widthValue = ( dummy.offsetWidth + padding) + 'px';
        input.setAttribute('style', 'width:' + widthValue);
        input.style.width = widthValue;
      }
    }

    // Any time the input changes, or the window resizes, adjust the size of the input box
    input.addEventListener('input', adjustInput);
    window.addEventListener('resize', adjustInput);

    // Trigger the input event once to set up the input box and dummy element
    Common.fireEvent(input, 'input');
  }

  function setupGetHandsWSConnection(){
      var connection = new WebSocket('wss://bsh-image-recognition.mybluemix.net/ws/hands_update');
      connection.onopen = function () {
          connection.send('Ping'); // Send the message 'Ping' to the server
          console.log("hands WS connection opened");
      };

// Log errors
      connection.onerror = function (error) {
          console.log('WebSocket Error ' + error);
      };

// Log messages from the server
      connection.onmessage = function (e) {
          console.log('Server: ' + e.data);
          var handsupdate = JSON.parse(e.data);
          if (handsupdate.command === "hands_update"){

              var message = {
                  "input":{
                      "handsupdate":handsupdate.value
                  }
              }
              console.log("hu"+JSON.stringify(message));
              Api.postConversation(message);
          }
      };
  }

  // Retrieve the value of the input box
  function getMessage() {
    var userInput = document.getElementById(ids.userInput);
    return userInput.value;
  }

  // Set the value of the input box
  function setMessage(text) {
    var userInput = document.getElementById(ids.userInput);
    userInput.value = text;
    userInput.focus();
    Common.fireEvent(userInput, 'input');
  }

  // Send the message from the input box
  function sendMessage(newText) {
    var text;
    if (newText) {
      text = newText;
    } else {
      text = getMessage();
    }
    if (!text) {
      return;
    }
    setMessage('');

    Api.postConversationMessage(text);
  }

  // Display a message, given a message payload and a message type (user or Watson)
  function displayMessage(newPayload, typeValue) {
    var isUser = isUserMessage(typeValue);
    var textExists = (newPayload.input && newPayload.input.text)
      || (newPayload.output && newPayload.output.text);
    if (isUser !== null && textExists) {
      if (newPayload.output && Object.prototype.toString.call( newPayload.output.text ) === '[object Array]') {
        newPayload.output.text = newPayload.output.text.filter(function(item) {
          return item && item.length > 0;
        }).join(' ');
      }
      var dataObj = isUser ? newPayload.input : newPayload.output;

      if (!String(dataObj.text).trim()) {
        return;
      }
      var messageDiv = buildMessageDomElement(newPayload, isUser);

     console.log(JSON.stringify(newPayload,null,2));
        var ingredients = document.getElementById('ingredients');
       // alert(newPayload.context.current_step);
     if (newPayload.context && newPayload.context.state==="cooking"){
        // alert("hello");

         var stepsHTML;
         var currentStep = newPayload.context.current_step;
         stepsHTML='<h2>Step:'+currentStep+'</h2>';
         if (newPayload.context.recipeInformation.selectedRecipe.details.steps[currentStep].video){
             stepsHTML+='<video width=\"320\" height=\"240\" controls autoplay> <source src=\"'+newPayload.context.recipeInformation.selectedRecipe.details.steps[currentStep].video+'\" type=\"video/mp4\"></video>';
         }else{
             stepsHTML+='<p>'+newPayload.context.recipeInformation.selectedRecipe.details.steps[currentStep].text+'</p>'
         }
         stepsHTML+='<h2>Video Capture</h2>';
         stepsHTML+='<img height=\"200px\" id=\"handphoto\" src=\"http://serwer16667.lh.pl/ibm/handphoto.jpg\"></img>';
         ingredients.innerHTML=stepsHTML;
         if (!handfotointerval) {
             handfotointerval = setInterval(function () {

                 var myImageElement = document.getElementById('handphoto');
                 if (!myImageElement){
                     clearInterval(handfotointerval);
                 }else {
                     myImageElement.src = 'http://serwer16667.lh.pl/ibm/handphoto.jpg?rand=' + Math.random();
                 }
             }, 1000);
         }else {

         }
        // alert(ingredients.innerHTML);

     }

     else if (newPayload.context && newPayload.context.state==="shopping"){

      // alert(newPayload.context.recipeInformation.selectedRecipe);
         var ingredientsHTML;
         ingredientsHTML='<h2>Ingredients for '+newPayload.context.recipeInformation.selectedRecipe.name+'</h2><ul>'
         if (newPayload.context.recipeInformation.selectedRecipe.details.ingredients_lists) {
             for (var i = 0; i < newPayload.context.recipeInformation.selectedRecipe.details.ingredients_lists.length; i++) {
                 ingredientsHTML += '<li>' + newPayload.context.recipeInformation.selectedRecipe.details.ingredients_lists[i].name + "<ul>";
                 for (var j = 0; j < newPayload.context.recipeInformation.selectedRecipe.details.ingredients_lists[i].ingredients.length; j++) {

                     var ingredient = newPayload.context.recipeInformation.selectedRecipe.details.ingredients_lists[i].ingredients[j];
                     var fridgeItems = {};
                     if (newPayload.context.fridgeContent) {
                         fridgeItems = newPayload.context.fridgeContent;
                     }

                     var inFridge = false
                     for (var item in fridgeItems) {
                         if (ingredient.toLowerCase().indexOf(item) > -1) {
                             inFridge = true;
                         }

                     }

                     if (inFridge) {
                         ingredient += " (in fridge)";
                     } else {
                         ingredient += " (on shopping list)";
                     }
                     ingredientsHTML += '<li>' + ingredient + '</li>';
                 }

                 ingredientsHTML += '</ul></li>';
             }
         }
         ingredientsHTML+='</ul>'
         var fridgeHTML="<h2>Fridge Content:</h2><ul>"

         for (var item in fridgeItems){
             if(fridgeItems.hasOwnProperty(item)){
                 fridgeHTML+="<li>"+fridgeItems[item]+" "+item+"</li>";
             }

         }
         fridgeHTML+="</ul>";
         ingredientsHTML+=fridgeHTML;
         ingredients.innerHTML=ingredientsHTML;


     }else{
         ingredients.innerHTML="";
     }


      var chatBoxElement = document.getElementById(ids.chatFlow);
      chatBoxElement.appendChild(messageDiv);
      updateChat();
    }
  }

  // Determine whether a given message type is user or Watson
  function isUserMessage(typeValue) {
    if (typeValue === authorTypes.user) {
      return true;
    } else if (typeValue === authorTypes.watson) {
      return false;
    }
    return null;
  }

  // Builds the message DOM element (using auxiliary function Common.buildDomElement)
  function buildMessageDomElement(newPayload, isUser) {
    var dataObj = isUser ? newPayload.input : newPayload.output;
    var messageJson = {
      // <div class='user / watson'>
      'tagName': 'div',
      'classNames': ['message-wrapper', (isUser ? authorTypes.user : authorTypes.watson)],
      'children': [{
        // <p class='user-message / watson-message'>
        'tagName': 'p',
        'classNames': (isUser
          ? [authorTypes.user + '-message']
          : [authorTypes.watson + '-message', classes.preBar]),
        'html': (isUser ? '<img src=\'/images/head.svg\' />' + dataObj.text : dataObj.text)
      }]
    };

    return Common.buildDomElement(messageJson);
  }

  // Display the chat box if it's currently hidden
  // (i.e. if this is the first message), scroll to the bottom of the chat
  function updateChat() {
    document.getElementById(ids.chatScrollWrapper).style.display = '';
    var messages = document.getElementById(ids.chatFlow).getElementsByClassName(classes.messageWrapper);
    document.getElementById(ids.chatFlow).scrollTop = messages[messages.length - 1].offsetTop;
  }

  // Set browser focus on the input box
  function focusInput() {
    document.getElementById(ids.userInput).focus();
  }
}());
