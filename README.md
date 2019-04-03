# Meraki notifier to Webex Teams

a Node.js webhook that posts messages to Webex Teams as devices are detected

To run this code, you will need to:
1. a Meraki Access Point
2. create a scanning Webhook
3. create a Teams Space and a Bot token
4. update the list of known Mac addresses in [people.js](./people.js)
5. launch the app with specified env variables

All set! please reach to your space and wait for notifications to fly in as devices connect


## Quick start on Glitch

Click [![Remix on Glitch](https://cdn.glitch.com/2703baf2-b643-4da7-ab91-7ee2a2d00b5b%2Fremix-button.svg)](https://glitch.com/edit/#!/import/github/ObjectIsAdvantag/smartsheet-to-webex-teams)

Then open the `.env` file and paste your bot's token, space id, as well as your smartsheet token and sheet id.

You app is all set: the webhook got automatically created from glitch's PROJECT_DOMAIN env variable.

Your app healthcheck is accessible at your application public url.

Go to your smartsheet and start entering new values,
then customize the mustache template for your smartsheet columns.


## Launch the SmartSheet to Webex Teams app

For **Mac, Linux and bash users**, open a terminal and type:

```shell
git clone https://github.com/CiscoDevNet/smartsheet-to-webex-teams
cd smartsheet-to-webex-teams
npm install
DEBUG=s2wt*,register*,challenge* SMARTSHEET_TOKEN="ka5XXXXXXXXXXXXXXXX" SMARTSHEET_ID="627552342630404" BOT_TOKEN="MmQ5ZTBYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY" SPACE_ID="Y2lzY29zZZZZZZZZZZZZZZZZZZZZZZZZ" PUBLIC_URL="https://e4a1e175.ngrok.io" node webhook.js
```

For **Windows users**, open a command shell and type:

```shell
git clone https://github.com/CiscoDevNet/smartsheet-to-webex-teams
cd smartsheet-to-webex-teams
npm install
set DEBUG=webhook*
set BOT_TOKEN=XXXXXXXXX
set SPACE_ID=YYYYYYYYYYY
...
node webhook.js
```

And here is an example of environment variables on Heroku:

![Heroku env variables](img/heroku_env.png)


**Done, your webhook is live**

Let's hit your app's healthcheck! 
From the command line, type:

```shell
curl -X GET http://localhost:8080
```


## To manually register your app as a Smartsheet Webhook

Note: this step is now optional as the registration is automatically performed at launch.

Create a Smartsheet API token from your smartsheet account:
- login
- click your avatar, pick "Apps and Integrations..."
- among your Personal Settings, select "API Access"
- click the "Generate new access token" button

Now, let's list your smartsheets and look for the identifier of the smartsheet you want to monitor. From the terminal, run the command below:

```shell
curl -X GET https://api.smartsheet.com/2.0/sheets \
  -H 'Authorization: Bearer qq0w5090qq0w5090qq0w5090' 
```

Almost there, create a SmartSheet webhook on the command line by typing:

```shell
curl -X POST https://api.smartsheet.com/2.0/webhooks \
  -H 'Authorization: Bearer qq0w5090qq0w5090qq0w5090' \
  -H 'Content-Type: application/json' \
  -d '{ 
    "callbackUrl": "https://e6174831.ngrok.io",
    "events": ["*.*"],
    "name": "From Postman",
    "scope": "sheet",
    "scopeObjectId" : "6275510532630404",
    "version": "1"
}'
```

Finally, let's validate the newly created webhook above by updating it (as per the Smartsheet specs). Please replace with the webhook id below:

```shell
curl -X PUT https://api.smartsheet.com/2.0/webhooks/5481972073031556 \
  -H 'Authorization: Bearer qq0w5090qq0w5090qq0w5090' \
  -H 'Content-Type: application/json' \
  -d '{ "enabled": true }'
```

That's it, create a new row entry, and check it shows up in the console.
Note: update the provided sample with [your own custom logic](./webhook.js#146)!
