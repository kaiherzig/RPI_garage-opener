Using an RasperryPi running Raspbian
Tested on NodeJS 15

Config:
const APIKey = "MegaSecretKey"; //API Key for Opening
const GPIOPort = 26; //GIPIO Number
const PrivKey = "/path/to/privkey.pem"; //Path to Priv. Kex
const SSLCert = "/path/to/fullchain.pem"
const port = 8000; //Port Number for Express