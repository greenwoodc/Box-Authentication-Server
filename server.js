var express = require("express")
var bodyParser = require("body-parser")
const BoxSDK = require('box-node-sdk')  // Box SDK
const fs = require('fs') // File parsing
var cors = require('cors')


//Initialise Express Web App
var app = express()
app.use(
    express.json({limit: '10mb'}),
    cors()
)

// Initialize the app
var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port
    console.log("App now running on port", port)
})

//Initialise config file
const config = JSON.parse(
    fs.readFileSync('config.json')
)

// Instantiate new Box SDK instance
const sdk = new BoxSDK({
  clientID: config.boxAppSettings.clientID,
  clientSecret: config.boxAppSettings.clientSecret,
  appAuth: {
    keyID: config.boxAppSettings.appAuth.publicKeyID,
    privateKey: config.boxAppSettings.appAuth.privateKey,
    passphrase: config.boxAppSettings.appAuth.passphrase
  }
})

// Authenticate the Box instance
const client = sdk.getAppAuthClient('enterprise', config.enterpriseID)

// Generic error handler
function handleError(res, reason, message, code) {
    console.log("ERROR: " + reason)
    res.status(code || 500).json({"error": message})
}

// Method for downscoping token to folder level
function downScope(folder){
    // Define resource and scopes that downscoped token should have access to
    const scopes = 'base_upload'
    const resource = 'https://api.box.com/2.0/folders/' + folder

    // Perform token exchange to get downscoped token
    const token = client.exchangeToken(scopes, resource)

    return token
}

// Validate hash syntax
function authIdEval(hash){
    // Run regex test over request string
    const regex = /^[a-zA-Z0-9-]{64}$/
    const authIdVal = regex.test(hash)
    
    return authIdVal
}

//Routes
  app.post('/token/:c', function (req, res) {
    var authId = ''
    
    if (!req.params.c) {
      handleError(res, 'Invalid user Input', 'Try Again Gareth..', 400)
    } else {
      if(authIdEval(req.params.c) == true){
        authId = req.params.c
      try {
        // query Folder with metadata filter
        const filter = {
          "mdfilters": [
            {
              'templateKey': "testmeta",
              'scope': "enterprise",
              'filters': {"hash": authId}
            }
          ]
        }

        var payload = {
          "folderId": "",
          "token": ""
        }

        client.search.query( '', filter )
          .then((response) => {
            if(response.total_count == 0) { //Check for results
              handleError(res, 'No results found', 'Try Again Gareth..', 404)
            } else {
              payload.folderId = response.entries[0].id
              // Get downscoped token based on folder ID
              const downscopedToken = downScope(response.entries[0].id)
                .then((downscopedToken) => {
                  payload.token = downscopedToken.accessToken
                  res.status(200).json({ payload })
                })
            } 
            
          })  
          .catch((error) => {
            handleError(res, 'Error Downscoping' + error, 'Try Again Gareth..', 404)
            return error
          }) 

        // Create folder and adding metadata
        // const createdFolder = client.folders.create('83524646105', 'Light Show')
        // .then((createdFolder) => {
        //   console.log(createdFolder.id)
        //     const response = client.folders.addMetadata(
        //       createdFolder.id, client.metadata.scopes.ENTERPRISE, "testmeta", {'hash': authId} 
        //     )
        //     res.status(200).json({ response}) 
        // })
        
        //Get Metadata templates
        // const meta = client.metadata.getTemplates('enterprise')
        // .then((meta) => {
        //   res.status(200).json({ meta })
        // })

        //Get a specific Folder Metadata
        // const existingMeta = client.folders.getAllMetadata('84077240876')
        // .then((existingMeta) => {
        //   res.status(200).json({existingMeta})
        // })
         
        // const downscopedToken = downScope()
        //   .then((downscopedToken) => {
        //     res.status(200).json({ downscopedToken })
        //   })

        // const accessToken = getToken()
        // .then((accessToken) => {
        //     const downscopedToken = downScope()
        //     .then((downscopedToken) => {
        //       // Return json Response
        //       res.status(200).json({ downscopedToken })
        //     })
        //     // Return json response
        //     //res.status(200).json({ accessToken })
        // })
      } catch (error) {
        handleError(res, 'Error authenticating: ' + error, 'Try Again Gareth..', 400)
      }
    } else {
      handleError(res, 'Invalid user Input: ' + req.body.name, 'Try Again Gareth..', 400)
    }
  }
})

// XML String to JSON conversion Endpoint
app.post('/xmlconvert', function (req, res) {
  var parseString = require('xml2js').parseString
  var xmlString = req.body.mapping
  var jsonOutput
  parseString(xmlString, { attrkey: '@', charkey: 'content_'}, function (err, result) {
    jsonOutput = JSON.stringify(result)
  })
  res.status(200).send(jsonOutput)
})
