const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require('dotenv').config();
const express = require('express');
const app = express()
const port = process.env.PORT
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')


app.use(cors())
app.use(express.json())


const uri = process.env.MONGO_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db(process.env.DB_NAME)
    const doctors = db.collection(process.env.DOCTORS_COLLECTION)

    // all doctors
    app.get('/doctors', async(req, res)=>{
        try{
          const doctors = db.collection(process.env.DOCTORS_COLLECTION)
          const {name, specialization} = req.query;
          const query = {};
          
          if(name) query.doctorName = {$regex: name, $options:'i'};
          if(specialization) query.specialization = {$regex: specialization, $options:'i'};

          const result = await doctors.find(query).toArray();
          res.status(200).send(result)
        }catch(error){
          console.error(error)
          res.status(500).json({error: 'Internal server error'})
        }
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send("server is working")
})

app.listen(port, ()=>{
    console.log(`server is running on port ${port}`)
})