import * as Hapi from "hapi";
import {fs} from "mz";
import fetch = require("node-fetch");

const server = new Hapi.Server();
server.connection({
    host: process.env.HOST ||
    "0.0.0.0", port: process.env.PORT || 8080
});

server.on("response", function (request: Hapi.Request) {
    let status_code: string | number = null;
    if(request.response.statusCode === 200 || request.response.statusCode === 304) {
        status_code = "---";
    } else {
        status_code = request.response.statusCode;
    }
    console.log(request.info.remoteAddress + " : " + status_code + " : " + request.method.toUpperCase() + " " + request.url.path);
});

server.route({
    method: "GET",
    path: "/webhook",
    handler: function (req, reply) {
        reply("blah");
    }
});

// TODO: store this in session between oauth authz request and the oauth callback
let oauth_code: string = null;
server.route({
    method: "GET",
    path: "/oauth-finish",
    handler: function (request, reply) {
        fetch(
            "https://getpocket.com/v3/oauth/authorize",
            {
                method: "POST",
                headers: {
                    "X-Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    consumer_key: process.env.POCKET_CODE,
                    code: oauth_code
                })
            }
        ).
        then(response => response.json()).
        // TODO: Handle denied authz
        then(console.log.bind(null, "resp:")).
        then(() => reply("blah")).
        catch(console.error);
    }
});

const REDIRECT_URL = "http://e47eee0c.ngrok.io/oauth-finish";
function request_oauth_token() {
    const code = process.env.POCKET_CODE;
}

export function serve() {
    server.ext("onPreResponse", function (request, reply) {
        if(
            request.response.isBoom &&
            (request.response as any).output.statusCode === 404
        ) {
            // Inspect the response here, perhaps see if it's a 404?
            return reply.redirect("/");
        }

        return reply.continue();
    });



    server.initialize().
    then(() => server.start()).
    then(() => console.log("Server running at:", server.info.uri)).
    catch(err => { console.error(err); throw err; });
}

serve();

fs.readFile("oauth_tokens.json", "utf8").
catch(() =>
    fetch(
        "https://getpocket.com/v3/oauth/request",
        {
            method: "POST",
            headers: {
                "X-Accept": "application/json",
                "Content-Type": "application/json; charset=UTF-8"
            },
            body: JSON.stringify({
                consumer_key: "56302-ee90a9f07ff5dd8801da643e",
                redirect_uri: REDIRECT_URL
            })
        }
    ).
    then(response => response.json()).
    then(json => json.code).
    then(code => {
        oauth_code = code;
        console.log(`https://getpocket.com/auth/authorize?request_token=${code}&redirect_uri=${REDIRECT_URL}`);
     }).
    catch(console.error)
);
