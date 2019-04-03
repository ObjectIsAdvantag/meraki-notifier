/** 
 * Check the payload structure complies with
 * https://n193.meraki.com/manage/support?search_term=3965#CMX_Location_API
 * 
 * Data Elements

        Name
        Format
        Description
        apMac	string	MAC address of the observing AP
        apTags	[string]	JSON array of all tags applied to the AP in dashboard
        apFloors	[string]	JSON array of all floorplan names on which this AP appears
        clientMac	string	Device MAC
        ipv4	string	Client IPv4 address and hostname, in "hostname/address" format; only "/address" if no hostname, null if not available
        ipv6	string	Client IPv6 address and hostname, in "hostname/address" format; only "/address" if no hostname, null if not available
        seenTime	ISO 8601 date string	Observation time in UTC; example: "1970-01-01T00:00:00Z"
        seenEpoch	integer	Observation time in seconds since the UNIX epoch
        ssid	string	Client SSID name; null if the device is not connected
        rssi	integer	Device RSSI as seen by AP
        manufacturer	string	Device manufacturer; null if manufacturer could not be determined
        os	string	Device operating system; null if the OS could not be determined
        location	location	Device geolocation; null if location could not be determined
        lat	decimal	Device latitude in degrees N of the equator
        lng	decimal	Device longitude in degrees E of the prime meridian
        unc	decimal	Uncertainty in meters
        x	[decimal]	JSON array of x offsets (in meters) from lower-left corner of each floorplan
        y	[decimal]	JSON array of y offsets (in meteres) from lower-left corner of each floorplan
        HTTP POST body format

        {
        "version":"2.0",
        "secret":<string>,
        "type":<event type>,
        "data":<event-specific data>
        }
        

        Event Specific Data Format

        {
        "apMac": <string>,
        "apTags": [<string, ...],
        "apFloors": [<string>, ...],
        "observations": [
            {
            "clientMac": <string>,
            "ipv4": <string>,
            "ipv6": <string>,
            "seenTime": <string>,
            "seenEpoch": <integer>,
            "ssid": <string>,
            "rssi": <integer>,
            "manufacturer": <string>,
            "os": <string>,
            "location": {
                "lat": <decimal>,
                "lng": <decimal>,
                "unc": <decimal>,
                "x": [<decimal>, ...],
                "y": [<decimal>, ...]
            },
            },...
        ]
        }

 */

// Loggers
const debug = require("debug")("scanning");
const fine = require("debug")("scanning:fine");

function checkPayload(payload) {
    if (!payload) {
        debug(`unexpected scanning payload: null or undefined`);
        return false;
    }
    if (payload.version !== '2.0') {
        debug(`unexpected scanning version: ${payload.version}, expecting '2.0'`);
        return false;
    }
    if (payload.type !== 'DevicesSeen') {
        debug(`unexpected scanning type: ${payload.type}, expecting 'DevicesSeen'`);
        return false;
    }
    if (!payload.data) {
        debug(`unexpected scanning structure: no data`);
        return false;
    }
    if (!payload.data.apMac) {
        debug(`unexpected scanning structure: no apMac`);
        return false;
    }
    fine(`scanning AP mac address: ${payload.data.apMac}`)
    if (!payload.data.observations) {
        debug(`unexpected scanning structure: no observations structure`);
        return false;
    }
    if (!(payload.data.observations instanceof Array)) {
        debug(`unexpected scanning structure: observations is not an array`);
        return false;
    }

    fine(`scanning AP sent : ${payload.data.observations.length} observations`)
    return true;
}

module.exports = checkPayload;