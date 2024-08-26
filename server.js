#!/usr/bin/env node

const APIKey = "<<FillAPIKey>>"; //API Key for Opening
const GPIOPort = 26; //GIPIO Number on new 538 for 26 and 532 for 20
const PrivKey = "/path/to/privkey.pem"; //Path to Priv. Kex
const SSLCert = "/path/to/fullchain.pem"
const port = 8000; //Port Number for Express


const express = require('express');
const https = require('https');
const Gpio = require('onoff').Gpio;
const fs = require('fs');
const app = express();
const ActionPin = new Gpio(GPIOPort, 'out', 1);
ActionPin.writeSync(1);

//Security for APIKey
if(APIKey == "<<FillAPIKey>>") 
{
	console.log ("Please Change API KEY!!");
	process.exit();
}



app.set('view engine', 'ejs');

app.get('/action/:key', (req, res) => {

    if (req.params.key != APIKey) {
        res.send({ success: false });
    }

    ActionPin.writeSync(0);
    setTimeout(() => {
        ActionPin.writeSync(1);
        res.send({ success: true });
    }, 500)

});

app.get('/'+APIKey, (req, res) => {
    res.render("index.ejs");
});

https.createServer({
    key: fs.readFileSync(PrivKey),
    cert: fs.readFileSync(SSLCert),
}, app)
.listen(port);
