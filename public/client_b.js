const crypto = require('crypto');
const socket = io.connect('192.168.68.114:3000');
const bob = crypto.createECDH('secp256k1');
bob.generateKeys();
const bobPublicKeyBase64 = bob.getPublicKey().toString('base64');
const aes256 = require('aes256');
const { decrypt } = require('aes256');
var bobSharedKey = '';
var local_frame_counter = 0;
const hrtime = require('browser-hrtime');
const fs = require('fs') 
var trans_time = [];


socket.on('ecDH', ecDH); // when a data named ecDH enters the socket the data goes into function ecDH
socket.on('image', data); // when a data named image enters the socket the data goes into function data
socket.on('Acknowledgement', Acknowledgement) // when a data named Acknowledgment enters the socket the data goes into function Acknowledgement

// the function that receives the acknowledgement of Alice that she receieved your public key
function Acknowledgement(message){
    console.log(message);
}

// the function that receives the public key of Alice and computes the shared secret for Alice and Bob
function ecDH(alicePublicKeyBase64){
    console.log('Received Alice public key: ', alicePublicKeyBase64);
    socket.emit('Acknowledgement', ' received your public key.');
    console.log('Sending Bob public keys: ', bobPublicKeyBase64);
    socket.emit('ecDH', bobPublicKeyBase64);
    bobSharedKey = bob.computeSecret(alicePublicKeyBase64, 'base64', 'hex');
    console.log('Shared secret key B has been calculated: ', bobSharedKey);  
}


function data(payload64, encrypt, frame_counter, hrstart_trans, hrend_enc){
    var hrend_trans = hrtime(hrstart_trans); // gets the end time of hrstart_trans
    const imageElm = document.getElementById('image'); // container for the html video stream 
    if(encrypt){ // the packet goes here if the data is encrypted  
        //start
        const bob_payload = Buffer.from(payload64, 'base64').toString('hex'); // converting the packet to hex string 
        const bob_iv = bob_payload.substr(0, 32); // extraction of IV from the packet
        const bob_encrypted = bob_payload.substr(32, bob_payload.length - 32 - 32); // extraction of encrypted data from the packet
        const bob_auth_tag = bob_payload.substr(bob_payload.length - 32, 32); // extraction of the authorization tag from the packet
        //end
        try{
            //start
            const hrstart1 = hrtime(); // gets the start time of hrstart1
            const decipher = crypto.createDecipheriv(  // uses aes-256-gcm on shared key b and IV to create the unique packet key
                'aes-256-gcm', 
                Buffer.from(bobSharedKey, 'hex'), 
                Buffer.from(bob_iv, 'hex')
            );
            decipher.setAuthTag(Buffer.from(bob_auth_tag, 'hex')); // sets the correct authorization tag of the unique packet key
            let decrypted = decipher.update(bob_encrypted, 'hex', 'utf8'); // client decrypts the encrypted packets using aes-256-gcm
            decrypted += decipher.final('utf8'); // end of decryption 
            //end
            imageElm.src = `data:image/jpeg;base64,${decrypted}`; // displays the decrypted data in html webpage of client b
            const hrend1 = hrtime(hrstart1); // gets the end time of hrstart1
            if(frame_counter <= 1500){
                // console.log('Execution time (hr): %dms decrypted!', hrend1[1] / 1000000)
                // console.log(hrend_trans); 
                var total_trans_time = hrend_trans[1] + hrend1[1] + hrend_enc[1];
                console.log(total_trans_time / 1000000);
                socket.emit('decryptTime', total_trans_time / 1000000, encrypt);
            }
            else if(frame_counter == 1501){
                console.log('1500 packets trans time recorded!');
            }
        }
          catch(error){
            console.log(error.message); // logs the cause of the error if there are
          }
    }else{   
        //start 
        const hrstart2 = hrtime(); // gets the start time of hrstart2
        imageElm.src = `data:image/jpeg;base64,${payload64}`; // displays the unencrypted data in html webpage of client b
        const hrend2 = hrtime(hrstart2); // gets the end time of hrstart2
        
        if(frame_counter <= 1500){
            // console.log('Execution time (hr): %dms', hrend2[1] / 1000000);
            // console.log(hrend_trans);
            var total_trans_time = hrend_trans[1] + hrend2[1] + hrend_enc[1];
            console.log(total_trans_time / 1000000);
            socket.emit('decryptTime', total_trans_time / 1000000, encrypt);
            
        }
        else if(frame_counter == 1501){
            console.log('1500 packets trans time recorded!');
        }
    }
} 
