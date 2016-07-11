import * as RDash from "rethinkdbdash";

const r = RDash({
    db: "send2pocket",
    host: process.env.RETHINKDB_HOST || "localhsot"
});
export default r;
