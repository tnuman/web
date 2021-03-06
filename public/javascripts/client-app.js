var main = function() {
    "use strict";
    var HOST = location.origin.replace(/^http/, 'ws');
    var socket = new WebSocket(HOST);
    
    var shipsPlaced = 0;
    var myTurn = false;
    var setupPhase = false;
    var timer = false;
    var minutes = 0;
    var seconds = 0;
    var fullscreen = false;
    var horizontal = true;

    // create tables that represent the gameboards
    createTable(document.getElementById("gameboardYou"), "Y");
    createTable(document.getElementById("gameboardOpp"), "O");

    // if the game is ongoing, update the timer every second
    setInterval(function(){
        if (timer) {
            seconds++;
            if (seconds === 60) {
                minutes++;
                seconds = 0;
            }
            displayTimer(minutes, seconds);
        }
    }, 1000);

    // click event for fullscreen
    $("#fullscreen").on("click", function() {
        if (!fullscreen) {
            toFullscreen(document.documentElement);
            fullscreen = true;
            $("#max").hide();
            $("#min").show();
        } else {
            exitFullscreen();
            fullscreen = false;
            $("#min").hide();
            $("#max").show();
        }
    });

    // click event for placing ships
    $("#gameboardYou td").on("click", function() {
        if (setupPhase) {
            var $cell = $(this);
            
            // notify the server where the ship needs to be placed
            let message = Messages.O_SHIP_PLACED;
            message.row = $cell.attr("row");
            message.col = $cell.attr("col");
            message.horizontal = horizontal;
            socket.send(JSON.stringify(message));
        }
    });

    // click event for rotating ship (when placing ships)
    $("#rotate").on("click", function() {
        horizontal = !horizontal;
    });

    // hover event for creating a silhouette of a ship (when placing ships)
    $("#gameboardYou td").hover(
        function() {  
            var $cell = $(this);          
            var row = $cell.attr("row");
            var col = $cell.attr("col");      
            if(horizontal) {                            // ships need to be portrayed horizontal
                var col = parseInt(col);                // needs to be parsed to an int, because we will do calculations with the value
                if (col + shipsPlaced <= 9) {
                    var available = true;
                    for (var i = 0; i < (shipsPlaced + 1); i++) {
                        if ($("#Y" + row + (col + i)).attr("class") != "empty"){
                            available = false;
                        }
                    } 
                    if (available === true) {
                        for (var i = 0; i < (shipsPlaced + 1); i++) {
                            $("#Y" + row + (col + i)).addClass("selected");
                        } 
                    }
                }
            } else {                                    // ships need to be portrayed vertically
                var row = parseInt(row);                // needs to be parsed to an int, because we will do calculations with the value
                if (row + shipsPlaced <= 9) {
                    var available = true;
                    for (var i = 0; i < (shipsPlaced + 1); i++) {
                        if ($("#Y" + (row + i) + col).attr("class") != "empty"){
                            available = false;
                        }
                    } 
                    if (available === true) {
                        for (var i = 0; i < (shipsPlaced + 1); i++) {
                            $("#Y" + (row + i) + col).addClass("selected");
                        } 
                    }
                }
            }
        }, function() {            
            var $cell = $(this);
            var row = $cell.attr("row");
            var col = $cell.attr("col");
            for (var i = 0; i < (shipsPlaced + 1); i++) {
                $("#Y" + row + col).removeClass("selected");
                col++;
            }
            col = $cell.attr("col");
            for(var x = 0; x < (shipsPlaced + 1); x++) {
                $("#Y" + row + col).removeClass("selected");
                row++;
            }
    });
    
    // click event for guessing opponents ships
    $("#gameboardOpp td").on("click", function() {
        if(myTurn) {
            var $cell = $(this);
            
            // check whether the cell is still empty
            if ($cell.attr("class") === "empty") {
                // notify the server where the player guessed
                let message = Messages.O_GUESS;
                message.row = $cell.attr("row");
                message.col = $cell.attr("col");        
                socket.send(JSON.stringify(message));
                
                myTurn = false;
            } 
        }
    });

    // on message from server
    socket.onmessage = function (event) {
        let incomingMsg = JSON.parse(event.data);

        // if PLACE_SHIP message, allow the player to place their ships
        if(incomingMsg.type === Messages.T_PLACE_SHIP) {
            // manipulating instruction text
            $("#instruction").text("Place your ship of length 1 somewhere in your sea");
            $("#gameboardYou").addClass("active");
            $("#rotate").show();
            setupPhase = true;
            timer = true;
        }

        // if SHIP_ACCPETED message, increment shipsPlaced and update the text
        if(incomingMsg.type === Messages.T_SHIP_ACCEPTED) {
            shipsPlaced++;
            
            //manipulating instruction text
            if(shipsPlaced + 1 <= 5) {
                $("#instruction").text("Place your ship of length " + String(shipsPlaced + 1)
                + " somewhere in your sea");
            } else {
                $("#instruction").text("Waiting for your opponent to place his ships");
                $("#gameboardYou").removeClass("active");
                setupPhase = false;
                $("#rotate").hide();
            }
        }

        // if YOUR_TURN message, set myTurn to true and modify the turnDisplay and instruction                                
        if(incomingMsg.type === Messages.T_YOUR_TURN) {
            myTurn = true;
            $("#turnDisplay").show();
            $("#turnDisplay div").text("Your");
            $("#instruction").text("Click somewhere in your opponent's sea to make a guess");
            $("#gameboardOpp").addClass("active");                  
        }

        // if OPPONENT_TURN message, modify the turnDisplay and instruction
        if(incomingMsg.type === Messages.T_OPPONENT_TURN) {
            $("#turnDisplay").show();
            $("#turnDisplay div").text("Opponents");
            $("#instruction").text("Waiting for your opponent to shoot");
            $("#gameboardOpp").removeClass("active"); 
        }

        // if UPDATE_OPPONENT message, update the entire view of the opponent
        if(incomingMsg.type === Messages.T_UPDATE_OPPONENT) {
            updateOppTable(incomingMsg.board);
            $("#shipsLeftOpp span").text(incomingMsg.shipsLeft);
        }

        // if UPDATE_YOU message, update the entire view of the opponent
        if(incomingMsg.type === Messages.T_UPDATE_YOU) {
            updateYourTable(incomingMsg.board);
            $("#shipsLeftYou span").text(incomingMsg.shipsLeft);
        }

        // if GAME_OVER message, call endGame with the provided boolean value
        if(incomingMsg.type === Messages.T_GAME_OVER) {
            timer = false;
            $(".active").removeClass("active"); 
            endGame(incomingMsg.data);            
        }

        // if GAME_ABORTED message, notify the player
        if(incomingMsg.type === Messages.T_GAME_ABORTED) {
            timer = false;
            $("#turnDisplay").hide();
            $("#rotate").hide();
            $(".active").removeClass("active"); 
            $("#instruction").text("GAME ABORTED");
            alert("Your opponent left the game...");
        }
    };
};
// executes main when the JavaScript file has been loaded
$(document).ready(main);

// returns a string representation of the number of seconds
var displayTimer = function(minutes, seconds) {
    var time;
    if (seconds < 10) {
        time = minutes + ":0" + seconds;
    } else {
        time = minutes + ":" + seconds;
    }
    $("#timeDisplay div").text(time);
}

// informs the player if he has won/lost the game
var endGame = function(hasWon) {
    if(hasWon === true) {
        alert("You won!");
        $("#instruction").text("You won!");
    } else {
        alert("You lost :(");
        $("#instruction").text("You lost...");
    }
    $("#turnDisplay").hide();
}

// function to enter fullscreen
function toFullscreen(elem) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { // for Firefox
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { // for Chrome
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { // for IE/Edge
      elem.msRequestFullscreen();
    } else {
        console.log("Fullscreen not supported for this browser");
    }
}
  
 // function to exit fullscreen
  function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { // for Firefox
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { // for Chrome
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { // for IE/Edge
        document.msExitFullscreen();
    } else {
        console.log("Fullscreen not supported for this browser");
    }
}
