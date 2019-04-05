//
// Copyright (c) 2019 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a webhook based on Express.js,
 * listening to Meraki scanning notifications,
 * and posting back to Webex Teams as known devices are seen / leave
 *
 */

// Load environment variables from project .env file
require('node-env-file')(__dirname + '/.env');

// Check for mandatory env variables
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
        debug(`new scanning data received: ${new Date(latest).toGMTString()}`);

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
const FlintSparky = require('node-sparky');
const teamsClient = new FlintSparky({ token: process.env.TEAMS_TOKEN });
function processScanningPayload(payload) {

    debug(`processing payload with: ${payload.data.observations.length} observations`);

    // Look for known mac addresses connected to our SSID
    payload.data.observations
        .filter((observation) => {
            fine(`processing observation`)
            // is device connected to the SSID
            if (ssid !== observation.ssid) {
                fine('device not connected to SSID')
                return false;
            }

            // Is the Mac address among the list
            if (!observation.clientMac) {
                fine('no mac address')
                return false;
            }
            const deviceOwner = myPeople[observation.clientMac];
            if (!deviceOwner) {
                fine('device not in list')
                return false;
            }
            fine(`found device owner: ${deviceOwner}, for mac address: ${observation.clientMac}`)
            return true
        })

        // Check if state has changed since last observations
        // If the device has already not been observed, then notify
        // otherwise update last seen
        .forEach((observation) => {
            const trackingEntry = tracking[observation.clientMac];
            if (!trackingEntry) {
                // New presence detected
                const owner = myPeople[observation.clientMac];
                debug(`device: ${observation.clientMac}, from owner: ${owner}, detected on SSID:  ${process.env.MERAKI_SSID}`)

                // Send notification of new presence detected
                const message = {
                    roomId: process.env.TEAMS_SPACE,
                    markdown: `good news: ${owner} has reached ${process.env.MERAKI_SSID}`
                };
                teamsClient.messageSend(message)
                    .then((message) => {
                        fine('message pushed successfully to Teams')

                        // Continue to UPDATE last seen
                        // see below
                    })
                    .catch((err) => {
                        debug(`could not push message to Teams, err: ${err.message}`);
                        // We won't update last seen since the notification could not be sent
                        debug(`ignoring last seen for ${owner}`)
                        return;
                    });
            }

            // UPDATE last seen
            tracking[observation.clientMac] = observation.seenTime;
            debug(`updated last seen time to: ${observation.seenTime}, for client: ${observation.clientMac}`)
        });
}


// Starts the Webhook service
//
var port = process.env.PORT || 8080;
app.listen(port, function () {
    console.log(`Meraki scanning webhook listening at: ${port}`);
    console.log("   GET  /          : for health checks");
    console.log(`   POST ${cmxRoute}  : to receive meraki scanning events`);

    // Launch Cron that purges not seen devices
    const logPurge = require("debug")("meraquoi:purge");
    const CronJob = require('cron').CronJob;
    // Every minute, Monday to Friday
    const interval = process.env.HASLEFT_CRON || 1; // check every minute by default
    const delay = process.env.HASLEFT_DELAY || 10; // has left SSID if not seen for >10 minutes
    const job = new CronJob('0 */1 * * * 1-5', purgeEntries, null, false, 'Europe/Paris');
    job.start();
    logPurge(`cron checking every ${interval} minute(s), for not seen devices over ${delay} minute(s)`)

    // Elaps time in minutes after which we consider the device has left the SSID
    function purgeEntries() {
        logPurge(`time to purgeEntries, with ${Object.keys(tracking).length} devices currently seen`);

        const now = Date.now();
        Object.keys(tracking).forEach((macAddress) => {
            const lastSeenDate = tracking[macAddress];

            // If device was not seen for more than DELAY (converted to milliseconds)
            const delta = now - new Date(lastSeenDate).getTime();
            logPurge(`device: ${macAddress} was seen ${lastSeenDate}, corresponds to ${delta} ms ago`)
            if (delta > (delay * 60 * 1000)) {
                logPurge(`considering device: ${macAddress} has left SSID`);

                // Notify Webex Teams
                // Send notification of new presence detected
                let owner = myPeople[macAddress];
                let message = {
                    roomId: process.env.TEAMS_SPACE,
                    markdown: `heads up: seems ${owner} has left ${process.env.MERAKI_SSID}`
                };
                teamsClient.messageSend(message)
                    .then((message) => {
                        fine('message pushed successfully to Teams')

                        // Remove entry from seen devices
                        delete tracking[macAddress]
                    })
                    .catch((err) => {
                        debug(`could not push message to Teams, err: ${err.message}`);
                    });

            }
        })
    }
});

