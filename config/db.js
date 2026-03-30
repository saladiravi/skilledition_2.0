// require('dotenv').config();
// const Pool = require("pg").Pool;


// const pool = new Pool({  
//   connectionString: process.env.DATABASE_URL,

//   ssl: {
//     rejectUnauthorized: false, 
//   },  
  
//   });
//   console.log("Database URL:", process.env.DATABASE_URL);
 
//   module.exports = pool;

require('dotenv').config();
const Pool = require("pg").Pool;

const pool = new Pool({  
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, 
  },  
});

// ✅ SET TIMEZONE TO IST
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'Asia/Kolkata'")
    .then(() => {
      console.log("Timezone set to IST");
    })
    .catch((err) => {
      console.error("Error setting timezone", err);
    });
});

console.log("Database URL:", process.env.DATABASE_URL);

module.exports = pool;