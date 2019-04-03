//
// Copyright (c) 2019 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a Smartsheet webhook based on Express.js,
 * and posting back to Webex Teams.
 * 
 * see Smartsheet webhook spec: https://smartsheet-platform.github.io/api-docs/#creating-a-webhook
 */

// Load environment variables from project .env file
require('node-env-file')(__dirname + '/.env');

// Check we can request Smartsheet
if (!process.env.MERAKI_VALIDATOR) {
    console.log("Please specify a MERAKI_VALIDATOR env variable");
    process.exit(1);
}
if (!process.env.MERAKI_SECRET) {
    console.log("Please specify a MERAKI_SECRET env variable");
    process.exit(1);
}
if (!process.env.MERAKI_SSID) {
    console.log("Please specify a MERAKI_SSID env variable");
    process.exit(1);
}
if (!process.env.TEAMS_TOKEN) {
    console.log("Please specify a TEAMS_TOKEN env variable");
    process.exit(1);
}
if (!process.env.TEAMS_SPACE) {
    console.log("Please specify a TEAMS_SPACE env ");
    process.exit(1);
}

// Timeout for outgoing request
const DEFAULT_TIMEOUT = 3000; // in seconds

const express = require("express");
const app = express();

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Loggers
const debug = require("debug")("meraquoi");
const fine = require("debug")("meraquoi:fine");

const started = Date.now();
app.route("/")

    // healthcheck
    .get(function (req, res) {
        fine("helthcheck invoked!");
        res.json({
            message: "Congrats, your app is up and running",
            since: new Date(started).toISOString(),
            version: require('./package.json').version,
            tip: "Don't forget to register your app to Meraki to start receiving events"
        });
    })

// Where Meraki will post scanning payloads
const cmxRoute = process.env.ROUTE || '/scanning';
const checkScanningPayload = require("./scanning");
app.route(cmxRoute)

    // First-time organisation-specific validator string
    .get(function (req, res) {
        fine("ping: validator string requested");
        res.status(200).send(process.env.MERAKI_VALIDATOR);
    })

    // Receive JSON scanning payloads
    .post(function (req, res) {
        const latest = Date.now();
        fine(`new scanning data received: ${new Date(latest).toGMTString()}`);

        // check secret
        if (process.env.MERAKI_SECRET !== req.body.secret) {
            debug("warning: secrets do not match, aborting...")
            res.status(400).json({ message: "secrets do not match" });
            return;
        }
        fine('secrets match');

        // is it a supported payload ?
        const payload = req.body;
        if ((!payload) || (!checkScanningPayload(payload))) {
            debug("unexpected scanning payload, aborting...");
            res.status(400).json({ message: "unexpected payload" });
            return;
        }
        fine("payload structure is correct, will be processed");

        // Event is ready to be processed, let's send a response to meraki without waiting any longer
        fine("responded OK to Meraki");
        res.status(200).json({ message: "fine, the event is being processed by the webhook" });

        // Check for row created events
        processScanningPayload(payload);
        return;
    })


const ssid = process.env.MERAKI_SSID;
const myPeople = require('./people.js');
var tracking = {};
function processScanningPayload(payload) {

    fine(`processing payload with: ${payload.data.observations.length} observations`);

    // Look for known mac addresses connected to our SSID
    payload.data.observations
        .filter((observation) => {
            // is device connected to the SSID
            if (ssid !== observation.ssid) {
                return false;
            }

            // Is the Mac address among the list
            if (!observation.clientMac) {
                return false;
            }
            fine(`checking mac address: ${observation.clientMac} against the list`)
            const deviceOwner = myPeople[observation.clientMac];
            if (!deviceOwner) {
                return false;
            }

            debug(`found device owner: ${deviceOwner}`)
            return true
        })

        // Check if state has changed since last observations
        // If the device has already not been observed, then notify
        // otherwise update last seen
        .forEach((observation) => {
            const trackingEntry = tracking[observation.clientMac];
            if (!trackingEntry) {
                // Send notification of new presence detected
                notifyToWebexTeams(observation)
            }

            // Update last seen
            fine(`updating seenTime: ${observation.seenTime} for client: ${observation.clientMac}`)
            tracking[observation.clientMac] = observation.seenTime;
        });
}

const FlintSparky = require('node-sparky');
const teamsClient = new FlintSparky({ token: process.env.TEAMS_TOKEN });


function notifyToWebexTeams(observation) {
    const owner = myPeople[observation.clientMac];
    debug(`owner detected: ${owner}`)

    // Push message
    let message = {
        roomId: process.env.TEAMS_SPACE,
        markdown: `good news, ${owner} has reached ${process.env.MERAKI_SSID}`
      };
      
      teamsClient.messageSend(message)
        .then((message) => {
            debug('message pushed successfully to Teams')
        })
        .catch((err) => {
            debug(`could not push message to Teams, err: ${err.message}`);
        });
}


// Starts the Webhook service
//
var port = process.env.PORT || 8080;
app.listen(port, function () {
    console.log(`Meraki scaning webhook listening at: ${port}`);
    console.log("   GET  /          : for health checks");
    console.log(`   POST ${cmxRoute}  : to receive meraki scanning events`);
});

