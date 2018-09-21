var http = require('http');
const fs = require('fs');
const _io = require('socket.io');

// file to tail
const file = "C:\\temp2\\log.txt";

let fileHandler = null;
let fileSize = 0;

/**
 * Open a file and set the global file handler variable
 * @param string file - full path of the file
 */
function openFile() {
    return new Promise((resolve, reject) => {
        fs.open(file, 'r', function(err,_fd) {
            if(err) {
                reject(new Error("Error reading file"));
            }
            
            // set fileHandler
            fileHandler = _fd;
            resolve(true);
        });
    });
}

/**
 * Gets file size
 * Should be called only if fileHander is set
 */
function getFileStats() {
    return new Promise((resolve, reject) => {
        if( fileHandler === null ) {
            reject(new Error("File Handler is not set"));
        }
        fs.stat(file, function(err,stat){
            if(err) {
                reject(new Error(err));
            }
            
            resolve(stat.size);
        });
    });
}

/**
 * Reads from offset instead of start
 */
function readLastBuffer(lastNBytes, callback) {
    
    // read the file
    fs.read(
        fileHandler,
        new Buffer(lastNBytes),
        0, // offset
        lastNBytes, // length
        fileSize - lastNBytes, // position
        function(err, bytesRead, data) {
            if(err) {
                reject(new Error(err));
            }
            callback(data.toString('utf-8'));
        }
    );
    
}

/**
 * Allow cross origin request by setting CORS headers
 * @param object res - response object of HTTP request
 */
function setCors(req, res) {
    // Set CORS headers
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Request-Method', '*');
	res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT');
	//res.setHeader('Access-Control-Allow-Headers', '*');
	if ( req.method === 'OPTIONS' ) {
		res.writeHead(200);
		res.end();
		return;
	}

}

//create a server object:
let app = http.createServer(function (req, res) {
    setCors(req, res);
    res.write('Hello World!'); //write a response to the client
    res.end(); //end the response
});

const io = _io(app);

// listen on port 8081
app.listen(8081);

// set listener
io.on('connection', function(socket){
    console.log('a user connected');
    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
});

/**
 * Callback function everytime there's a change
 */
function logger(data) {
    console.log(data);
    io.emit('broadcast', { data: data });
}

function getChanges() {
    getFileStats().then(
        size => {
            if(size > 0) {
                const addedBuffer = size - fileSize;
                fileSize = size;
                return readLastBuffer(addedBuffer, logger);
            }
        }
    );
}

openFile().then(
    () => getFileStats()
).then(
    size => {
        fileSize = size;
        fs.watch(file, { encoding: 'buffer' }, (eventType, filename) => {
            if (filename) {
                getChanges();
            }   
        });
    }
);