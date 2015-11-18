# WebRTC Chord Platform
A p2p platform based on Chord protocol using WebRTC data channels.

In this implementation, the server is used to signal the first connection of a peer to another peer in the network, the next connections between peers are signalled in a distributed manner using routing adhoc between the already connected peers. 
The server itself also acts a peer in the network (it's the first peer of the network), both server and clients use the same codebase.

# Build
```sh
$ npm install
$ webpack
```

# Setup

## Server
Configuration file parameters:
* debug: activate/deactivate verbose logging
* url: address in which the server will be running
* m: the size of the network, where size = 2^m
* sha1: use SHA-1 identifiers or integers

Example:
```json
{
    "debug": false,
    "url": "http://localhost:8080",
    "m": 3,
    "sha1": false
}
```

To start the server:
```sh
node server.js config-file.json
```
`config-file.json` is optional, if not defined then default configurations are used (from file config-default.json).

## Client
Include `webrtc-chord-platform.js`:
```html
<script type="text/javascript" src="path/to/webrtc-chord-platform.js"></script>
```

Create a chord instance:
```javascript
var chord = new Chord(options);
```
`options` is an object with configuration parameters, example:
```javascript
options = {
    url: "http://localhost:8080", //server url
    debug: false, //activate/deactivate verbose logging
    storage: sessionStorage //optional, let's you define the key-value object as long as it uses the setItem/getItem API
}
```

# Usage
## Join the p2p network
```javascript
chord.join(function(id){
	//returns the id when joined successfully
});
```

## User Events
It's possible to define custom events (syntax like `socket.io`)
```javascript
chord.on('event_name', function(data) {
    console.log("This is my callback event_name");
});
```

## Communicate with a specific peer
It's possible to send data directly to a peer as long as a direct connection exist between the two

### List direct connections
```javascript
chord.getConnections();
```

### Get a direct connection to a specific peer
```javascript
chord.connectTo(id, function(event) {
	//event
    //-yourself - trying to connect to yourself
    //-connected - is connected
    //-not_connected - is not connected
});
```

### Emit custom event to specific peer
```javascript
chord.emit('event_name', id_other_peer, data);
```

## Broadcast
Broadcast messages to all network peers:
```javascript
chord.broadcast(“MESSAGE”);
```
Register broadcast callback:
```javascript
chord.on('broadcast', function(data) {
        console.log("This is my callback broadcast");
        console.log(data);
});
```

## Leave the p2p network
```javascript
chord.leave();
```

## Store value
Stores a value in the network
```javascript
chord.storeValue(myValue);
```

## Get value
Get a value from the network by its hash
```javascript
chord.getValue(hash, function(value) {
        console.log("This is my callback");
});
```

# Client example
The `client-example/client.html` file is an example of a possible client.


# Copyright and License

Copyright 2015 Bruno Faria, Instituto de Telecomunicações, Wavecom

Licensed under the GPLv3

# Acknowledgements

![alt text](https://raw.githubusercontent.com/bmcfaria/webrtc-chord-platform/master/acknowledgements/logos.png "Acknowledgements")