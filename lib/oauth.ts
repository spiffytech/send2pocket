import fetch = require("node-fetch");
import r from "./db";
import * as common from "./common";

const DOMAIN = process.env.DOMAIN;

export function initialize_oauth() {
    const REDIRECT_URL = `http://${DOMAIN}/oauth-finish`;
    return fetch(
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
        const oauth_url = `https://getpocket.com/auth/authorize?request_token=${json.code}&redirect_uri=${REDIRECT_URL}`;
        return {code: json.code, redirect_url: oauth_url};
    });
}

// TODO: make this return an existing user if Pocket username is already in DB
export function finish_oauth(oauth_code: string) {
    return fetch(
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
        const user_id = common.token_to_hash(resp.access_token);

        return r.table("users").insert(<User>{
            id: user_id,
            token: resp.access_token,
            pocket_username: resp.username
        }).run().
        then(() => user_id);
    });
}
