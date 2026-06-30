const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require('dotenv').config();
const express = require('express');
const app = express()
const port = process.env.PORT
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const { error } = require("node:console");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");


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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  // console.log(authHeader);
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized access" });
  }
  const token = authHeader?.split(' ')[1];
  // console.log(token);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized access" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS)
    // console.log(payload);
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({ message: "Unauthorized access" });
  }


}




async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db(process.env.DB_NAME)
    const doctors = db.collection(process.env.DOCTORS_COLLECTION)
    const appointments = db.collection(process.env.APPOINTMENT_COLLECTION)
    const prescriptions = db.collection(process.env.PRESCRIPTION_COLLECTION)
    const users = db.collection(process.env.USER_COLLECTION)

    // get all users
    app.get('/users', async (req, res) => {

      const result = await users.find().toArray()
      res.send(result)
    })

    // feature doctor
    app.get('/feature-doctor',  async(req, res)=>{
      const result = await doctors.find().sort({_id: -1}).limit(3).toArray()
      res.json(result)
    })

    // delete user
    app.delete('/user/:id', verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await users.deleteOne({
        _id: new ObjectId(id),
      })
      res.send(result)
    })

    // admin overview api
    app.get('/admin/overview', verifyToken, async (req, res) => {
      try {
        const totalUsers = await users.countDocuments()
        const totalDoctors = await doctors.countDocuments()
        const totalAppointments = await appointments.countDocuments()
        const totalPrescriptions = await prescriptions.countDocuments()
        res.send({
          totalUsers,
          totalDoctors,
          totalAppointments,
          totalPrescriptions,
        })
      } catch (error) {
        console.error(error)
      }
    })

    // all doctors
    app.get('/doctors', verifyToken, async (req, res) => {
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
    app.post('/doctors', verifyToken, async (req, res) => {
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
    app.get('/doctors/:id', verifyToken, async (req, res) => {
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

    // update doctors varification status
    app.patch('/doctors/:id/status', verifyToken, async (req, res) => {
      const { id } = req.params
      const { verificationStatus } = req.body
      const result = await doctors.updateOne(
        {
          _id: new ObjectId(id)
        },
        {
          $set: {
            verificationStatus,
          },
        }
      )
      res.send(result)
    })

    // appointments api post
    app.post('/appointments', verifyToken, async (req, res) => {
      try {
        const appointment = req.body
        const result = await appointments.insertOne(appointment)
        res.send(result)
      } catch (error) {
        res.status(500).send({ message: "Faild to save appointment" })
      }
    })


    // get appointment for patient
    app.get('/appointments/patient/:patientId', verifyToken, async (req, res) => {
      try {
        const { patientId } = req.params
        const appointment = await appointments.find({ patientId }).toArray()
        res.send(appointment);
      } catch (error) {
        console.error(error)
      }
    })

    // get accepted appointment for doctor
    app.get('/appointments/doctor/:doctorId/accepted', verifyToken, async (req, res) => {
      const { doctorId } = req.params;
      const result = await appointments.find({
        doctorId,
        appointmentStatus: "Accepted",
      }).toArray()
      res.send(result)
    })

    // appointments status update api
    app.patch("/appointments/:id", verifyToken, async (req, res) => {
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
    app.post('/prescriptions', verifyToken, async (req, res) => {
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
    app.get('/prescriptions/patient/:patientId', verifyToken, async (req, res) => {
      try {

        const { patientId } = req.params;
        const result = await prescriptions.find({
          patientId
        }).sort({ createdAt: -1 }).toArray()
        res.send(result)

      } catch (error) {
        console.error(error)
      }
    })

    app.get('/appointments/doctor/:doctorId', verifyToken, async (req, res) => {
      try {
        const { doctorId } = req.params
        const appointment = await appointments.find({ doctorId }).toArray()
        res.send(appointment);
      } catch (error) {
        console.error(error)
      }
    })




    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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