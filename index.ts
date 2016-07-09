process.on("unhandledRejection", function(reason, p) {
    const msg = reason.stack || reason;
    console.error(`Possibly Unhandled Rejection at: Promise ${p} reason: ${msg}`);
});

import * as RDash from "rethinkdbdash";
import * as crypto from "crypto";
import * as Hapi from "hapi";
import {fs} from "mz";
import fetch = require("node-fetch");

const r = RDash({db: "send2pocket"});

interface Article {
    user: string;
    html: string;
}

function username_to_hash(username: string) {
    return crypto.createHash("sha1").
    update(username).
    digest("hex");
}

function send_to_pocket(
    consumer_key: string,
    access_token: string,
    page_id: string
) {
    const url = `http://e47eee0c.ngrok.io/articles/${page_id}`;

    return fetch(
        "https://getpocket.com/v3/add",
        {
            method: "POST",
            headers: {
                "X-Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url,
                consumer_key,
                access_token
            })
        }
    ).
    catch(console.error);
}

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
    method: "POST",
    path: "/webhook",
    handler: function (req, reply) {
        r.table("articles").insert(<Article>{
            user: username_to_hash(req.payload.sender),
            html: req.payload["body-html"]
        }).
        then(() => reply("blah"));
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
        then(resp =>
            fs.readFile("tokens.json", "utf8").
            then(JSON.parse).
            catch(() => ({})).  // no file? Default to empty hash.
            then(tokens => {
                tokens[username_to_hash(resp.username)] = resp;
                return fs.writeFile("tokens.json", JSON.stringify(tokens));
            })
        ).
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

fs.readFile("tokens.json", "utf8").
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
