/**
  * Cheat stores the display information and a function to call when the cheat is being ran
  * @param {name} row position of the tile
  * @param {number} The cost, this will be deducted from the score when used
  * @param {function} Called when cheat is ran
  */
var Config = function() {
    this.rows = ko.observable(10);
    this.cols = ko.observable(8);
    this.mines = ko.observable(10);
    this.allowNegativeScore = ko.observable(false);
};

/**
  * Tile represents each cell and sits inside a 2D array
  * @param {function} the board this tile is currently attached
  * @param {number} row position of the tile
  * @param {number} column position of the tile
  */
var Tile = function (board, row, col) {
    var selfTile = this;
    selfTile.board = board; //Parent board, currently required as tile communicates with neighbours, should probably be removed
    selfTile.count = ko.observable(0); //Current count of mines adjacent to it
    selfTile.row = row; //Current row position on board
    selfTile.col = col; //Current col position on board
    selfTile.mine = ko.observable(false); //Does the tile contain a mine
    selfTile.hidden = ko.observable(true); //Is the tile currently hidden (i.e not yet clicked)
    selfTile.mark = ko.observable(false); //Has the user marked this as a possible mine
    selfTile.click = function() {
        if(!selfTile.hidden()) {
            return;
        }
        selfTile.reveal(true);
        return selfTile.mine();
    }

    /**
      * Right-click/Context menu. In future will need to check for L Button down to support both mouse buttons pressed
      * @param {object} currently unused
      * @param {event} event that his this function off, mainly used for event.target
      */
    selfTile.rClick = function (data, event) {
        if(!selfTile.hidden()) {
            return false;
        }
        selfTile.mark(!selfTile.mark()&&selfTile.hidden());
        return true;
    }
    selfTile.reveal = function (initial) {
        if(initial || selfTile.hidden())
        {
            selfTile.hidden(false);
            //If we hit a 0 try and reveal all adjacent tiles
            //    Don't worry about leaving the game board, reveal will handle bad row/col
            if(selfTile.count()==0) {
                board.reveal(row-1, col);
                board.reveal(row, col-1);
                board.reveal(row+1, col);
                board.reveal(row, col+1);
                board.reveal(row-1, col-1);
                board.reveal(row-1, col+1);
                board.reveal(row+1, col-1);
                board.reveal(row+1, col+1);
            }
        }
    }
};
/**
  * Cheat stores name and cost of an action the user can perform outside of the normal minesweeper actions
  * @param {function} The parent board. Needed to decide whether the cheat should be enabled
  * @param {string} Name of the command/cheat
  * @param {number} Cost of the command/cheat
  * @param {function} function to be called when cheat is called
  */
var Cheat = function (board, name, cost, onCheat) {
    var thisCheat = this;
    thisCheat.name = name;
    thisCheat.cost = cost;
    thisCheat.onCheat = onCheat;
    thisCheat.enable = ko.computed(function () {
        return board.gameOn() && (config.allowNegativeScore() || (thisCheat.cost < board.session.score));
    });
    thisCheat.displayName = ko.computed(function () {
        return thisCheat.name + " ("+thisCheat.cost+")";
    });
};
var Session = function () {
    var thisSession = this;
    thisSession.score = ko.observable(0); //The score, an integer representation of how many games the user has completed (larger scores are earned for bigger games
    //Player Title. Currently displayed under score and not saved
    thisSession.title = ko.computed(function () {
    if(thisSession.score() < 0) {
        return "Cheater!!!";
    } else if(thisSession.score() < 10) {
        return "Noob";
    } else if(thisSession.score() < 100) {
        return "Skilled";
    } else if(thisSession.score() < 1000) {
        return "Master";
    } else if(thisSession.score() < 10000) {
        return "Godly";
    } else {
        return "No Life";
    }
    });
    thisSession.modifyScore = function (value) {
        thisSession.score(thisSession.score()+value);
    };
};
var Validator = function(tiles) {
    var result = true;
    var revealed = 0;
    for(var row in self.tiles()) {
        for(var col in self.tiles()[row]) {
            if(!getTile(row, col).hidden()) {
                revealed++
            }
        }
    }
    var markLeftover = revealed+parseInt(config.mines())===parseInt(config.rows())*parseInt(config.cols());
    if(!self.built()) {
        self.placeMines(config.mines());
    }
    for(var row in self.tiles()) {
        for(var col in self.tiles()[row]) {
            var tile = getTile(row, col);
            if(markLeftover && tile.hidden()) {
                tile.mark(true);
            }
            if(tile.mine()) {
                tile.hidden(false);
            }
            result = result && tile.mark() === tile.mine();
        }
    }
    return result;
};
var Board = function () {
    var self = this;
    //Let board handle OnClick messages, only once board has cleared it throw it to the tile
    self.onTileClick = function (tile) {
        //Don't allow clicking revealed tiles
        if(!self.gameOn()) {
            return;
        }
        //Mines are not placed till the user's first click
        //    This ensures the user doesn't get a mine first attempt
        //    Reveal current tile so that it doesn't get given a mine
        if(!self.built()) {
            tile.hidden(false);
            self.placeMines(parseInt(config.mines()));
            tile.hidden(true);
        }
        //if click returns yes we hit a mine
        //Run validate once a mine is hit, we know it will fail
        // Tiles remain marked when revealed to support 'Undo' type cheats. Make sure to remove the mark before validation to ensure mine is visible
        if(tile.click()) {
            tile.mark(false);
            self.onValidate();
        }
    }
    self.onTileRClick = function (tile, event) {
        if(self.gameOn()) {
            tile.rClick();
        }
    }
    //Temp fix to check we have a Tile before proceeding
    self.reveal = function (row, col){
        if(typeof(self.getTile(row, col))==="object") {
            self.getTile(row, col).reveal(false);
        }
    }
    /**
      * Creates the game board but does not fill it with mines
      * @param {number} row size of game board
      * @param {number} coloumn size of game board
      */
    self.buildMinefield = function (rows, cols) {
        //Create Empty board
        var board = new Array(rows);
        for(var i = 0; i < rows; i++) {
            board[i] = new Array(cols);
            for(var j = 0; j < cols; j++) {
                board[i][j] = new Tile(this, i, j);
            }
        }
        self.tiles(board);
        self.built(false);
    }
    //Places mines on game board
    //    Ignores currently revealed locations
    //    ToDo: Defensive Programming - There is a possible infinite loop here
    self.placeMines = function (mineCount,reserved) {
        if(!self.initialized())
            onNewGame();
        var mines = 0;
        while(mines < mineCount) {
            var mineLocation = Math.floor(Math.random()*config.rows()*config.cols());
            var row = Math.floor(mineLocation/config.cols());
            var col = Math.floor(mineLocation%config.cols());
            var mine = self.tiles()[row][col].mine();
            var hidden = self.tiles()[row][col].hidden();
            if(!self.tiles()[row][col].mine() && self.tiles()[row][col].hidden()) {
                incrementNeighbours(parseInt(row), parseInt(col));
                self.tiles()[row][col].mine(true);
                mines++;
            }
        }
        self.built(true);
    }
    self.incrementNeighbours = function (row, col) {
        increment(row-1, col);
        increment(row, col-1);
        increment(row+1, col);
        increment(row, col+1);
        increment(row-1, col-1);
        increment(row+1, col-1);
        increment(row+1, col+1);
        increment(row-1, col+1);
    }
    self.increment = function (row, col) {
        if(row < 0 || row >= config.rows() || col < 0 || col >= config.cols())
            return;
        getTile(row,col).count(getTile(row,col).count()+1);
    }
    self.onNewGame = function () {
        if(self.gameOn()) {
            return self.onValidate()
        }
        self.initialized(true);
        self.gameVictory(false);
        self.gameOver(false);
        self.buildMinefield(Math.ceil(config.rows()), Math.ceil(config.cols()));
    }
    self.onValidate = function () {
        if(!self.gameOn()) {
            return;
        }
        if(Validator(self.tiles)){
            self.gameVictory(true);
            self.gameOver(false);
            session.modifyScore(gameValue());
        } else {
            self.gameOver(true);
            self.gameVictory(false);
        }
    }
    //Get the value of the current game
    //    By taking the square we effectively get the numbers of rows as a score with a small multiple for the number of mines
    //    Scores currently range from 2 to 63
    self.gameValue = function () {
        return Math.floor(Math.sqrt(config.rows()*config.cols()*Math.sqrt(config.mines())));
    }
    //Convenience function
    self.getTile = function (row, col) {
        row = parseInt(row);
        col = parseInt(col);
        if(row>=0&&row<config.rows()&&col>=0&&col<config.cols()) {
            return self.tiles()[row][col];
        }
    }
    //Verify functions are currently just a dirty way to make sure input values remain within bounds
    //    This can probably be improved with a knockoutjs subscription but time
    self.verifyRowCount = function (object, event) {
        if(self.minRows() > event.target.value) {
            config.rows(self.minRows());
        } else if(self.maxRows() < event.target.value) {
            config.rows(self.maxRows());
        }
        if(self.minMines() > config.mines()) {
            config.mines(self.minMines());
        } else if(self.maxMines() < config.mines()) {
            config.mines(self.maxMines());
        }
    }
    self.verifyColCount = function (object, event) {
        if(self.minCols() > event.target.value) {
            config.cols(self.minCols());
        } else if(self.maxCols() < event.target.value) {
            config.cols(self.maxCols());
        }
        if(self.minMines() > config.mines()) {
            config.mines(self.minMines());
        } else if(self.maxMines() < config.mines()) {
            config.mines(self.maxMines());
        }
    }
    self.verifyMineCount = function (object, event) {
        if(self.minMines() > event.target.value) {
            config.mines(self.minMines());
        } else if(self.maxMines() < event.target.value) {
            config.mines(self.maxMines());
        }
    }
    self.built = ko.observable(false); //Have the mines been places
    self.initialized = ko.observable(false); //Has any game board been created
    self.minRows = ko.observable(2); //Minimum Rows allowed
    self.maxRows = ko.observable(20); //Maximum Rows allowed. Currently statically set, this could be set in a game config file with a warning that higher numbers may cause problems.
    self.minCols = ko.observable(2); //Minimum Cols allowed
    self.maxCols = ko.observable(20); //Maximum Cols allowed
    self.tiles = ko.observableArray(); //The big 2D array that stores all the tiles
    self.minMines = ko.observable(1); //Minimum Mines allowed
    self.gameVictory = ko.observable(false); //Show game victory screen
    self.gameOver = ko.observable(false); //Show game over screen
    self.cheats = ko.observableArray(); //Each added cheat will be displayed as a button on the display
    self.config = new Config(); //Stores current configuration of the board. Size, no. of mines etc

    self.session = new Session();
    //Max mines. Has to be below the total number of tiles.
    //    For reasonableness currently only allowing 80% of board
    //    ToDo: Remove magic numbers
    self.maxMines = ko.computed(function () {
        return Math.floor(parseInt(config.rows()) * parseInt(config.cols()) * .8)-2;
    });
    //Is a game currently being played
    self.gameOn = ko.computed(function () {
        return !self.gameVictory() && !self.gameOver() && self.initialized();
        });
    //Name of the main game button
    self.gameButton = ko.computed(function () {
        if(self.gameOn()) {
            return "Validate";
        } else {
            return "Start Game";
        }
    });
    //Create cheat 'Complete'. Mostly for testing this cheat fills the board, the cost should always be more than a board is worth
    self.cheats.push( new Cheat(this, "Complete", 110, (function () {
        if(!self.gameOn()) {
            return;
        }
        session.modifyScore(-this.cost);
        if(!self.built()) {
            self.placeMines(parseInt(config.mines()));
        }
        for(var row in self.tiles()) {
            for(var col in self.tiles()[row]) {
                var tile = getTile(row, col);
                tile.mark(tile.mine());
                if(!tile.mine()) {
                    tile.hidden(false);
                }
            }
        }
    })));
    //Create cheat 'Hint'. An example of a non-game winning cheat this will mark the first unmarked mine. Quite OP given the marking ordered
    self.cheats.push( new Cheat(this, "Hint", 10, (function () {
        if(!self.gameOn()) {
            return;
        }
        session.modifyScore(-10);
        if(!self.built()) {
            self.placeMines(parseInt(config.mines()));
        }
        for(var row in self.tiles()) {
            for(var col in self.tiles()[row]) {
                var tile = getTile(row, col);
                if(tile.mine() && !tile.mark()) {
                    tile.mark(true);
                    return;
                }
            }
        }
    })));
};
ko.applyBindings(Board);