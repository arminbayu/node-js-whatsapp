const { Client } = require('pg');

const client = new Client({
//   connectionString: process.env.DATABASE_URL,
connectionString:'postgres://twewetdofccuua:25d3440bddba8d3347f3ff966fdb25cf4812f58d4b23b83a1c43a03877388a27@ec2-3-208-79-113.compute-1.amazonaws.com:5432/d1odbfsqcmtvhj',
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect();

const readSession = async () => {
    try {
        const res = await client.query('SELECT * FROM wa_sessions ORDER BY created_at DESC LIMIT 1');
        if (res.rows.length) return res.rows[0].session;
    } catch (error) {
        throw error;
    }
}