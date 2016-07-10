process.on("unhandledRejection", function(reason, p) {
    const msg = reason.stack || reason;
    console.error(`Possibly Unhandled Rejection at: Promise ${p} reason: ${msg}`);
});

import * as assert from "assert";
const yar = require("yar");
import * as RDash from "rethinkdbdash";
import * as crypto from "crypto";
import * as Hapi from "hapi";
import {fs} from "mz";
import fetch = require("node-fetch");

const r = RDash({db: "send2pocket"});

const DOMAIN = process.env.DOMAIN;
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || DOMAIN;
const OAUTH_COOKIE = "oauth_token";

interface User {
    id: string;
    token: string;
    pocket_username: string;
}

interface Article {
    user: string;
    html: string;
}

function token_to_hash(token: string) {
    return crypto.createHash("sha256").
    update(token).
    digest("hex");
}

function send_to_pocket(
    consumer_key: string,
    access_token: string,
    page_id: string
) {
    const url = `http://${DOMAIN}/articles/${page_id}`;

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
        const recipient = req.payload.recipient.substring(0, req.payload.recipient.indexOf("@"));
        r.table("articles").insert(<Article>{
            user: token_to_hash(recipient),
            html: req.payload["body-html"]
        }).
        then(() => reply("blah"));
    }
});

server.route({
    method: "GET",
    path: "/oauth-start",
    handler: function(req, reply) {
        const REDIRECT_URL = `http://${DOMAIN}/oauth-finish`;
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
        then(json => {
            (<any>req).yar.set(OAUTH_COOKIE, json.code);
            const oauth_url = `https://getpocket.com/auth/authorize?request_token=${json.code}&redirect_uri=${REDIRECT_URL}`;
            return reply.redirect(oauth_url);
        });

    }
});

// TODO: store this in session between oauth authz request and the oauth callback
server.route({
    method: "GET",
    path: "/oauth-finish",
    handler: function (request, reply) {
        const oauth_code = (<any>request).yar.get(OAUTH_COOKIE);
        assert(oauth_code);

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
        then(resp => {
            const user_id = token_to_hash(resp.access_token);

            return r.table("users").insert(<User>{
                id: user_id,
                token: resp.access_token,
                pocket_username: resp.username
            }).run().
            then(() => user_id);
        }).
        then((user_id: string) => reply(`${user_id}@${EMAIL_DOMAIN}`)).
        catch(console.error);
    }
});

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


    const cookie_passwd = process.env.COOKIE_PASSWD;
    assert(cookie_passwd);
    server.register({
        register: yar,
        options: {
            cookieOptions: {
                password: cookie_passwd,
                isSecure: false
            }
        }
    }, err => {
        assert(!err, err);

        server.initialize().
        then(() => server.start()).
        then(() => console.log("Server running at:", server.info.uri)).
        catch(err => { console.error(err); throw err; });
    });
}

serve();
