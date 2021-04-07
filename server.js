const express = require('express');
const app = express();
const server = app.listen(3000);
const socket = require('socket.io'); 
const io = socket(server);
const cv = require('opencv4nodejs');
const wCap = new cv.VideoCapture(0); // 0 will open the default webcam in your system, this is the video capturing object
const FPS = 30; //frames per second
const crypto = require('crypto');
const alice = crypto.createECDH('secp256k1');
alice.generateKeys();
const alicePublicKeyBase64 = alice.getPublicKey().toString('base64');
var aliceSharedKey = '';
var sharedkeySolved = 0;
var frame_counter = 0;
const fs = require('fs');
var usage = require('usage');

app.use(express.static('public')); // shares the files inside folder public to the public
console.log("My socket server is running");
io.sockets.on('connection', newConnection); // if there is a new connection

// Device goes inside this function 
function newConnection(socket){
    console.log('\n\nNew Connection\nClient B socket id: ' + socket.id); // notifies the server when there's a new connection
    console.log('Sending public key to Client B: ' + alicePublicKeyBase64); 
    io.emit('ecDH', alicePublicKeyBase64); // sends public key to client B
    socket.on('Acknowledgement', Acknowledgement); // data goes into function Acknowledgement when the user receieves the public key of Alice
    socket.on('ecDH', ecDH); // when a data named ecDH enters the socket, the data goes inside function ecDH
    socket.on('disconnect', disconnect);
    socket.on('decryptTime', recordDecryptTime);
    function Acknowledgement(message){ // acknowledges the server that client B received Alice' public key
    console.log('Client B has' + message);
    }

    function disconnect(){
        console.log('Client B disconnected.');
        console.log('Reconnecting');
    }
    
    function recordDecryptTime(trans_time, encrypt){
        if(encrypt){
            console.log('Total transmission time (hr): %dms recorded - encrypted!', trans_time);
        }
        else{
            console.log('Total transmission time (hr): %dms recorded', trans_time);
        }
        fs.appendFile('5Mbps_transmissiontime_25%_32ks.txt',  trans_time + '\n', function (err) {
            if (err) return console.log(err);
        });
    }
    

    // receives the public key from client B and computes for the shared secret key
    function ecDH(bobPublicKeyBase64){
        console.log('Received Client B\'s public key: ' + bobPublicKeyBase64);
        io.emit('Acknowledgement', 'The server received your public key.');
        aliceSharedKey = alice.computeSecret(bobPublicKeyBase64, 'base64', 'hex'); 
        console.log('Shared secret key A has been calculated: ' + aliceSharedKey);
        sharedkeySolved = 1;
    }   

    // captures the camera of the device and includes the encryption rate settings

    setInterval(() => {  
        const encryptionRate = 25; // live video stream host selects encryption rate
        var encrypt = 0;
        if((Math.floor(Math.random() * 100) + 1) <= encryptionRate){
            encrypt = 1;
        }

        // Camera live capture and feed  with encryption
        if (sharedkeySolved){
            //start time - T1
            var hrstart_1 = process.hrtime() // gets the start time of hrstart1
            const frame = wCap.read(); // live video stream host captures the feed from the hardware
            const image = cv.imencode('.jpg', frame).toString('base64');
            var hrend_1 = process.hrtime(hrstart_1) // gets the end time of hrstart1
            //endtime - T1
            
            if(encrypt){
                //start time - T2
                var hrstart_2 = process.hrtime(); // gets the start time of hrstart2
                const IV = crypto.randomBytes(16); // start of encryption - creates different key sizes
                const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(aliceSharedKey, 'hex'), IV); // generates the packet keys using the shared key as a seed via  EC-KGF
                let encrypted = cipher.update(image, 'utf8', 'hex'); // video packets are encrypted using the unique key generated by the host 
                encrypted += cipher.final('hex'); // end of encryption
                const auth_tag = cipher.getAuthTag().toString('hex'); // getting the authorization tag
                const payload = IV.toString('hex') + encrypted + auth_tag; // combining the IV, encrypted data, and authorization tag
                const payload64 = Buffer.from(payload, 'hex').toString('base64'); // creation the payload
                var hrstart_trans = process.hrtime(); // gets the start time of hrstart_trans
                var hrend_2 = process.hrtime(hrstart_2); // gets the end time of hrstart2
                io.emit('image', payload64, encrypt, frame_counter, hrstart_trans, hrend_2); // encrypted packet send
                //end time - T2
            }else{
                //start time - T2.5
                var hrstart_2_5 = process.hrtime(); // gets the start time of hrstart2.5
                var hrstart_trans = process.hrtime(); // gets the start time of hrstart_trans
                var hrend_2_5 = process.hrtime(hrstart_2_5); // gets the end time of hrstart2.5
                io.emit('image', image, encrypt, frame_counter, hrstart_trans, hrend_2_5); // sending of unencrypted payload
                

                //end time - T2.5
            }        
            frame_counter += 1; // counter for packets
            /*
            if(encrypt){ // records the encryption time of the encrypted packet
                if(frame_counter <= 1500){
                    //console.info('Execution time (hr): %dms encrypted!', hrend_2[1] / 1000000)
                    fs.appendFile('10mbps_encryptiontime_75%_32ks.txt',  hrend_2[1] / 1000000 + '\n', function (err) {
                        if (err) return console.log(err);
                      });
                }
            }
            else{ // records the time of processing the unencrypted packet
                if(frame_counter <= 1500){
                    //console.info('Execution time (hr): %dms', hrend_2_5[1] / 1000000)
                    fs.appendFile('10mbps_encryptiontime_75%_32ks.txt',  hrend_2_5[1] / 1000000 + '\n', function (err) {
                        if (err) return console.log(err);
                      });
                } 
            }
            */
            // console: total time =t1+t2+t2.5
        } 
    }, 1000/FPS);
}