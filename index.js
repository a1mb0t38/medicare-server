const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require('dotenv').config();
const express = require('express');
const app = express()
const port = process.env.PORT
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const { error } = require("node:console");


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
    const appointments = db.collection(process.env.APPOINTMENT_COLLECTION)
    const prescriptions = db.collection(process.env.PRESCRIPTION_COLLECTION)

    // all doctors
    app.get('/doctors', async (req, res) => {
      try {
        const doctors = db.collection(process.env.DOCTORS_COLLECTION)
        const { name, specialization } = req.query;
        const query = {};

        if (name) query.doctorName = { $regex: name, $options: 'i' };
        if (specialization) query.specialization = { $regex: specialization, $options: 'i' };

        const result = await doctors.find(query).toArray();
        res.status(200).send(result)
      } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Internal server error' })
      }
    })

    // doctor post api
    app.post('/doctors', async (req, res) => {
      try {
        const doctor = req.body;
        const existingDoctor = await doctors.findOne({
          doctorId: doctor.doctorId,
        })
        if (existingDoctor) {
          return res.status(400).json({
            message: "Doctor already exists"
          })
        }
        const result = await doctors.insertOne(doctor)
        res.status(200).send(result)
      } catch (error) {
        console.error(error)
      }
    })

    // doctors details by id
    app.get('/doctors/:id', async (req, res) => {
      const doctors = db.collection(process.env.DOCTORS_COLLECTION)
      const { id } = req.params;
      const doctor = await doctors.findOne({
        _id: new ObjectId(id)
      })
      if (!doctor) {
        return res.status(400).json({
          error: 'Doctor not found'
        })
      }
      res.status(200).json(doctor)
    })

    // appointments api post
    app.post('/appointments', async (req, res) => {
      try {
        const appointment = req.body
        const result = await appointments.insertOne(appointment)
        res.send(result)
      } catch (error) {
        res.status(500).send({ message: "Faild to save appointment" })
      }
    })


    // get appointment for patient
    app.get('/appointments/patient/:patientId', async (req, res) => {
      try {
        const { patientId } = req.params
        const appointment = await appointments.find({ patientId }).toArray()
        res.send(appointment);
      } catch (error) {
        console.error(error)
      }
    })

    // get accepted appointment for doctor
    app.get('/appointments/doctor/:doctorId/accepted', async (req, res) => {
      const { doctorId } = req.params;
      const result = await appointments.find({
        doctorId,
        appointmentStatus: "Accepted",
      }).toArray()
      res.send(result)
    })

    // appointments status update api
    app.patch("/appointments/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { appointmentStatus } = req.body;

        if (!["Accepted", "Rejected"].includes(appointmentStatus)) {
          return res.status(400).json({
            message: "invalid appointment status",
          });
        }
        const result = await appointments.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              appointmentStatus,
            },
          }
        )

        if (result.matchedCount === 0) {
          return res.status(400).json({
            message: "Appointment not found",
          });
        }

        res.status(200).json({
          message: `Appointment ${appointmentStatus.toLowerCase()} successfully`,
          modifiedCount: result.modifiedCount,
        })

      } catch (error) {
        console.error(error)
      }
    })

    // prescriptions api
    app.post('/prescriptions', async (req, res) => {
      try {
        const prescription = req.body;
        if (!prescription.doctorId || !prescription.patientId || !prescription.appointmentId || !prescription.diagnosis || !prescription.medications) {
          return res.status(400).json({
            message: "Missing required field",
          })
        }

        const result = await prescriptions.insertOne({
          ...prescription,
          createdAt: new Date(),
        })

        res.status(200).json({
          success: true,
          message: "prescription created successfully",
        })

      } catch (error) {
        console.error(error)
      }
    })

    // get prescription for patient
    app.get('/prescriptions/patient/:patientId', async (req, res) => {
      try {

        const { patientId } = req.params;
        const result = await prescriptions.find({
          patientId
        }).sort({ createdAt: -1 }).toArray()
        res.send(result)

      }catch(error){
        console.error(error)
      }
    })

    app.get('/appointments/doctor/:doctorId', async (req, res) => {
      try {
        const { doctorId } = req.params
        const appointment = await appointments.find({ doctorId }).toArray()
        res.send(appointment);
      } catch (error) {
        console.error(error)
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


app.get('/', (req, res) => {
  res.send("server is working")
})

app.listen(port, () => {
  console.log(`server is running on port ${port}`)
})